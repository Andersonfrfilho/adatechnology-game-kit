/** A point on the ground plane: world x, z. */
export type PlanPoint = readonly [number, number]

/**
 * Where two segments cross in plan, as the share along each (`[t, u]`, both strictly inside 0..1), or nothing when they do not cross
 * or only touch at an end.
 */
export function segmentCrossing(a0: PlanPoint, a1: PlanPoint, b0: PlanPoint, b1: PlanPoint): readonly [number, number] | undefined {
  const rx = a1[0] - a0[0]
  const rz = a1[1] - a0[1]
  const sx = b1[0] - b0[0]
  const sz = b1[1] - b0[1]
  const denominator = rx * sz - rz * sx
  if (Math.abs(denominator) < 1e-12) return undefined
  const qx = b0[0] - a0[0]
  const qz = b0[1] - a0[1]
  const t = (qx * sz - qz * sx) / denominator
  const u = (qx * rz - qz * rx) / denominator
  const inside = (value: number): boolean => value > 1e-9 && value < 1 - 1e-9
  return inside(t) && inside(u) ? [t, u] : undefined
}

/** Point inside a polygon (even-odd rule). */
export function pointInPolygon(point: PlanPoint, outline: readonly PlanPoint[]): boolean {
  let inside = false
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const a = outline[index] as PlanPoint
    const b = outline[previous] as PlanPoint
    if (a[1] > point[1] !== b[1] > point[1] && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

/** A segment enters a polygon: an end inside it or a crossing with one of its sides. */
export function segmentEntersPolygon(a: PlanPoint, b: PlanPoint, outline: readonly PlanPoint[]): boolean {
  if (outline.length < 3) return false
  if (pointInPolygon(a, outline) || pointInPolygon(b, outline)) return true
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    if (segmentCrossing(a, b, outline[previous] as PlanPoint, outline[index] as PlanPoint) !== undefined) return true
  }
  return false
}

/** Share along a segment of the point nearest to `point`, clamped to 0..1. */
export function nearestShare(a: PlanPoint, b: PlanPoint, point: PlanPoint): number {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const length = dx * dx + dz * dz
  if (length === 0) return 0
  return Math.min(1, Math.max(0, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length))
}

/** Height of a hanging conductor at share `t` of its span: the chord less a parabola with `sag` at mid span. */
export function catenaryHeight(fromY: number, toY: number, sag: number, t: number): number {
  return fromY + (toY - fromY) * t - 4 * sag * t * (1 - t)
}

/** Shares along a segment where it crosses the sides of a polygon, ascending. */
export function polygonCrossings(a: PlanPoint, b: PlanPoint, outline: readonly PlanPoint[]): number[] {
  const shares: number[] = []
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const crossing = segmentCrossing(a, b, outline[previous] as PlanPoint, outline[index] as PlanPoint)
    if (crossing !== undefined) shares.push(crossing[0])
  }
  return shares.sort((first, second) => first - second)
}

/** The range of shares along a segment that lies inside a circle, or none. */
export function circleShares(a: PlanPoint, b: PlanPoint, centre: PlanPoint, radius: number): readonly [number, number] | undefined {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const fx = a[0] - centre[0]
  const fz = a[1] - centre[1]
  const qa = dx * dx + dz * dz
  const qb = 2 * (fx * dx + fz * dz)
  const qc = fx * fx + fz * fz - radius * radius
  if (qa === 0) return qc <= 0 ? [0, 1] : undefined
  const discriminant = qb * qb - 4 * qa * qc
  if (discriminant < 0) return undefined
  const root = Math.sqrt(discriminant)
  const start = Math.max(0, (-qb - root) / (2 * qa))
  const end = Math.min(1, (-qb + root) / (2 * qa))
  return start <= end ? [start, end] : undefined
}
