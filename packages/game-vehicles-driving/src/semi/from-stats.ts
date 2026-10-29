import { defaultSemiSpec } from './driver'
import type { SemiSimSpec } from './types'

/** The design ratings of a vehicle (the shape of `fleetStats` in `game-vehicles-fleet`; any object with these fields works). */
export interface DesignStats {
  /** 0-10. */
  acceleration: number
  /** 0-10. */
  handling: number
  maxSpeedKmh: number
}

export interface BodyDimensions {
  mass: number
  wheelbase: number
  track: number
  fourWheelDrive?: boolean
}

/**
 * A semi-simulation spec for a two-axle vehicle from its design ratings: the grip follows the handling, the torque follows the acceleration,
 * and the air drag is set so that the top gear tops out at the design top speed.
 */
export function semiSpecFromStats(stats: DesignStats, body: BodyDimensions, base: Partial<SemiSimSpec> = {}): SemiSimSpec {
  const spec: SemiSimSpec = { ...defaultSemiSpec, ...base }
  const half = body.wheelbase / 2
  const side = body.track / 2
  const driveAll = !!body.fourWheelDrive
  const wheels = [
    { x: half, z: -side, steer: true, drive: driveAll },
    { x: half, z: side, steer: true, drive: driveAll },
    { x: -half, z: -side, drive: true, handbrake: true },
    { x: -half, z: side, drive: true, handbrake: true },
  ]
  const peakTorque = body.mass * (0.06 + 0.015 * stats.acceleration)
  const engine = { ...spec.engine, peakTorque }
  const top = stats.maxSpeedKmh / 3.6
  // the last gear puts the redline at the top speed
  const lastRatio = (engine.redlineRpm * 0.95 * 2 * Math.PI * spec.wheelRadius) / (60 * top * spec.finalDrive)
  const gears = [...spec.gears.slice(0, -1).map((g, i, all) => Math.max(g, lastRatio * (1.25 ** (all.length - i)))), lastRatio]
  const torqueAtTop = peakTorque * 0.76
  const thrust = (torqueAtTop * lastRatio * spec.finalDrive * spec.efficiency) / spec.wheelRadius
  const rollingForce = spec.rolling * body.mass * 9.81
  const drag = Math.max(0.01, (thrust - rollingForce) / (top * top))
  return { ...spec, mass: body.mass, wheels, fourWheelDrive: driveAll, engine, gears, drag, tyre: { ...spec.tyre, friction: 0.8 + 0.03 * stats.handling } }
}
