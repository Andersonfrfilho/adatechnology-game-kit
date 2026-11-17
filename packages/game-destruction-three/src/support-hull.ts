/** A point on the ground plane: x and z in metres. */
export type PlanPoint = readonly [number, number]

const cross = (o: PlanPoint, a: PlanPoint, b: PlanPoint): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/** The convex hull of the points, counter-clockwise, without repeats (monotone chain). */
export function planHull(points: readonly PlanPoint[]): PlanPoint[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (sorted.length < 3) return sorted
  const lower: PlanPoint[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: PlanPoint[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Distance from `p` to the segment `a`-`b`. */
function toSegment(p: PlanPoint, a: PlanPoint, b: PlanPoint): number {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const length = dx * dx + dz * dz
  const t = length > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)
}

/**
 * Whether a body whose centre of mass projects to `centre` is balanced on the points it rests on: the centre is inside their convex hull, or within `tolerance` of it (a hull
 * of one or two points is a point or a line, and a centre that is not on it topples: a top on one leg always falls, §12).
 */
export function isOverSupport(points: readonly PlanPoint[], centre: PlanPoint, tolerance: number): boolean {
  const hull = planHull(points)
  if (hull.length === 0) return false
  if (hull.length === 1) return Math.hypot(centre[0] - hull[0]![0], centre[1] - hull[0]![1]) <= tolerance
  let inside = hull.length >= 3
  let nearest = Infinity
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i]!
    const b = hull[(i + 1) % hull.length]!
    if (hull.length >= 3 && cross(a, b, centre) < 0) inside = false
    nearest = Math.min(nearest, toSegment(centre, a, b))
  }
  return inside || nearest <= tolerance
}
