import type { BodyId, VehicleDesc, VehicleId, VehicleInput } from '@adatechnology/game-physics'

import { layerOf } from './constants'
import type { JoltWorldHost } from './world-host'

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
  // one differential per driven axle (wheels listed left, right per axle)
  controller.mDifferentials.clear()
  for (let i = 0; i + 1 < desc.wheels.length; i += 2) {
    if (!desc.wheels[i].driven) continue
    const d = new J.VehicleDifferentialSettings()
    d.mLeftWheel = i
    d.mRightWheel = i + 1
    d.mDifferentialRatio = desc.differentialRatio
    controller.mDifferentials.push_back(d)
    J.destroy(d)
  }
  vs.mController = controller
  if (desc.antiRoll) {
    for (let i = 0; i + 1 < desc.wheels.length; i += 2) {
      const bar = new J.VehicleAntiRollBar()
      bar.mLeftWheel = i
      bar.mRightWheel = i + 1
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
  w.vehicles.set(id, { body, constraint, controller: wheeled, listener, tester })
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
  for (let i = 0; i < 4; i++) if (v.constraint.GetWheel(i).HasContact()) n++
  return n
}
