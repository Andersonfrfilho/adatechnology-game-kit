import type { Curve, DifferentialDesc, VehicleDesc, WheelDesc } from '@adatechnology/game-physics'

import type { Jolt } from './constants'
import type JoltNS from 'jolt-physics/wasm-compat'

/** The wheels as axles: [left, right] indexes, right -1 for a wheel alone. Wheels are listed left, right per axle; two on the same line (a motorbike's) are not an axle. */
export const axlesOf = (wheels: readonly WheelDesc[]): Array<[number, number]> => {
  const out: Array<[number, number]> = []
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

/** One differential per driven axle unless the description lists them. */
const differentialsOf = (desc: VehicleDesc): readonly DifferentialDesc[] => {
  if (desc.differentials) return desc.differentials
  const out: DifferentialDesc[] = []
  for (const [left, right] of axlesOf(desc.wheels)) if (desc.wheels[left].driven) out.push({ left, right })
  return out
}

const fillCurve = (curve: JoltNS.LinearCurve, points: Curve): void => {
  curve.Clear()
  for (const [x, y] of points) curve.AddPoint(x, y)
  curve.Sort()
}

/** The engine, gearbox and differentials of a wheeled controller (a motorcycle's too) as the description says them. */
const configureDrivetrain = (controller: JoltNS.WheeledVehicleControllerSettings | JoltNS.TrackedVehicleControllerSettings, desc: VehicleDesc): void => {
  const engine = controller.mEngine
  engine.mMaxTorque = desc.maxTorque
  engine.mMinRPM = desc.minRpm
  engine.mMaxRPM = desc.maxRpm
  if (desc.engineInertia !== undefined) engine.mInertia = desc.engineInertia
  if (desc.engineDamping !== undefined) engine.mAngularDamping = desc.engineDamping
  if (desc.torqueCurve) fillCurve(engine.mNormalizedTorque, desc.torqueCurve)
  const gearbox = controller.mTransmission
  gearbox.mGearRatios.clear()
  for (const g of desc.gears) gearbox.mGearRatios.push_back(g)
  gearbox.mReverseGearRatios.clear()
  for (const g of desc.reverseGears) gearbox.mReverseGearRatios.push_back(g)
  const timing = desc.transmission
  if (!timing) return
  if (timing.shiftUpRpm !== undefined) gearbox.mShiftUpRPM = timing.shiftUpRpm
  if (timing.shiftDownRpm !== undefined) gearbox.mShiftDownRPM = timing.shiftDownRpm
  if (timing.switchTime !== undefined) gearbox.mSwitchTime = timing.switchTime
  if (timing.clutchReleaseTime !== undefined) gearbox.mClutchReleaseTime = timing.clutchReleaseTime
  if (timing.switchLatency !== undefined) gearbox.mSwitchLatency = timing.switchLatency
  if (timing.clutchStrength !== undefined) gearbox.mClutchStrength = timing.clutchStrength
}

const addDifferentials = (J: Jolt, controller: JoltNS.WheeledVehicleControllerSettings, desc: VehicleDesc): void => {
  controller.mDifferentials.clear()
  for (const diff of differentialsOf(desc)) {
    const d = new J.VehicleDifferentialSettings()
    d.mLeftWheel = diff.left
    d.mRightWheel = diff.right
    // all the torque goes to the one wheel that is there
    if (diff.right < 0) d.mLeftRightSplit = 0
    d.mDifferentialRatio = diff.ratio ?? desc.differentialRatio
    if (diff.limitedSlip !== undefined) d.mLimitedSlipRatio = diff.limitedSlip
    if (diff.torqueShare !== undefined) d.mEngineTorqueRatio = diff.torqueShare
    controller.mDifferentials.push_back(d)
    J.destroy(d)
  }
}

/** The settings of a car's or a motorbike's controller. */
export const wheeledController = (J: Jolt, desc: VehicleDesc): JoltNS.WheeledVehicleControllerSettings => {
  const bike = desc.controller === 'motorcycle'
  const controller = bike ? new J.MotorcycleControllerSettings() : new J.WheeledVehicleControllerSettings()
  configureDrivetrain(controller, desc)
  addDifferentials(J, controller, desc)
  if (bike && desc.motorcycle) {
    const lean = controller as JoltNS.MotorcycleControllerSettings
    if (desc.motorcycle.maxLeanAngle !== undefined) lean.mMaxLeanAngle = desc.motorcycle.maxLeanAngle
    if (desc.motorcycle.leanSpring !== undefined) lean.mLeanSpringConstant = desc.motorcycle.leanSpring
    if (desc.motorcycle.leanDamping !== undefined) lean.mLeanSpringDamping = desc.motorcycle.leanDamping
  }
  return controller
}

/** The settings of a tracked controller: two tracks, each over its wheels. */
export const trackedController = (J: Jolt, desc: VehicleDesc): JoltNS.TrackedVehicleControllerSettings => {
  if (!desc.tracks) throw new Error('game-physics-jolt: a tracked vehicle needs `tracks`')
  const controller = new J.TrackedVehicleControllerSettings()
  configureDrivetrain(controller, desc)
  desc.tracks.forEach((track, side) => {
    const settings = controller.get_mTracks(side)
    settings.mDrivenWheel = track.drivenWheel
    settings.mWheels.clear()
    for (const wheel of track.wheels) settings.mWheels.push_back(wheel)
    if (track.maxBrakeTorque !== undefined) settings.mMaxBrakeTorque = track.maxBrakeTorque
    settings.mDifferentialRatio = track.differentialRatio ?? desc.differentialRatio
  })
  return controller
}

/** One wheel's settings, in the kind its controller wants (a track's wheel has a grip number, a car's has two curves). */
export const wheelSettings = (J: Jolt, wheel: WheelDesc, track?: { readonly longitudinalFriction?: number; readonly lateralFriction?: number }): JoltNS.WheelSettings => {
  const ws = track ? new J.WheelSettingsTV() : new J.WheelSettingsWV()
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
  if (track) {
    const tv = ws as JoltNS.WheelSettingsTV
    if (track.longitudinalFriction !== undefined) tv.mLongitudinalFriction = track.longitudinalFriction
    if (track.lateralFriction !== undefined) tv.mLateralFriction = track.lateralFriction
    return tv
  }
  const wv = ws as JoltNS.WheelSettingsWV
  wv.mMaxSteerAngle = wheel.maxSteer
  wv.mMaxBrakeTorque = wheel.maxBrakeTorque
  wv.mMaxHandBrakeTorque = wheel.maxHandBrakeTorque
  if (wheel.inertia !== undefined) wv.mInertia = wheel.inertia
  if (wheel.angularDamping !== undefined) wv.mAngularDamping = wheel.angularDamping
  if (wheel.longitudinalFriction) fillCurve(wv.mLongitudinalFriction, wheel.longitudinalFriction)
  if (wheel.lateralFriction) fillCurve(wv.mLateralFriction, wheel.lateralFriction)
  return wv
}
