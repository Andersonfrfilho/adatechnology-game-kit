import type { Vec3 } from './types'

/** The height of the ground under a point of the plane (a terrain, a floor, a heap): the surface an explosive in flight must not pass through. */
export type GroundHeight = (x: number, z: number) => number

export type GroundSweepOptions = {
  /** Metres above the ground the body counts as touching it (its radius). Default 0. */
  readonly clearance?: number
  /** Most metres between two heights read along the way. Default 0.1 (a cell of the terrain): a bump or the rim of a crater shorter than a fast round's step is still met. */
  readonly spacing?: number
}

export type GroundSweepHit = { readonly point: Vec3; readonly normal: Vec3; readonly ground: true; readonly distance: number }

const BISECTIONS = 10
const SLOPE_STEP = 0.1

const lerp = (from: Vec3, to: Vec3, k: number): Vec3 => [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k]

const groundNormal = (groundAt: GroundHeight, x: number, z: number): Vec3 => {
  const slopeX = (groundAt(x + SLOPE_STEP, z) - groundAt(x - SLOPE_STEP, z)) / (2 * SLOPE_STEP)
  const slopeZ = (groundAt(x, z + SLOPE_STEP) - groundAt(x, z - SLOPE_STEP)) / (2 * SLOPE_STEP)
  const size = Math.hypot(slopeX, 1, slopeZ)
  return [-slopeX / size, 1 / size, -slopeZ / size]
}

/**
 * Where the segment `from` to `to` first goes under the ground, read every `spacing` metres along it and narrowed by halving, or null when it stays
 * above. Only the end of a step is not enough: a round that crosses a heap, a kerb or a crater rim within one frame would go through it.
 */
export function sweepGround(from: Vec3, to: Vec3, groundAt: GroundHeight, options: GroundSweepOptions = {}): GroundSweepHit | null {
  const clearance = options.clearance ?? 0
  const below = (point: Vec3): boolean => point[1] < groundAt(point[0], point[2]) + clearance
  const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const samples = Math.max(1, Math.ceil(length / (options.spacing ?? 0.1)))
  let above = 0
  if (below(from)) return hitAt(from, from, groundAt, clearance)
  for (let index = 1; index <= samples; index++) {
    const k = index / samples
    if (!below(lerp(from, to, k))) {
      above = k
      continue
    }
    let high = k
    for (let step = 0; step < BISECTIONS; step++) {
      const middle = (above + high) / 2
      if (below(lerp(from, to, middle))) high = middle
      else above = middle
    }
    return hitAt(from, lerp(from, to, high), groundAt, clearance)
  }
  return null
}

const hitAt = (from: Vec3, at: Vec3, groundAt: GroundHeight, clearance: number): GroundSweepHit => {
  const point: Vec3 = [at[0], groundAt(at[0], at[2]) + clearance, at[2]]
  return { point, normal: groundNormal(groundAt, at[0], at[2]), ground: true, distance: Math.hypot(point[0] - from[0], point[1] - from[1], point[2] - from[2]) }
}
