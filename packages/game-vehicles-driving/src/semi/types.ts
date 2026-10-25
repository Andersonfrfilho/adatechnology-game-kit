import type { DriveInput } from '../types'

export interface SemiWheel {
  /** Metres ahead of the centre of mass (negative behind). */
  x: number
  /** Metres to the right of the centre line. */
  z: number
  steer?: boolean
  drive?: boolean
  /** The handbrake locks it. */
  handbrake?: boolean
}

export interface SemiSimSpec {
  /** Kilograms. */
  mass: number
  /** Yaw moment of inertia, kg·m². Default `mass * (wheelbase² + track²) / 12`. */
  yawInertia?: number
  /** Height of the centre of mass above the ground, metres. Lower = less roll and pitch. */
  centreHeight: number
  wheels: readonly SemiWheel[]
  wheelRadius: number
  fourWheelDrive: boolean
  /** Air drag: `0.5 * 1.2 * Cd * A`, in kg/m. */
  drag: number
  /** Rolling resistance coefficient on hard ground. */
  rolling: number
  /** Rolling resistance of a vehicle that sinks on a `bogs` surface without four-wheel drive, while it is trying to move. */
  bogResistance: number
  maxSteer: number
  /** Total brake force, newtons, split by the wheel loads. */
  brakeForce: number
  engine: { idleRpm: number; peakRpm: number; redlineRpm: number; peakTorque: number }
  /** Gear ratios, first to last. */
  gears: readonly number[]
  reverseRatio: number
  finalDrive: number
  /** Share of the engine torque that reaches the ground. */
  efficiency: number
  /** Upshift above this fraction of the redline; downshift under `downshiftRpm` fraction. */
  upshiftFraction: number
  downshiftFraction: number
  suspension: { restLength: number; spring: number; damper: number }
  tyre: {
    /** Peak friction coefficient on dry asphalt. */
    friction: number
    /** Lateral force per radian of slip, as a multiple of the wheel load, before saturating. */
    corneringStiffness: number
  }
  tank: { capacity: number } & Partial<import('./fuel').FuelModel>
}

/** What is wrong with the vehicle, each from 0 (gone) to 1 (new). The host fills it from `kit.zoneOverall` or from a destructible. */
export interface VehicleCondition {
  /** Health of each wheel in the order of `spec.wheels`. Under 0.2 the tyre is flat. */
  tyres?: readonly number[]
  engine?: number
  suspension?: number
}

export interface SemiInput extends DriveInput {
  /** Forces a gear (1-based, 0 = neutral, -1 = reverse). Absent = automatic. */
  gear?: number
}

export interface SemiGround {
  /** Height of the ground under the point, metres. Default 0. */
  height?: number
  /** Id of the surface. Default `dry_asphalt`. */
  surface?: string
}

export interface SemiWorld {
  ground?(x: number, z: number): SemiGround
}

export interface SemiState {
  x: number
  z: number
  yaw: number
  /** Body-frame speeds: forward and to the right, m/s. */
  u: number
  w: number
  /** Yaw rate, rad/s, positive turning left. */
  yawRate: number
  /** Ride height of the centre, pitch (nose up) and roll (right side down). */
  height: number
  heightRate: number
  pitch: number
  pitchRate: number
  roll: number
  rollRate: number
  rpm: number
  /** Gear in use: 0 neutral, -1 reverse. */
  gear: number
  engineOn: boolean
  /** Stuck: a 2WD vehicle on a bogging surface. */
  bogged: boolean
  fuel: number
  /** Load on each wheel, newtons. */
  loads: number[]
  /** Slip of each wheel (1 = sliding). */
  slip: number[]
  steerAngle: number
}

export type SemiEvent =
  | { type: 'stall' }
  | { type: 'bogged' }
  | { type: 'aquaplaning'; wheel: number }
  | { type: 'shift'; gear: number }
  | { type: 'out_of_fuel' }
