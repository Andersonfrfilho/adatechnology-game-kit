import { convexFaces, reducePoints } from './hull-geometry'

/** Points a hull is made of at most (design 10.1). */
export const MAX_HULL_POINTS = 64
/** A flat piece (thinner than twice this) gets this much (m) on each side of its plane. */
export const FLAT_PAD = 0.0025

type Vec3 = readonly [number, number, number]

/** The triangles of a drawn piece (or of several, merged) in the vehicle's frame. */
export interface HullSoup {
  readonly vertices: readonly number[]
  readonly indices: readonly number[]
}

/** The unit normal of the largest triangle: the direction a flat piece is flat along. */
const mainNormal = (soup: HullSoup): Vec3 => {
  const v = soup.vertices
  let best: Vec3 = [0, 1, 0]
  let bestArea = 0
  for (let t = 0; t + 2 < soup.indices.length; t += 3) {
    const a = soup.indices[t]! * 3, b = soup.indices[t + 1]! * 3, c = soup.indices[t + 2]! * 3
    const ux = v[b]! - v[a]!, uy = v[b + 1]! - v[a + 1]!, uz = v[b + 2]! - v[a + 2]!
    const wx = v[c]! - v[a]!, wy = v[c + 1]! - v[a + 1]!, wz = v[c + 2]! - v[a + 2]!
    const cross: Vec3 = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]
    const area = Math.hypot(...cross)
    if (area > bestArea) [best, bestArea] = [[cross[0] / area, cross[1] / area, cross[2] / area], area]
  }
  return best
}

const spreadAlong = (points: readonly number[], axis: Vec3): number => {
  let low = Infinity
  let high = -Infinity
  for (let i = 0; i < points.length; i += 3) {
    const t = points[i]! * axis[0] + points[i + 1]! * axis[1] + points[i + 2]! * axis[2]
    if (t < low) low = t
    if (t > high) high = t
  }
  return high - low
}

/** The points each moved `FLAT_PAD` both ways along the axis. */
const paddedAlong = (points: readonly number[], axis: Vec3): number[] => {
  const out: number[] = []
  for (let i = 0; i < points.length; i += 3) {
    for (const sign of [-1, 1]) out.push(points[i]! + sign * axis[0] * FLAT_PAD, points[i + 1]! + sign * axis[1] * FLAT_PAD, points[i + 2]! + sign * axis[2] * FLAT_PAD)
  }
  return out
}

/** A unit vector across `axis`, for a piece that is flat along it and also a line. */
const acrossOf = (axis: Vec3): Vec3 => {
  const pick: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const cross: Vec3 = [axis[1] * pick[2] - axis[2] * pick[1], axis[2] * pick[0] - axis[0] * pick[2], axis[0] * pick[1] - axis[1] * pick[0]]
  const length = Math.hypot(...cross)
  return [cross[0] / length, cross[1] / length, cross[2] / length]
}

/**
 * The one convex hull (at most `MAX_HULL_POINTS` points, x y z triples, every one a drawn vertex) of the drawn vertices of a piece (design 10.1, method B): `reducePoints` always keeps the
 * extreme of each of the 26 directions, so the hull reaches the drawn surface where it reaches farthest. A piece flatter than `2 * FLAT_PAD` gets `FLAT_PAD` on each side of its plane
 * (a line, on each side of its plane and across it): a hull with no volume is no shape. Null when the soup has fewer than three points.
 */
export const hullOf = (soup: HullSoup): number[] | null => {
  if (soup.vertices.length < 9) return null
  const reduced = reducePoints(soup.vertices, MAX_HULL_POINTS)
  const normal = mainNormal(soup)
  if (spreadAlong(reduced, normal) >= 2 * FLAT_PAD && convexFaces(reduced)) return reduced
  const thick = paddedAlong(reducePoints(reduced, MAX_HULL_POINTS / 2), normal)
  if (convexFaces(thick)) return thick
  const lined = paddedAlong(paddedAlong(reducePoints(reduced, MAX_HULL_POINTS / 4), normal), acrossOf(normal))
  return convexFaces(lined) ? lined : null
}
