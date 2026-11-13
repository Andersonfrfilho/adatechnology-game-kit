/** Metres two parts may stand apart and still touch (a support's contact is measured this much wider). */
export const SUPPORT_TOLERANCE = 0.05

/** Points of the plane (x, z). */
export type PlanePoint = readonly [number, number]

const cross = (o: PlanePoint, a: PlanePoint, b: PlanePoint): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/** The convex hull of some points, counter-clockwise (Andrew's monotone chain). */
export function convexHull(points: readonly PlanePoint[]): PlanePoint[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length < 3) return sorted
  const lower: PlanePoint[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: PlanePoint[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/**
 * A body that only rests on its supports (no joint that takes a moment) stands while its centre of mass is over the area they span: inside the convex
 * hull of where it touches them, `margin` metres in from its edge. A slab left on one edge has a hull of zero width under it: it tips off.
 */
export function restsOver(point: PlanePoint, contacts: readonly PlanePoint[], margin: number): boolean {
  const hull = convexHull(contacts)
  if (hull.length < 3) return false
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!
    const b = hull[(i + 1) % hull.length]!
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    if (cross(a, b, point) / length < margin) return false
  }
  return true
}

/** The centre in plan of the contact of two boxes `[x0, z0, x1, z1]` (their overlap, widened as `contactArea` widens it). */
export function contactCentre(a: readonly number[], b: readonly number[]): PlanePoint {
  const mid = (k: 0 | 1): number => (Math.max(a[k]!, b[k]!) - SUPPORT_TOLERANCE + Math.min(a[k + 2]!, b[k + 2]!) + SUPPORT_TOLERANCE) / 2
  return [mid(0), mid(1)]
}

/** The area two boxes `[x0, z0, x1, z1]` share in plan, each widened by `SUPPORT_TOLERANCE` (an edge they only touch still bears a little): the weight of a support. */
export function contactArea(a: readonly number[], b: readonly number[]): number {
  const along = (k: 0 | 1): number => Math.max(0, Math.min(a[k + 2]!, b[k + 2]!) - Math.max(a[k]!, b[k]!) + 2 * SUPPORT_TOLERANCE)
  return along(0) * along(1)
}
