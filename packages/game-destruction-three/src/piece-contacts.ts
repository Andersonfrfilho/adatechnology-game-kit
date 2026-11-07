import type { Vec3 } from '@adatechnology/game-destruction'

/**
 * The shape two pieces meet each other by: a round piece is a capsule round its axis (a can lying on its side, a bottle, a ball when its segment is a point), anything else
 * the boxes of its parts (a table's top and legs, as drawn) or of itself, each a centre, rotation columns (`Matrix4.elements`) and half extents.
 */
export type ContactShape =
  | { readonly kind: 'capsule'; readonly from: Vec3; readonly to: Vec3; readonly radius: number }
  | { readonly kind: 'boxes'; readonly boxes: ReadonlyArray<{ readonly c: Vec3; readonly e: ArrayLike<number>; readonly half: Vec3 }> }

/** Where two shapes meet: the point between them, the unit normal from the second to the first, and how deep they overlap (m). */
export interface ShapeContact {
  readonly point: Vec3
  readonly normal: Vec3
  readonly depth: number
}

/** Rounds of the closest-point search between a segment and a box (each a projection onto one, then the other: convex, so it closes in). */
const SEGMENT_BOX_ROUNDS = 4
/** Two segments this near parallel (sin^2 of the angle between them) are side by side. */
const PARALLEL = 1e-4

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const along = (a: Vec3, d: Vec3, t: number): Vec3 => [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t]
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)

/** The point of the segment `from`-`to` nearest to `p`. */
const nearestOnSegment = (from: Vec3, to: Vec3, p: Vec3): Vec3 => {
  const d = sub(to, from)
  const len2 = dot(d, d)
  return len2 < 1e-12 ? from : along(from, d, clamp01(dot(sub(p, from), d) / len2))
}

/** The nearest points of two segments (Ericson, Real-Time Collision Detection 5.1.9). */
const nearestOfSegments = (p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): [Vec3, Vec3] => {
  const d1 = sub(q1, p1)
  const d2 = sub(q2, p2)
  const r = sub(p1, p2)
  const a = dot(d1, d1)
  const e = dot(d2, d2)
  const f = dot(d2, r)
  let s = 0
  let t = 0
  if (a < 1e-12 && e < 1e-12) return [p1, p2]
  if (a < 1e-12) t = clamp01(f / e)
  else {
    const c = dot(d1, r)
    if (e < 1e-12) s = clamp01(-c / a)
    else {
      const b = dot(d1, d2)
      const denom = a * e - b * b
      if (denom > PARALLEL * a * e) s = clamp01((b * f - c * e) / denom)
      else {
        // side by side (two cans lying parallel): they touch along the length they share, met at its middle, so the blow turns neither
        const s0 = clamp01(-c / a)
        const s1 = clamp01((b - c) / a)
        s = (s0 + s1) / 2
      }
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = clamp01(-c / a)
      } else if (t > 1) {
        t = 1
        s = clamp01((b - c) / a)
      }
    }
  }
  return [along(p1, d1, s), along(p2, d2, t)]
}

/** `p` in the frame of the box (its axes, from its centre). */
const toBox = (box: { c: Vec3; e: ArrayLike<number> }, p: Vec3): Vec3 => {
  const d = sub(p, box.c)
  const e = box.e
  return [e[0] * d[0] + e[1] * d[1] + e[2] * d[2], e[4] * d[0] + e[5] * d[1] + e[6] * d[2], e[8] * d[0] + e[9] * d[1] + e[10] * d[2]]
}

/** A point in the frame of the box back in the world. */
const fromBox = (box: { c: Vec3; e: ArrayLike<number> }, l: Vec3): Vec3 => {
  const e = box.e
  return [box.c[0] + e[0] * l[0] + e[4] * l[1] + e[8] * l[2], box.c[1] + e[1] * l[0] + e[5] * l[1] + e[9] * l[2], box.c[2] + e[2] * l[0] + e[6] * l[1] + e[10] * l[2]]
}

/** A capsule against one box: the nearest point of its segment to the box, and how far inside the capsule's radius the box comes. */
const capsuleBox = (from: Vec3, to: Vec3, radius: number, box: { c: Vec3; e: ArrayLike<number>; half: Vec3 }): ShapeContact | null => {
  let p = nearestOnSegment(from, to, box.c)
  let l = toBox(box, p)
  for (let round = 0; round < SEGMENT_BOX_ROUNDS; round++) {
    const clamped: Vec3 = [Math.max(-box.half[0], Math.min(box.half[0], l[0])), Math.max(-box.half[1], Math.min(box.half[1], l[1])), Math.max(-box.half[2], Math.min(box.half[2], l[2]))]
    p = nearestOnSegment(from, to, fromBox(box, clamped))
    l = toBox(box, p)
  }
  const q: Vec3 = [Math.max(-box.half[0], Math.min(box.half[0], l[0])), Math.max(-box.half[1], Math.min(box.half[1], l[1])), Math.max(-box.half[2], Math.min(box.half[2], l[2]))]
  const gap: Vec3 = [l[0] - q[0], l[1] - q[1], l[2] - q[2]]
  const distance = Math.hypot(gap[0], gap[1], gap[2])
  if (distance >= radius) return null
  const e = box.e
  if (distance > 1e-6) {
    const n: Vec3 = [gap[0] / distance, gap[1] / distance, gap[2] / distance]
    const normal: Vec3 = [e[0] * n[0] + e[4] * n[1] + e[8] * n[2], e[1] * n[0] + e[5] * n[1] + e[9] * n[2], e[2] * n[0] + e[6] * n[1] + e[10] * n[2]]
    return { point: fromBox(box, q), normal, depth: radius - distance }
  }
  // the segment runs inside the box: out through the nearest face
  let axis = 0
  for (let k = 1; k < 3; k++) if (box.half[k] - Math.abs(l[k]) < box.half[axis] - Math.abs(l[axis])) axis = k
  const sign = l[axis] < 0 ? -1 : 1
  return { point: p, normal: [sign * e[axis * 4], sign * e[axis * 4 + 1], sign * e[axis * 4 + 2]], depth: radius + box.half[axis] - Math.abs(l[axis]) }
}

/** Where shape `a` meets shape `b` (the normal from `b` to `a`), the deepest of their boxes; null when they do not touch. Two box shapes are not answered here. */
export function shapeContact(a: ContactShape, b: ContactShape): ShapeContact | null {
  if (a.kind === 'capsule' && b.kind === 'capsule') {
    const [pa, pb] = nearestOfSegments(a.from, a.to, b.from, b.to)
    const d = sub(pa, pb)
    const distance = Math.hypot(d[0], d[1], d[2])
    const reach = a.radius + b.radius
    if (distance >= reach) return null
    // side by side on one line (a can rolled straight at the end of another): apart sideways on the ground
    const normal: Vec3 = distance > 1e-6 ? [d[0] / distance, d[1] / distance, d[2] / distance] : [1, 0, 0]
    return { point: along(pb, normal, b.radius - (reach - distance) / 2), normal, depth: reach - distance }
  }
  if (a.kind === 'capsule' && b.kind === 'boxes') {
    let best: ShapeContact | null = null
    for (const box of b.boxes) {
      const hit = capsuleBox(a.from, a.to, a.radius, box)
      if (hit && (!best || hit.depth > best.depth)) best = hit
    }
    return best
  }
  if (a.kind === 'boxes' && b.kind === 'capsule') {
    const hit = shapeContact(b, a)
    return hit && { point: hit.point, normal: [-hit.normal[0], -hit.normal[1], -hit.normal[2]], depth: hit.depth }
  }
  return null
}
