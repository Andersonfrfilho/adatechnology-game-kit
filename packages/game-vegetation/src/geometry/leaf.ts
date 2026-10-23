import type { Vec3 } from '../types'
import { add, cross, mul, norm, dot } from '../math'
import { mix, shade } from '../color'
import type { MeshBuilder } from './builder'

export interface LeafOptions {
  /** tip droop as a fraction of length, along -up (default 0.18) */
  curl?: number
  /** midrib lift as a fraction of half-width (default 0.5): leaves are folded, never flat cards */
  fold?: number
  /** rows along the length; 2 = 4 triangles, 3 = 8, ... (default 2) */
  rows?: number
  /** width at the base as a fraction of the max width (default 0) */
  baseWidth?: number
  /** sway at the base and at the tip */
  swayBase: number
  swayTip: number
  /** peak of the width profile along the length 0..1 (default 0.38) */
  peak?: number
  /** rounder tip: profile exponent (default 1) */
  round?: number
  /** edge darkening factor for the leaf edges (default 0.92) */
  edge?: number
  /** width multiplier of the edge vertices per row and side (tears / notches); <1 pulls the edge in */
  tear?: (row: number, side: -1 | 1) => number
}

/**
 * Folded, slightly drooping leaf (bent strip with a midrib). `up` is the direction the upper face looks to.
 * 4 triangles with rows = 2.
 */
export function leaf(b: MeshBuilder, base: Vec3, dir: Vec3, up: Vec3, length: number, width: number, c0: Vec3, c1: Vec3, o: LeafOptions): void {
  const d = norm(dir)
  let right = cross(d, up)
  if (dot(right, right) < 1e-6) right = cross(d, [1, 0, 0])
  right = norm(right)
  const n2 = norm(cross(right, d))
  const rows = o.rows ?? 2
  const curl = o.curl ?? 0.18
  const fold = o.fold ?? 0.5
  const peak = o.peak ?? 0.38
  const round = o.round ?? 1
  const edgeK = o.edge ?? 0.92
  const bw = o.baseWidth ?? 0
  type Row = { c: Vec3; w: number; col: Vec3; s: number }
  const rr: Row[] = []
  for (let i = 0; i <= rows; i++) {
    const t = i / rows
    let w: number
    if (t < peak) w = bw + (1 - bw) * Math.sin((t / peak) * Math.PI * 0.5)
    else w = Math.pow(Math.cos(((t - peak) / (1 - peak)) * Math.PI * 0.5), round)
    w *= width * 0.5
    const centre = add(add(base, mul(d, length * t)), mul(n2, -length * curl * t * t))
    rr.push({ c: centre, w: i === rows ? 0 : w, col: mix(c0, c1, t), s: o.swayBase + (o.swayTip - o.swayBase) * t })
  }
  const verts = rr.map((r, i) => {
    const hasWidth = r.w > 1e-6
    const edgeC = shade(r.col, edgeK)
    const lift = r.w * fold
    const mid = add(r.c, mul(n2, hasWidth ? lift : 0))
    const tl = o.tear ? o.tear(i, -1) : 1
    const tr = o.tear ? o.tear(i, 1) : 1
    const L = hasWidth ? add(add(r.c, mul(right, -r.w * tl)), mul(n2, -r.w * 0.12)) : r.c
    const R = hasWidth ? add(add(r.c, mul(right, r.w * tr)), mul(n2, -r.w * 0.12)) : r.c
    return { L, M: mid, R, c: r.col, e: edgeC, s: r.s, w: r.w, i }
  })
  for (let i = 0; i < rows; i++) {
    const a = verts[i]
    const z = verts[i + 1]
    const aw = a.w > 1e-6
    const zw = z.w > 1e-6
    if (!aw && zw) {
      b.flatTri(a.M, z.L, z.M, a.c, z.e, z.c, a.s, z.s, z.s, n2)
      b.flatTri(a.M, z.M, z.R, a.c, z.c, z.e, a.s, z.s, z.s, n2)
    } else if (aw && !zw) {
      b.flatTri(a.L, z.M, a.M, a.e, z.c, a.c, a.s, z.s, a.s, n2)
      b.flatTri(a.M, z.M, a.R, a.c, z.c, a.e, a.s, z.s, a.s, n2)
    } else if (aw && zw) {
      b.flatQuad(a.L, z.L, z.M, a.M, a.e, z.e, z.c, a.c, a.s, z.s, z.s, a.s, n2)
      b.flatQuad(a.M, z.M, z.R, a.R, a.c, z.c, z.e, a.e, a.s, z.s, z.s, a.s, n2)
    }
  }
}


/** Cheap leaflet / pinna: 2 triangles with a slight fold. */
export function kite(b: MeshBuilder, base: Vec3, dir: Vec3, up: Vec3, length: number, width: number, c0: Vec3, c1: Vec3, sway0: number, sway1: number, lift = 0.35): void {
  const d = norm(dir)
  let right = cross(d, up)
  if (dot(right, right) < 1e-6) right = cross(d, [1, 0, 0])
  right = norm(right)
  const n2 = norm(cross(right, d))
  const m = add(base, mul(d, length * 0.4))
  const hw = width * 0.5
  const L = add(add(m, mul(right, -hw)), mul(n2, hw * lift))
  const R = add(add(m, mul(right, hw)), mul(n2, hw * lift))
  const T = add(add(base, mul(d, length)), mul(n2, -length * 0.08))
  const cm = mix(c0, c1, 0.4)
  b.flatTri(base, L, R, c0, cm, cm, sway0, sway0 + (sway1 - sway0) * 0.4, sway0 + (sway1 - sway0) * 0.4, n2)
  b.flatTri(L, T, R, cm, c1, cm, sway0 + (sway1 - sway0) * 0.4, sway1, sway0 + (sway1 - sway0) * 0.4, n2)
}
