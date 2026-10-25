import type { Driver } from '../types'
import { fuelRate, defaultFuelModel } from './fuel'
import type { FuelModel } from './fuel'
import { createSurfaces, surfaceGrip } from './surfaces'
import type { SurfaceRegistry } from './surfaces'
import type { SemiEvent, SemiInput, SemiSimSpec, SemiState, SemiWorld, VehicleCondition } from './types'

const G = 9.81
const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x))
const MAX_SUBSTEP = 1 / 240
const FLAT_BELOW = 0.2
const STALL_HEALTH = 0.3

/** A mid-size passenger car, so a game can start from numbers that drive like a car. Every field can be replaced. */
export const defaultSemiSpec: SemiSimSpec = {
  mass: 1300,
  centreHeight: 0.5,
  wheels: [
    { x: 1.3, z: -0.75, steer: true },
    { x: 1.3, z: 0.75, steer: true },
    { x: -1.3, z: -0.75, drive: true, handbrake: true },
    { x: -1.3, z: 0.75, drive: true, handbrake: true },
  ],
  wheelRadius: 0.32,
  fourWheelDrive: false,
  drag: 0.4,
  rolling: 0.015,
  bogResistance: 0.3,
  maxSteer: 0.55,
  brakeForce: 14000,
  engine: { idleRpm: 900, peakRpm: 4200, redlineRpm: 6500, peakTorque: 220 },
  gears: [3.6, 2.2, 1.5, 1.1, 0.85],
  reverseRatio: 3.4,
  finalDrive: 3.7,
  efficiency: 0.85,
  upshiftFraction: 0.85,
  downshiftFraction: 0.35,
  suspension: { restLength: 0.4, spring: 32000, damper: 3200 },
  tyre: { friction: 1.05, corneringStiffness: 9 },
  tank: { capacity: 45 },
}

export interface SemiSimOptions {
  surfaces?: SurfaceRegistry
}

export interface SemiDriver extends Omit<Driver, 'step' | 'state'> {
  readonly spec: SemiSimSpec
  readonly state: SemiState
  condition: VehicleCondition
  /** Sets the load carried, kilograms; the mass, the wheel loads and the fuel use follow. */
  setCargo(kg: number): void
  /** A surface that overrides the ground under the wheels for `seconds` (blood after a run-over). */
  contaminate(surfaceId: string, seconds: number): void
  /** Fills the tank (litres). */
  refuel(litres: number): void
  step(input: SemiInput, dt: number, world?: SemiWorld): { state: SemiState; events: SemiEvent[] }
}

const torqueAt = (spec: SemiSimSpec, rpm: number): number => {
  const e = spec.engine
  if (rpm >= e.redlineRpm) return 0
  const t = rpm <= e.peakRpm ? 0.7 + 0.3 * clamp((rpm - e.idleRpm) / (e.peakRpm - e.idleRpm), 0, 1) : 1 - 0.4 * ((rpm - e.peakRpm) / (e.redlineRpm - e.peakRpm))
  return e.peakTorque * t
}

/**
 * The semi-simulation driver (Frota document, section 03): a single rigid body with a low centre of mass, a spring and damper on each wheel
 * measured against the ground under it, separate longitudinal and lateral tyre forces inside a friction circle, an automatic gearbox with a
 * simulated RPM, a handbrake that locks the rear wheels, surfaces with their grip, and damage that changes how it drives. No team code exists
 * for it: the numbers are the document's and the tests check them.
 */
export function createSemiSimDriver(specification: Partial<SemiSimSpec> = {}, options: SemiSimOptions = {}): SemiDriver {
  const spec: SemiSimSpec = { ...defaultSemiSpec, ...specification }
  const surfaces = options.surfaces ?? createSurfaces()
  const fuelModel: FuelModel = { ...defaultFuelModel, ...spec.tank }
  const wheelbase = Math.max(...spec.wheels.map((w) => w.x)) - Math.min(...spec.wheels.map((w) => w.x))
  const track = Math.max(...spec.wheels.map((w) => w.z)) - Math.min(...spec.wheels.map((w) => w.z))
  const baseMass = spec.mass
  let cargo = 0
  let contamination: { id: string; left: number } | null = null
  const n = spec.wheels.length
  const state: SemiState = {
    x: 0,
    z: 0,
    yaw: 0,
    u: 0,
    w: 0,
    yawRate: 0,
    height: spec.suspension.restLength + spec.wheelRadius - (spec.mass * G) / (specification.wheels ? specification.wheels.length : defaultSemiSpec.wheels.length) / spec.suspension.spring,
    heightRate: 0,
    pitch: 0,
    pitchRate: 0,
    roll: 0,
    rollRate: 0,
    rpm: spec.engine.idleRpm,
    gear: 1,
    engineOn: true,
    bogged: false,
    fuel: spec.tank.capacity,
    loads: new Array<number>(n).fill((baseMass * G) / n),
    slip: new Array<number>(n).fill(0),
    steerAngle: 0,
  }
  const driver: SemiDriver = {
    spec,
    state,
    condition: {},
    setCargo(kg) {
      cargo = Math.max(0, kg)
    },
    contaminate(surfaceId, seconds) {
      contamination = { id: surfaceId, left: seconds }
    },
    refuel(litres) {
      state.fuel = Math.min(spec.tank.capacity, state.fuel + litres)
    },
    place(x, z, yaw) {
      state.x = x
      state.z = z
      state.yaw = yaw
      state.u = state.w = state.yawRate = 0
    },
    step(input, dt, world = {}) {
      const events: SemiEvent[] = []
      const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP))
      const h = dt / steps
      for (let s = 0; s < steps; s++) substep(input, h, world, events)
      return { state, events }
    },
  }

  const stallWatch = { throttleTime: 0 }

  function substep(input: SemiInput, dt: number, world: SemiWorld, events: SemiEvent[]): void {
    const cond = driver.condition
    const mass = baseMass + cargo
    const engineHealth = clamp(cond.engine ?? 1, 0, 1)
    const suspensionHealth = clamp(cond.suspension ?? 1, 0, 1)
    const inertia = (spec.yawInertia ?? (baseMass * (wheelbase * wheelbase + track * track)) / 12) * (mass / baseMass)
    const pitchInertia = (mass * (wheelbase * wheelbase + 1)) / 12
    const rollInertia = (mass * (track * track + 1)) / 12
    if (contamination) {
      contamination.left -= dt
      if (contamination.left <= 0) contamination = null
    }
    const cs = Math.cos(state.yaw)
    const sn = Math.sin(state.yaw)
    // steering: the front wheels follow the input, slower when fast (the wheel angle limit shrinks a little)
    const target = clamp(input.steer, -1, 1) * spec.maxSteer
    state.steerAngle += (target - state.steerAngle) * Math.min(1, dt * 8)
    // gearbox: automatic by default. From a stop, the brake reverses and the throttle goes forward again.
    let gear = state.gear
    if (input.gear != null) gear = input.gear
    else if (state.u < 0.5 && input.brake > 0 && input.throttle <= 0) gear = -1
    else if (gear <= 0 && !(gear === -1 && state.u < 0.5 && input.throttle <= 0)) gear = 1
    const ratioOf = (g: number): number => (g < 0 ? spec.reverseRatio : g === 0 ? 0 : (spec.gears[g - 1] as number))
    const driveWheels = spec.wheels.map((w, i) => ({ w, i })).filter(({ w }) => (spec.fourWheelDrive ? true : w.drive))
    // the wheel speed that drives the engine: mean longitudinal speed of the driven wheels / radius
    let driveSpeed = 0
    for (const { w } of driveWheels) driveSpeed += state.u + state.yawRate * w.z
    driveSpeed /= Math.max(1, driveWheels.length)
    const wheelRpm = (Math.abs(driveSpeed) / spec.wheelRadius) * (60 / (2 * Math.PI))
    if (input.gear == null && gear > 0) {
      if (wheelRpm * ratioOf(gear) * spec.finalDrive > spec.engine.redlineRpm * spec.upshiftFraction && gear < spec.gears.length) gear++
      else if (gear > 1 && wheelRpm * ratioOf(gear) * spec.finalDrive < spec.engine.redlineRpm * spec.downshiftFraction) gear--
    }
    if (gear !== state.gear) {
      state.gear = gear
      events.push({ type: 'shift', gear })
    }
    const reversing = state.gear < 0
    const accelInput = reversing ? input.brake : input.throttle
    const brakeInput = clamp(reversing ? input.throttle : input.brake, 0, 1)
    const ratio = ratioOf(state.gear) * spec.finalDrive
    state.rpm = clamp(wheelRpm * ratio, spec.engine.idleRpm, spec.engine.redlineRpm + 200)
    if (!state.engineOn || state.fuel <= 0) state.rpm = 0
    // engine torque: a wrecked engine fails to deliver at full throttle, and under 30% it can die uphill
    let throttle = clamp(accelInput, 0, 1)
    if (engineHealth < STALL_HEALTH && throttle > 0.8) {
      stallWatch.throttleTime += dt
      if (state.pitch > 0.06 && stallWatch.throttleTime > 0.5 && state.engineOn) {
        state.engineOn = false
        events.push({ type: 'stall' })
      }
      throttle *= 0.5
    } else stallWatch.throttleTime = 0
    if (!state.engineOn && accelInput > 0 && Math.abs(state.u) < 0.5 && engineHealth >= STALL_HEALTH && state.fuel > 0) state.engineOn = true
    if (state.fuel <= 0 && state.engineOn) {
      state.engineOn = false
      events.push({ type: 'out_of_fuel' })
    }
    const engineTorque = state.engineOn ? torqueAt(spec, state.rpm) * throttle * (0.55 + 0.45 * engineHealth) : 0
    const driveForceTotal = state.gear === 0 ? 0 : ((reversing ? -1 : 1) * engineTorque * ratio * spec.efficiency) / spec.wheelRadius
    // fuel
    if (state.engineOn) {
      const burned = fuelRate(fuelModel, state.rpm / spec.engine.redlineRpm, throttle, cargo / baseMass, engineHealth) * dt
      state.fuel = Math.max(0, state.fuel - burned)
    }

    // ground under each wheel, and the suspension
    const ride = spec.suspension.restLength
    let sumN = 0
    let sumNA = 0
    let sumNB = 0
    const wheelState: Array<{ n: number; grip: number; surface: string; bog: boolean; flat: boolean }> = []
    let bogging = false
    for (let i = 0; i < n; i++) {
      const w = spec.wheels[i] as (typeof spec.wheels)[number]
      const wx = state.x + w.x * cs + w.z * sn
      const wz = state.z - w.x * sn + w.z * cs
      const ground = world.ground ? world.ground(wx, wz) : {}
      const surface = surfaces.get(contamination && contamination.left > 0 && surfaces.get(contamination.id).grip < surfaces.get(ground.surface ?? 'dry_asphalt').grip ? contamination.id : (ground.surface ?? 'dry_asphalt'))
      const top = state.height + w.x * state.pitch - w.z * state.roll
      const length = top - (ground.height ?? 0) - spec.wheelRadius
      const compression = ride - length
      const rate = -(state.heightRate + w.x * state.pitchRate - w.z * state.rollRate)
      const k = spec.suspension.spring * (0.5 + 0.5 * suspensionHealth)
      const c = spec.suspension.damper * (0.5 + 0.5 * suspensionHealth)
      const load = Math.max(0, k * compression + c * rate)
      const tyreHealth = cond.tyres ? clamp(cond.tyres[i] ?? 1, 0, 1) : 1
      const flat = tyreHealth < FLAT_BELOW
      const bog = !!surface.bogs && !spec.fourWheelDrive
      if (bog) bogging = true
      const grip = surfaceGrip(surface, state.u) * (flat ? 0.5 : 1)
      wheelState.push({ n: load, grip, surface: surface.id, bog, flat })
      sumN += load
      sumNA += load * w.x
      sumNB += load * w.z
    }
    // forces on the ground, per wheel
    let fFwd = 0
    let fRight = 0
    let torque = 0
    let pitchTorque = 0
    let rollTorque = 0
    const handbrake = !!input.handbrake
    const loadSum = Math.max(1, wheelState.reduce((a, b) => a + b.n, 0))
    const drivenCount = Math.max(1, driveWheels.length)
    for (let i = 0; i < n; i++) {
      const w = spec.wheels[i] as (typeof spec.wheels)[number]
      const ws = wheelState[i] as (typeof wheelState)[number]
      const delta = w.steer ? state.steerAngle : 0
      const cd = Math.cos(delta)
      const sd = Math.sin(delta)
      const vxw = state.u + state.yawRate * w.z
      const vyw = state.w - state.yawRate * w.x
      const vl = vxw * cd - vyw * sd
      const vc = vxw * sd + vyw * cd
      const capacity = spec.tyre.friction * ws.grip * ws.n
      // longitudinal request: drive, brake, rolling and handbrake lock
      let fl = 0
      if (driveWheels.some((d) => d.i === i)) fl += driveForceTotal / drivenCount
      const locked = handbrake && w.handbrake
      const brakeShare = (spec.brakeForce * brakeInput * ws.n) / loadSum
      const moving = Math.abs(vl) > 0.05
      if (locked) fl += moving ? -Math.sign(vl) * capacity : 0
      else if (brakeShare > 0 && moving) fl += -Math.sign(vl) * brakeShare
      const rolling = ws.bog && accelInput > 0 ? spec.bogResistance : spec.rolling * (ws.flat ? 6 : 1)
      // lateral: slip angle into a saturating curve, separate from the longitudinal one
      const alpha = Math.atan2(vc, Math.abs(vl) + 0.5)
      let fc = -Math.tanh((spec.tyre.corneringStiffness * alpha)) * capacity
      if (locked) fc *= 0.6
      // friction circle
      const total = Math.hypot(fl, fc)
      let used = 1
      if (total > capacity && total > 0) used = capacity / total
      fl *= used
      fc *= used
      // rolling resistance is the ground's, not the tyre's: it is not limited by the friction circle
      if (moving) fl += -Math.sign(vl) * rolling * ws.n
      const slipRatio = capacity > 0 ? clamp(total / capacity, 0, 1) : 0
      state.slip[i] = slipRatio
      if (ws.surface === 'wet_asphalt' && Math.abs(state.u) * 3.6 > (surfaces.get(ws.surface).aquaplaningKmh ?? 1e9) && slipRatio >= 0.99) events.push({ type: 'aquaplaning', wheel: i })
      // to the body
      const fx = fl * cd + fc * sd
      const fy = -fl * sd + fc * cd
      fFwd += fx
      fRight += fy
      torque += w.z * fx - w.x * fy
      pitchTorque += fx * spec.centreHeight
      rollTorque += -fy * spec.centreHeight
    }
    const bogNow = bogging && Math.abs(state.u) < 1 && accelInput > 0
    if (bogNow && !state.bogged) events.push({ type: 'bogged' })
    state.bogged = bogNow
    // air drag
    fFwd += -spec.drag * state.u * Math.abs(state.u)
    fRight += -spec.drag * state.w * Math.abs(state.w)
    // planar integration in the body frame
    const du = fFwd / mass - state.yawRate * state.w
    const dw = fRight / mass + state.yawRate * state.u
    state.u += du * dt
    state.w += dw * dt
    // a stopped vehicle does not creep: the sticking friction holds it
    if (Math.abs(state.u) < 0.02 && accelInput <= 0) state.u = 0
    state.yawRate += (torque / inertia) * dt
    state.yaw += state.yawRate * dt
    const csn = Math.cos(state.yaw)
    const snn = Math.sin(state.yaw)
    state.x += (state.u * csn + state.w * snn) * dt
    state.z += (-state.u * snn + state.w * csn) * dt
    // vertical, pitch and roll from the wheel loads
    const ay = (sumN - mass * G) / mass
    state.heightRate += ay * dt
    state.height += state.heightRate * dt
    state.pitchRate += ((sumNA + pitchTorque) / pitchInertia) * dt
    state.pitch += state.pitchRate * dt
    state.rollRate += ((-sumNB + rollTorque) / rollInertia) * dt
    state.roll += state.rollRate * dt
    for (let i = 0; i < n; i++) state.loads[i] = (wheelState[i] as (typeof wheelState)[number]).n
  }

  return driver
}
