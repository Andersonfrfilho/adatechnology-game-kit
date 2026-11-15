import type * as THREE from 'three'

import type { Three } from '../kernel-types.js'
import { clip, signedArea, trianglesOf } from './coplanar.js'
import type { Triangle } from './coplanar.js'

/** Keeps the part of a polygon where `a * x + b * y + c >= 0`. */
function clipLinear(polygon: number[][], a: number, b: number, c: number): number[][] {
  const out: number[][] = []
  const f = (p: number[]): number => a * p[0]! + b * p[1]! + c
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!
    const fp = f(p), fq = f(q)
    if (fp >= 0) out.push(p)
    if (fp >= 0 !== fq >= 0) {
      const t = fp / (fp - fq)
      out.push([p[0]! + t * (q[0]! - p[0]!), p[1]! + t * (q[1]! - p[1]!)])
    }
  }
  return out
}

/** Two faces that nearly coincide (facing alike, closer than `gap` over an overlap): depth precision cannot tell them apart at a distance. */
export interface CloseFaceOverlap {
  readonly a: THREE.Mesh
  readonly b: THREE.Mesh
  area: number
  readonly at: THREE.Vector3
}

/**
 * The faces of `keep`'s meshes that face alike (within `maxAngle` radians) and lie closer than `gap` metres over a common area, whatever their colour and
 * material: the gutters' slats crossing at a corner, a bracket a millimetre off the trough. Faces of one mesh and one colour that are the very same plane
 * (`tolerance`) draw alike and are left out, as in `coplanarOverlaps`.
 */
export function closeFaceOverlaps(T: Three, root: THREE.Object3D, options: { readonly keep: (mesh: THREE.Mesh) => boolean; readonly within?: THREE.Box3; readonly gap?: number; readonly maxAngle?: number; readonly minArea?: number }): CloseFaceOverlap[] {
  const gap = options.gap ?? 0.001, minDot = Math.cos(options.maxAngle ?? 0.2), minArea = options.minArea ?? 2e-5
  const triangles = trianglesOf(T, root, options.keep).filter((t) => !options.within || options.within.containsPoint(t.points[0]!))
  const boxes = triangles.map((t) => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
    for (const p of t.points) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, p.getComponent(k)); hi[k] = Math.max(hi[k]!, p.getComponent(k)) }
    return { lo, hi }
  })
  const cell = 0.25, grid = new Map<string, number[]>()
  boxes.forEach((b, i) => {
    for (let x = Math.floor((b.lo[0]! - gap) / cell); x <= Math.floor((b.hi[0]! + gap) / cell); x++) for (let y = Math.floor((b.lo[1]! - gap) / cell); y <= Math.floor((b.hi[1]! + gap) / cell); y++) for (let z = Math.floor((b.lo[2]! - gap) / cell); z <= Math.floor((b.hi[2]! + gap) / cell); z++) {
      const k = `${x},${y},${z}`
      const list = grid.get(k)
      if (list) list.push(i)
      else grid.set(k, [i])
    }
  })
  const seen = new Set<number>(), found = new Map<string, CloseFaceOverlap>()
  const n = triangles.length
  for (const list of grid.values()) {
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const i = Math.min(list[x]!, list[y]!), j = Math.max(list[x]!, list[y]!), id = i * n + j
        if (seen.has(id)) continue
        seen.add(id)
        const a = triangles[i]!, b = triangles[j]!
        if (a.normal.dot(b.normal) < minDot) continue
        if (a.mesh === b.mesh && a.color === b.color && Math.abs(a.offset - b.offset) < 1e-4 && a.normal.dot(b.normal) > 0.9999) continue
        const area = overlapWithin(T, a, b, gap)
        if (area < minArea) continue
        const key = [a.mesh.uuid, b.mesh.uuid].sort().join('|')
        const entry = found.get(key)
        if (entry) entry.area += area
        else found.set(key, { a: a.mesh, b: b.mesh, area, at: a.points[0]!.clone().add(a.points[1]!).add(a.points[2]!).multiplyScalar(1 / 3) })
      }
    }
  }
  return [...found.values()].sort((p, q) => q.area - p.area)
}

/** The area of the part of triangle a, seen along its normal, that triangle b lies over within `gap` of a's plane. */
function overlapWithin(T: Three, a: Triangle, b: Triangle, gap: number): number {
  const n = a.normal
  const u = new T.Vector3(Math.abs(n.x) > 0.9 ? 0 : 1, Math.abs(n.x) > 0.9 ? 1 : 0, 0).cross(n).normalize()
  const w = n.clone().cross(u)
  const flat = (t: Triangle): number[][] => {
    const p = t.points.map((q) => [q.dot(u), q.dot(w)])
    return signedArea(p) < 0 ? p.reverse() : p
  }
  let polygon = flat(a)
  const c = flat(b)
  for (let e = 0; e < 3 && polygon.length; e++) polygon = clip(polygon, c[e]!, c[(e + 1) % 3]!)
  if (polygon.length < 3) return 0
  // b's signed distance from a's plane is linear in (u, w): fit it on b's own corners
  const d = b.points.map((q) => q.dot(n) - a.offset)
  const [p0, p1, p2] = [b.points[0]!, b.points[1]!, b.points[2]!]
  const det = (p1.dot(u) - p0.dot(u)) * (p2.dot(w) - p0.dot(w)) - (p2.dot(u) - p0.dot(u)) * (p1.dot(w) - p0.dot(w))
  if (Math.abs(det) < 1e-12) return 0
  const du1 = d[1]! - d[0]!, du2 = d[2]! - d[0]!
  const gu = (du1 * (p2.dot(w) - p0.dot(w)) - du2 * (p1.dot(w) - p0.dot(w))) / det
  const gw = ((p1.dot(u) - p0.dot(u)) * du2 - (p2.dot(u) - p0.dot(u)) * du1) / det
  const g0 = d[0]! - gu * p0.dot(u) - gw * p0.dot(w)
  polygon = clipLinear(polygon, gu, gw, g0 + gap)
  if (polygon.length) polygon = clipLinear(polygon, -gu, -gw, -g0 + gap)
  return polygon.length > 2 ? Math.abs(signedArea(polygon)) : 0
}
