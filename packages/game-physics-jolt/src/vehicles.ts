import type { BodyId, VehicleDesc, VehicleId, VehicleInput } from '@adatechnology/game-physics'

import { layerOf } from './constants'
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

/** A wheeled vehicle: its chassis a body of the world, Jolt's vehicle constraint and controller, stepped by its own step listener. */
export const createVehicle = (w: JoltWorldHost, desc: VehicleDesc): VehicleId => {
  const J = w.J
  const body = w.createBody({ ...desc.chassis, layer: 'vehicle', allowSleep: true })
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
  const e = w.entry(body)
  const constraint = new J.VehicleConstraint(e.body, vs)
  const tester = new J.VehicleCollisionTesterCastCylinder(layerOf('vehicle'), 0.05)
  constraint.SetVehicleCollisionTester(tester)
  const wheeled = J.castObject(constraint.GetController(), J.WheeledVehicleController)
  // a car made already moving rolls: its wheels turn with it, or they skid it to a stop
  const v = desc.chassis.linearVelocity
  if (v) {
    desc.wheels.forEach((wheel, i) => constraint.GetWheel(i).SetAngularVelocity(v[2] / wheel.radius))
    // and in the gear that speed asks for (the highest one that keeps the engine above its minimum)
    const wheelRpm = (Math.abs(v[2]) / (desc.wheels[0]?.radius ?? 0.3)) * (60 / (2 * Math.PI)) * desc.differentialRatio
    let gear = 1
    desc.gears.forEach((ratio, i) => {
      if (wheelRpm * ratio >= desc.minRpm * 1.5) gear = i + 1
    })
    wheeled.GetTransmission().Set(gear, 1)
  }
  w.system.AddConstraint(constraint)
  const listener = new J.VehicleConstraintStepListener(constraint)
  w.system.AddStepListener(listener)
  J.destroy(vs)
  const id = w.nextVehicle++ as VehicleId
  w.vehicles.set(id, { body, constraint, controller: wheeled, listener, tester, wheelCount: desc.wheels.length })
  return id
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
