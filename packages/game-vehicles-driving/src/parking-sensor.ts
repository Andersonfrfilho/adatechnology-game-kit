/**
 * Parking sensors: the bumper's distance to the nearest obstacle in the way turns into the beep the cabin plays, slower far away, faster close,
 * continuous at the last few centimetres. Pure numbers, the distances are options.
 */
export interface ParkingSensorOptions {
  /** Farther than this (metres) it stays quiet. */
  readonly range: number
  /** Closer than this it beeps without pause. */
  readonly solid: number
  /** Pause between beeps at the edge of the range and near `solid`, seconds. */
  readonly slowest: number
  readonly fastest: number
}

export const DEFAULT_PARKING_SENSOR: ParkingSensorOptions = { range: 1.5, solid: 0.3, slowest: 0.8, fastest: 0.12 }

/** Seconds between beeps for an obstacle `distance` metres from the bumper: null when quiet, 0 when continuous. */
export function parkingBeepInterval(distance: number, options: ParkingSensorOptions = DEFAULT_PARKING_SENSOR): number | null {
  if (distance > options.range) return null
  if (distance <= options.solid) return 0
  const t = (distance - options.solid) / (options.range - options.solid)
  return options.fastest + (options.slowest - options.fastest) * t
}

/**
 * The bumper's distance to the nearest of `obstacles` (world x, z) in the vehicle's path: ahead when `forward`, behind otherwise. The vehicle is
 * at (x, z) facing `heading` (unit x, z), `length` and `width` metres; obstacles off to the side of its width are not in the way.
 */
export function bumperDistance(params: { x: number; z: number; heading: readonly [number, number]; length: number; width: number; forward: boolean; obstacles: ReadonlyArray<readonly [number, number]> }): number {
  const [hx, hz] = params.heading
  const sign = params.forward ? 1 : -1
  let best = Infinity
  for (const [ox, oz] of params.obstacles) {
    const dx = ox - params.x
    const dz = oz - params.z
    const along = (dx * hx + dz * hz) * sign - params.length / 2
    const side = Math.abs(-dx * hz + dz * hx)
    if (along >= 0 && side <= params.width / 2 + 0.2) best = Math.min(best, along)
  }
  return best
}
