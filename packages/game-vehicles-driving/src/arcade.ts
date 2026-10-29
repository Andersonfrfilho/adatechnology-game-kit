import type { DriveInput, Driver, DriverState, DrivingEvent, DrivingWorld, StepResult } from './types'

export interface RunOverRules {
  /** Above this speed (m/s) a body is knocked down. */
  knockSpeed: number
  /** Above this speed a body is killed. */
  killSpeed: number
  /** Knock damage is `speed² * knockDamage`. */
  knockDamage: number
  /** Seconds a knocked body is stunned. */
  stunSeconds: number
  /** Fraction of the vehicle speed given to a knocked body. */
  throwFactor: number
  /** Sideways speed added to a knocked body. */
  sideKick: number
  /** The vehicle keeps this fraction of its speed after knocking a body. */
  knockSlow: number
  /** Damage the vehicle takes for each body killed. */
  killVehicleDamage: number
  /** Below `knockSpeed` the vehicle slows by `exp(-holdDrag * dt)` for each body in the way. */
  holdDrag: number
  /** Metres added around the vehicle's footprint when testing a body. */
  margin: number
}

export interface CrashRules {
  /** Below this speed an impact is only a bump (no event, but the vehicle still bounces). */
  minSpeed: number
  /** Above this speed the impact damages the vehicle by `speed * damage`. */
  damageSpeed: number
  damage: number
  /** Camera shake is `speed / shakeDivisor`. */
  shakeDivisor: number
  /** Above this speed the driver is hurt by `speed * hurtFactor`. */
  hurtSpeed: number
  hurtFactor: number
  /** The speed after an impact is `v * bounce`. */
  bounce: number
  noiseRadius: number
}

/** The numbers of the game's drivable car (G 70188-70290). Every one is an option. */
export interface ArcadeSpec {
  length: number
  width: number
  accel: number
  /** Deceleration when accelerating against a reverse move, or braking against a forward move. */
  brakeAgainstMotion: number
  reverseAccel: number
  /** Coasting drag: `v *= exp(-drag * dt)`. */
  drag: number
  handbrakeDrag: number
  maxForward: number
  maxReverse: number
  /** Largest steering angle, radians. */
  steerMax: number
  /** The steering angle follows its target by `min(1, steerResponse * dt)`. */
  steerResponse: number
  /** Distance used in `yaw += steer * v / wheelbase * dt`. */
  wheelbase: number
  engineNoiseInterval: number
  engineNoiseBase: number
  engineNoiseSpeedFactor: number
  hornNoiseRadius: number
  crash: CrashRules
  runOver: RunOverRules
}

export const defaultArcadeSpec: ArcadeSpec = {
  length: 4.3,
  width: 1.9,
  accel: 5.5,
  brakeAgainstMotion: 12,
  reverseAccel: 3,
  drag: 0.5,
  handbrakeDrag: 3,
  maxForward: 17,
  maxReverse: -5,
  steerMax: 0.55,
  steerResponse: 5,
  wheelbase: 2.6,
  engineNoiseInterval: 0.5,
  engineNoiseBase: 25,
  engineNoiseSpeedFactor: 2,
  hornNoiseRadius: 120,
  crash: { minSpeed: 0.5, damageSpeed: 4, damage: 9, shakeDivisor: 20, hurtSpeed: 9, hurtFactor: 1.2, bounce: -0.25, noiseRadius: 25 },
  runOver: { knockSpeed: 3, killSpeed: 8, knockDamage: 2.5, stunSeconds: 1.4, throwFactor: 0.8, sideKick: 2, knockSlow: 0.93, killVehicleDamage: 3, holdDrag: 2.5, margin: 0.3 },
}

export type ArcadeOptions = Partial<Omit<ArcadeSpec, 'crash' | 'runOver'>> & { crash?: Partial<CrashRules>; runOver?: Partial<RunOverRules> }

/** The eight points the game tests for a wall: the four corners, the middle of the front and rear, and the middle of both sides. */
export function vehicleCorners(spec: Pick<ArcadeSpec, 'length' | 'width'>, x: number, z: number, yaw: number): Array<[number, number]> {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const hl = spec.length / 2
  const hw = spec.width / 2
  const out: Array<[number, number]> = []
  for (const [a, b] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [hl, 0], [-hl, 0], [0, hw], [0, -hw]] as const) out.push([x + a * c + b * s, z - a * s + b * c])
  return out
}

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x))
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * The arcade driver: the game's car, extracted. A pure step function over `DriverState`: no three.js, no game. Port of `carUpdate`
 * (jogo.js 70233-70290) with the same order of operations, so a scripted run gives the same positions and events.
 */
export function createArcadeDriver(options: ArcadeOptions = {}): Driver & { readonly spec: ArcadeSpec } {
  const spec: ArcadeSpec = {
    ...defaultArcadeSpec,
    ...options,
    crash: { ...defaultArcadeSpec.crash, ...(options.crash || {}) },
    runOver: { ...defaultArcadeSpec.runOver, ...(options.runOver || {}) },
  }
  const state: DriverState = { x: 0, z: 0, yaw: 0, v: 0, steer: 0, noiseTimer: 0 }

  const step = (input: DriveInput, dt: number, world: DrivingWorld): StepResult => {
    const events: DrivingEvent[] = []
    const f = (input.throttle > 0 ? 1 : 0) - (input.brake > 0 ? 1 : 0)
    if (f > 0) state.v += (state.v < 0 ? spec.brakeAgainstMotion : spec.accel) * dt * Math.min(1, input.throttle)
    else if (f < 0) state.v -= (state.v > 0 ? spec.brakeAgainstMotion : spec.reverseAccel) * dt * Math.min(1, input.brake)
    else state.v *= Math.exp(-spec.drag * dt)
    if (input.handbrake) state.v *= Math.exp(-spec.handbrakeDrag * dt)
    state.v = clamp(state.v, spec.maxReverse, spec.maxForward)
    state.steer = lerp(state.steer, clamp(input.steer, -1, 1) * spec.steerMax, Math.min(1, dt * spec.steerResponse))
    const nyaw = state.yaw + ((state.steer * state.v) / spec.wheelbase) * dt
    const fx = Math.cos(nyaw)
    const fz = -Math.sin(nyaw)
    const nx = state.x + fx * state.v * dt
    const nz = state.z + fz * state.v * dt
    if (!world.blocked(nx, nz, nyaw)) {
      state.x = nx
      state.z = nz
      state.yaw = nyaw
    } else if (Math.abs(state.v) > spec.crash.minSpeed) {
      const sp = Math.abs(state.v)
      if (sp > spec.crash.damageSpeed) {
        events.push({ type: 'crash', speed: sp, damage: sp * spec.crash.damage, shake: sp / spec.crash.shakeDivisor, hurtDriver: sp > spec.crash.hurtSpeed ? sp * spec.crash.hurtFactor : 0 })
        events.push({ type: 'noise', radius: spec.crash.noiseRadius, x: state.x, z: state.z, source: 'crash' })
      }
      state.v *= spec.crash.bounce
    }
    // run-over: speed is read once, before the loop, as the game does
    const sp = Math.abs(state.v)
    const ro = spec.runOver
    const bodies = world.bodies ? world.bodies() : []
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i]
      if (!body) continue
      const dx = body.x - state.x
      const dz = body.z - state.z
      const a = dx * fx + dz * fz
      const b = -dx * fz + dz * fx
      if (Math.abs(a) > spec.length / 2 + ro.margin || Math.abs(b) > spec.width / 2 + ro.margin) continue
      if (sp > ro.killSpeed) events.push({ type: 'run_over', outcome: 'kill', index: i, speed: sp, vehicleDamage: ro.killVehicleDamage })
      else if (sp > ro.knockSpeed) {
        events.push({
          type: 'run_over',
          outcome: 'knock',
          index: i,
          speed: sp,
          damage: sp * sp * ro.knockDamage,
          stunSeconds: ro.stunSeconds,
          vx: fx * sp * ro.throwFactor + (b > 0 ? -fz : fz) * ro.sideKick,
          vz: fz * sp * ro.throwFactor + (b > 0 ? fx : -fx) * ro.sideKick,
          slow: ro.knockSlow,
        })
        state.v *= ro.knockSlow
      } else {
        state.v *= Math.exp(-ro.holdDrag * dt)
        events.push({ type: 'run_over', outcome: 'push', index: i, speed: sp, dx: (b > 0 ? -fz : fz) * dt, dz: (b > 0 ? fx : -fx) * dt })
      }
    }
    state.noiseTimer -= dt
    if (state.noiseTimer <= 0) {
      state.noiseTimer = spec.engineNoiseInterval
      events.push({ type: 'noise', radius: spec.engineNoiseBase + sp * spec.engineNoiseSpeedFactor, x: state.x, z: state.z, source: 'engine' })
    }
    if (input.horn) {
      events.push({ type: 'noise', radius: spec.hornNoiseRadius, x: state.x, z: state.z, source: 'horn' })
      events.push({ type: 'horn' })
    }
    return { state, events }
  }

  return {
    spec,
    state,
    step,
    place(x, z, yaw) {
      state.x = x
      state.z = z
      state.yaw = yaw
      state.v = 0
      state.steer = 0
    },
  }
}
