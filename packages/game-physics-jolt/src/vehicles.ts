import { WHEEL_READ, WHEEL_READ_STRIDE } from '@adatechnology/game-physics'
import type { BodyId, VehicleDesc, VehicleId, VehicleInput } from '@adatechnology/game-physics'

import { WHEEL_PROBE_LAYER } from './constants'
import type { VehicleEntry } from './entries'
import type { JoltWorldHost } from './world-host'

/**
 * The wheels as axles: [left, right] indexes, right -1 for a wheel alone. Wheels are listed left, right per axle; two listed wheels that sit on the same line
 * (a motorbike's front and rear, no side apart) are not an axle.
 */
const axlesOf = (desc: VehicleDesc): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  const wheels = desc.wheels
  for (let i = 0; i < wheels.length; ) {
    const next = wheels[i + 1]
    if (next && Math.abs(next.position[0] - wheels[i].position[0]) > 0.1 && Math.abs(next.position[2] - wheels[i].position[2]) < 0.1) {
      out.push([i, i + 1])
      i += 2
    } else {
      out.push([i, -1])
      i += 1
    }
  }
  return out
}

/** The vehicle constraint over `body` and the step listener that runs it: what a vehicle is besides its chassis, made again by `rebuildVehicle`. */
const attach = (w: JoltWorldHost, body: BodyId, desc: VehicleDesc): VehicleEntry => {
  const J = w.J
  const vs = new J.VehicleConstraintSettings()
  vs.mUp.Set(0, 1, 0)
  vs.mForward.Set(0, 0, 1)
  vs.mMaxPitchRollAngle = Math.PI
  vs.mWheels.clear()
  const controller = new J.WheeledVehicleControllerSettings()
  controller.mEngine.mMaxTorque = desc.maxTorque
  controller.mEngine.mMinRPM = desc.minRpm
  controller.mEngine.mMaxRPM = desc.maxRpm
  controller.mTransmission.mGearRatios.clear()
  for (const g of desc.gears) controller.mTransmission.mGearRatios.push_back(g)
  controller.mTransmission.mReverseGearRatios.clear()
  for (const g of desc.reverseGears) controller.mTransmission.mReverseGearRatios.push_back(g)
  desc.wheels.forEach((wheel) => {
    const ws = new J.WheelSettingsWV()
    ws.mPosition.Set(wheel.position[0], wheel.position[1], wheel.position[2])
    ws.mSuspensionDirection.Set(0, -1, 0)
    ws.mSteeringAxis.Set(0, 1, 0)
    ws.mWheelUp.Set(0, 1, 0)
    ws.mWheelForward.Set(0, 0, 1)
    ws.mRadius = wheel.radius
    ws.mWidth = wheel.width
    ws.mSuspensionMinLength = wheel.suspensionMin
    ws.mSuspensionMaxLength = wheel.suspensionMax
    ws.mSuspensionSpring.mFrequency = wheel.frequency
    ws.mSuspensionSpring.mDamping = wheel.damping
    ws.mMaxSteerAngle = wheel.maxSteer
    ws.mMaxBrakeTorque = wheel.maxBrakeTorque
    ws.mMaxHandBrakeTorque = wheel.maxHandBrakeTorque
    vs.mWheels.push_back(ws)
  })
  // one differential per driven axle (wheels listed left, right per axle); a wheel with no partner across (a motorbike's, in line) is its own axle
  const axles = axlesOf(desc)
  controller.mDifferentials.clear()
  for (const [left, right] of axles) {
    if (!desc.wheels[left].driven) continue
    const d = new J.VehicleDifferentialSettings()
    d.mLeftWheel = left
    d.mRightWheel = right
    // all the torque goes to the one wheel that is there
    if (right < 0) d.mLeftRightSplit = 0
    d.mDifferentialRatio = desc.differentialRatio
    controller.mDifferentials.push_back(d)
    J.destroy(d)
  }
  vs.mController = controller
  if (desc.antiRoll) {
    for (const [left, right] of axles) {
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
  const wheeled = J.castObject(constraint.GetController(), J.WheeledVehicleController)
  w.system.AddConstraint(constraint)
  const listener = new J.VehicleConstraintStepListener(constraint)
  w.system.AddStepListener(listener)
  J.destroy(vs)
  return { body, constraint, controller: wheeled, listener, tester, wheelCount: desc.wheels.length }
}

/** A car made already moving rolls: its wheels turn with it, or they skid it to a stop, in the gear that speed asks for (the highest one that keeps the engine above its minimum). */
const rollWith = (entry: VehicleEntry, desc: VehicleDesc, forwardSpeed: number): void => {
  desc.wheels.forEach((wheel, i) => entry.constraint.GetWheel(i).SetAngularVelocity(forwardSpeed / wheel.radius))
  const wheelRpm = (Math.abs(forwardSpeed) / (desc.wheels[0]?.radius ?? 0.3)) * (60 / (2 * Math.PI)) * desc.differentialRatio
  let gear = 1
  desc.gears.forEach((ratio, i) => {
    if (wheelRpm * ratio >= desc.minRpm * 1.5) gear = i + 1
  })
  entry.controller.GetTransmission().Set(gear, 1)
}

/** A wheeled vehicle: its chassis a body of the world, Jolt's vehicle constraint and controller, stepped by its own step listener. */
export const createVehicle = (w: JoltWorldHost, desc: VehicleDesc): VehicleId => {
  const body = w.createBody({ ...desc.chassis, layer: 'vehicle', allowSleep: true })
  const entry = attach(w, body, desc)
  const v = desc.chassis.linearVelocity
  if (v) rollWith(entry, desc, v[2])
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
      const ground = wheel.GetContactPointVelocity()
      const along = wheel.GetContactLongitudinal()
      const across = wheel.GetContactLateral()
      longitudinal = wheel.GetAngularVelocity() * wheel.GetSettings().mRadius - (ground.GetX() * along.GetX() + ground.GetY() * along.GetY() + ground.GetZ() * along.GetZ())
      lateral = ground.GetX() * across.GetX() + ground.GetY() * across.GetY() + ground.GetZ() * across.GetZ()
    }
    out[base + WHEEL_READ.SLIP_LONGITUDINAL] = longitudinal
    out[base + WHEEL_READ.SLIP_LATERAL] = lateral
  }
  return count
}

export const driveVehicle = (w: JoltWorldHost, id: VehicleId, input: VehicleInput): void => {
  const v = w.vehicles.get(id)
  if (!v) return
  v.controller.SetDriverInput(input.forward, input.right, input.brake, input.handBrake)
  if (input.forward !== 0 || input.right !== 0) w.bi.ActivateBody(w.entry(v.body).id)
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
