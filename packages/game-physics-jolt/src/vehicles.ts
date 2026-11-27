import type JoltNS from 'jolt-physics/wasm-compat'

import { WHEEL_READ, WHEEL_READ_STRIDE } from '@adatechnology/game-physics'
import type { BodyId, Curve, TrackDesc, VehicleDesc, VehicleId, VehicleInput } from '@adatechnology/game-physics'

import { WHEEL_PROBE_LAYER } from './constants'
import type { VehicleEntry } from './entries'
import { axlesOf, trackedController, wheelSettings, wheeledController } from './vehicle-controllers'
import type { JoltWorldHost } from './world-host'

const peakOf = (curve: Curve | undefined): number | undefined => (curve ? Math.max(...curve.map(([, grip]) => grip)) : undefined)

/**
 * The grip of a tyre on what it stands on, at its peak, is the tyre's times the ground's, as the semi-simulation has it: Jolt's own mix is the geometric mean (0.9 g on a 0.75
 * road where the product gives 0.8 g). The mix keeps the shape of Jolt's, `ground x sqrt(grip at this slip x peak grip)`: it equals the product at the peak and rises as fast with the slip,
 * where the plain product (the grip curve itself) lets a braking front wheel lock and a motorbike fall. It is the callback of this vehicle's wheels alone: the bodies' friction
 * elsewhere (debris, the ground against anything else) is not touched. Without the kit's JS callbacks (the threaded world) Jolt's own mix stays.
 */
const combineWheelFriction = (w: JoltWorldHost, constraint: JoltNS.VehicleConstraint, desc: VehicleDesc): JoltNS.VehicleConstraintCallbacksJS | null => {
  if (!w.listener) return null
  const J = w.J
  const peaks = desc.wheels.map((wheel) => [peakOf(wheel.longitudinalFriction), peakOf(wheel.lateralFriction)] as const)
  const callbacks = new J.VehicleConstraintCallbacksJS()
  callbacks.GetCombinedFriction = (wheel: number, direction: number, tireFriction: number, ground: number) => {
    const peak = peaks[wheel]?.[direction] ?? tireFriction
    const groundFriction = (w.byPointer.get(ground)?.body ?? J.wrapPointer(ground, J.Body)).GetFriction()
    return groundFriction * Math.sqrt(tireFriction * peak)
  }
  callbacks.OnPreStepCallback = () => undefined
  callbacks.OnPostCollideCallback = () => undefined
  callbacks.OnPostStepCallback = () => undefined
  callbacks.SetVehicleConstraint(constraint)
  return callbacks
}

/** The vehicle constraint over `body` and the step listener that runs it: what a vehicle is besides its chassis, made again by `rebuildVehicle`. */
const attach = (w: JoltWorldHost, body: BodyId, desc: VehicleDesc): VehicleEntry => {
  const J = w.J
  const tracked = desc.controller === 'tracked'
  const vs = new J.VehicleConstraintSettings()
  vs.mUp.Set(0, 1, 0)
  vs.mForward.Set(0, 0, 1)
  vs.mMaxPitchRollAngle = Math.PI
  vs.mWheels.clear()
  const trackOf = (index: number): TrackDesc | undefined => desc.tracks?.find((track) => track.wheels.includes(index))
  desc.wheels.forEach((wheel, i) => vs.mWheels.push_back(wheelSettings(J, wheel, tracked ? (trackOf(i) ?? {}) : undefined)))
  const controller = tracked ? trackedController(J, desc) : wheeledController(J, desc)
  vs.mController = controller
  if (desc.antiRoll && !tracked) {
    for (const [left, right] of axlesOf(desc.wheels)) {
      if (right < 0) continue
      const bar = new J.VehicleAntiRollBar()
      bar.mLeftWheel = left
      bar.mRightWheel = right
      bar.mStiffness = desc.antiRoll
      vs.mAntiRollBars.push_back(bar)
      J.destroy(bar)
    }
  }
  const constraint = new J.VehicleConstraint(w.entry(body).body, vs)
  // the wheels' probes meet what a wheel can stand on, never a person or a dead body (the layer of the adapter's own, `WHEEL_PROBE_LAYER`)
  const tester = new J.VehicleCollisionTesterCastCylinder(WHEEL_PROBE_LAYER, 0.05)
  constraint.SetVehicleCollisionTester(tester)
  const base = constraint.GetController()
  const driven = tracked ? J.castObject(base, J.TrackedVehicleController) : desc.controller === 'motorcycle' ? J.castObject(base, J.MotorcycleController) : J.castObject(base, J.WheeledVehicleController)
  w.system.AddConstraint(constraint)
  const listener = new J.VehicleConstraintStepListener(constraint)
  w.system.AddStepListener(listener)
  J.destroy(vs)
  return { body, constraint, controller: driven, tracked, listener, callbacks: combineWheelFriction(w, constraint, desc), tester, wheelCount: desc.wheels.length, quietFor: 0, driven: false }
}

/** The radius the engine turns: the driven wheels' mean (a tracked vehicle's driven wheel of each track), the first wheel's when none is listed driven. */
const drivenRadius = (desc: VehicleDesc): number => {
  const indices = desc.controller === 'tracked' ? (desc.tracks ?? []).map((track) => track.drivenWheel) : desc.wheels.flatMap((wheel, i) => (wheel.driven ? [i] : []))
  const radii = indices.map((i) => desc.wheels[i]?.radius).filter((radius): radius is number => radius !== undefined)
  if (radii.length === 0) return desc.wheels[0]?.radius ?? 0.3
  return radii.reduce((sum, radius) => sum + radius, 0) / radii.length
}

/** A car made already moving rolls: its wheels turn with its speed along its own front, or they skid it to a stop, in the highest gear that keeps the engine above 1.5 times its minimum, with the engine at the speed that gear gives. */
const rollWith = (entry: VehicleEntry, desc: VehicleDesc, forwardSpeed: number): void => {
  desc.wheels.forEach((wheel, i) => entry.constraint.GetWheel(i).SetAngularVelocity(forwardSpeed / wheel.radius))
  const wheelRpm = (Math.abs(forwardSpeed) / drivenRadius(desc)) * (60 / (2 * Math.PI)) * desc.differentialRatio
  let gear = 1
  desc.gears.forEach((ratio, i) => {
    if (wheelRpm * ratio >= desc.minRpm * 1.5) gear = i + 1
  })
  entry.controller.GetTransmission().Set(gear, 1)
  // the engine turns with the wheels it is joined to: left at idle it would drag the car down through the clutch
  const engineRpm = wheelRpm * (desc.gears[gear - 1] ?? 1)
  entry.controller.GetEngine().SetCurrentRPM(Math.min(desc.maxRpm, Math.max(desc.minRpm, engineRpm)))
}

/** A wheeled vehicle: its chassis a body of the world, Jolt's vehicle constraint and controller, stepped by its own step listener. */
export const createVehicle = (w: JoltWorldHost, desc: VehicleDesc): VehicleId => {
  const body = w.createBody({ ...desc.chassis, layer: 'vehicle', allowSleep: true })
  const entry = attach(w, body, desc)
  if (desc.chassis.linearVelocity) rollWith(entry, desc, forwardSpeedOf(w, body))
  const id = w.nextVehicle++ as VehicleId
  w.vehicles.set(id, entry)
  return id
}

/** The constraint made again over the same chassis: a wheel of the old one that is still listed keeps its spin, a new one starts at the speed the chassis rolls at. */
export const rebuildVehicle = (w: JoltWorldHost, id: VehicleId, desc: VehicleDesc): void => {
  const old = w.vehicles.get(id)
  if (!old) throw new Error(`game-physics-jolt: no vehicle ${id}`)
  const spins = Array.from({ length: old.wheelCount }, (_, i) => old.constraint.GetWheel(i).GetAngularVelocity())
  w.system.RemoveStepListener(old.listener)
  w.system.RemoveConstraint(old.constraint)
  w.J.destroy(old.listener)
  if (old.callbacks) w.J.destroy(old.callbacks)
  const entry = attach(w, old.body, desc)
  const rolling = forwardSpeedOf(w, old.body)
  desc.wheels.forEach((wheel, i) => entry.constraint.GetWheel(i).SetAngularVelocity(spins[i] ?? rolling / wheel.radius))
  w.vehicles.set(id, entry)
}

const forwardSpeedOf = (w: JoltWorldHost, body: BodyId): number => {
  const e = w.entry(body)
  const v = e.body.GetLinearVelocity()
  const q = e.body.GetRotation()
  // the chassis's forward is its local z
  const fx = 2 * (q.GetX() * q.GetZ() + q.GetW() * q.GetY())
  const fy = 2 * (q.GetY() * q.GetZ() - q.GetW() * q.GetX())
  const fz = 1 - 2 * (q.GetX() * q.GetX() + q.GetY() * q.GetY())
  return v.GetX() * fx + v.GetY() * fy + v.GetZ() * fz
}

/** What each wheel is doing now (`WHEEL_READ`), `WHEEL_READ_STRIDE` numbers a wheel into `out`; returns the wheel count. */
export const vehicleWheels = (w: JoltWorldHost, id: VehicleId, out: Float64Array): number => {
  const v = w.vehicles.get(id)
  if (!v) return 0
  const count = Math.min(v.wheelCount, Math.floor(out.length / WHEEL_READ_STRIDE))
  for (let i = 0; i < count; i++) {
    const wheel = v.constraint.GetWheel(i)
    const base = i * WHEEL_READ_STRIDE
    const touching = wheel.HasContact()
    out[base + WHEEL_READ.CONTACT] = touching ? 1 : 0
    out[base + WHEEL_READ.BODY] = touching ? wheel.GetContactBodyID().GetIndexAndSequenceNumber() : -1
    out[base + WHEEL_READ.ANGLE] = wheel.GetRotationAngle()
    out[base + WHEEL_READ.STEER] = wheel.GetSteerAngle()
    out[base + WHEEL_READ.SPIN] = wheel.GetAngularVelocity()
    out[base + WHEEL_READ.COMPRESSION] = wheel.GetSuspensionLength()
    out[base + WHEEL_READ.SUSPENSION_IMPULSE] = wheel.GetSuspensionLambda()
    out[base + WHEEL_READ.LONGITUDINAL_IMPULSE] = wheel.GetLongitudinalLambda()
    out[base + WHEEL_READ.LATERAL_IMPULSE] = wheel.GetLateralLambda()
    let longitudinal = 0
    let lateral = 0
    if (touching) {
      // the tyre's slip is against the ground *under* it, as the chassis moves over it: the chassis' velocity at the contact point minus the ground's
      const rolling = w.bi.GetPointVelocity(w.entry(v.body).id, wheel.GetContactPosition())
      const [rx, ry, rz] = [rolling.GetX(), rolling.GetY(), rolling.GetZ()]
      // each vector is read into numbers before the next getter: they share one temporary
      const ground = wheel.GetContactPointVelocity()
      const [dx, dy, dz] = [rx - ground.GetX(), ry - ground.GetY(), rz - ground.GetZ()]
      const along = wheel.GetContactLongitudinal()
      longitudinal = wheel.GetAngularVelocity() * wheel.GetSettings().mRadius - (dx * along.GetX() + dy * along.GetY() + dz * along.GetZ())
      const across = wheel.GetContactLateral()
      lateral = dx * across.GetX() + dy * across.GetY() + dz * across.GetZ()
    }
    out[base + WHEEL_READ.SLIP_LONGITUDINAL] = longitudinal
    out[base + WHEEL_READ.SLIP_LATERAL] = lateral
  }
  return count
}

/** A tracked vehicle's input: `right` turns it by slowing the second track (the right one) to nothing and then backward (a pivot at 1), `-right` the first; with no `forward` the steering alone drives it. */
const driveTracks = (controller: JoltNS.TrackedVehicleController, input: VehicleInput): void => {
  const steer = Math.max(-1, Math.min(1, input.right))
  const forward = input.forward === 0 ? Math.abs(steer) : input.forward
  controller.SetDriverInput(forward, steer < 0 ? 1 + 2 * steer : 1, steer > 0 ? 1 - 2 * steer : 1, Math.max(input.brake, input.handBrake))
}

export const driveVehicle = (w: JoltWorldHost, id: VehicleId, input: VehicleInput): void => {
  const v = w.vehicles.get(id)
  if (!v) return
  if (v.tracked) driveTracks(v.controller as JoltNS.TrackedVehicleController, input)
  else (v.controller as JoltNS.WheeledVehicleController).SetDriverInput(input.forward, input.right, input.brake, input.handBrake)
  v.driven = input.forward !== 0 || input.right !== 0
  if (v.driven) w.bi.ActivateBody(w.entry(v.body).id)
}

export const vehicleBody = (w: JoltWorldHost, id: VehicleId): BodyId => {
  const v = w.vehicles.get(id)
  if (!v) throw new Error(`game-physics-jolt: no vehicle ${id}`)
  return v.body
}

export const removeVehicle = (w: JoltWorldHost, id: VehicleId): void => {
  const v = w.vehicles.get(id)
  if (!v) return
  w.system.RemoveStepListener(v.listener)
  w.system.RemoveConstraint(v.constraint)
  w.J.destroy(v.listener)
  if (v.callbacks) w.J.destroy(v.callbacks)
  w.removeBody(v.body)
  w.vehicles.delete(id)
}

export const wheelContacts = (w: JoltWorldHost, id: VehicleId): number => {
  const v = w.vehicles.get(id)
  if (!v) return 0
  let n = 0
  for (let i = 0; i < v.wheelCount; i++) if (v.constraint.GetWheel(i).HasContact()) n++
  return n
}

/** A wheel turning faster than this (rad/s) keeps the vehicle awake; every wheel under it is at rest. */
const WHEEL_REST_SPIN = 0.5

const fastestWheel = (v: VehicleEntry): number => {
  let fastest = 0
  for (let i = 0; i < v.wheelCount; i++) fastest = Math.max(fastest, Math.abs(v.constraint.GetWheel(i).GetAngularVelocity()))
  return fastest
}

/**
 * The sleep rule of a vehicle (design 7.7), once per fixed step: it sleeps when it has been still (under the world's sleep speed) with every wheel at rest and
 * no throttle or steering for the world's sleep time, and a vehicle asleep with a wheel still turning is woken. A car rolling on free wheels would otherwise take
 * minutes to cross the sleep speed, and one with a wheel spinning in the air would freeze it mid-turn.
 */
export const settleVehicles = (w: JoltWorldHost, dt: number): void => {
  for (const v of w.vehicles.values()) {
    const e = w.entry(v.body)
    if (!e.body.IsActive()) {
      if (fastestWheel(v) >= WHEEL_REST_SPIN) w.bi.ActivateBody(e.id)
      continue
    }
    const linear = e.body.GetLinearVelocity()
    const speed = Math.hypot(linear.GetX(), linear.GetY(), linear.GetZ())
    if (v.driven || speed >= w.sleepSpeed || fastestWheel(v) >= WHEEL_REST_SPIN) {
      v.quietFor = 0
      continue
    }
    v.quietFor += dt
    if (v.quietFor >= w.sleepAfter) w.bi.DeactivateBody(e.id)
  }
}
