import type { Vec3 } from '../types'
import { add, cross, dot, mul, norm } from '../math'
import { shade } from '../color'
import type { MeshBuilder } from './builder'

export interface FleshyLeafOptions {
  rows: number
  profile: 'blade' | 'sword' | 'aloe' | 'spoon'
  /** half thickness as a fraction of the half width at the ridge */
  thick: number
  /** tip droop as a fraction of length (along -up) */
  curl: number
  /** emit the underside (keel) as well */
  lower: boolean
  swayBase: number
  swayTip: number
  /** per row color: t along the length -> ridge color; edges use `edge` */
  color: (t: number) => Vec3
  edge: (t: number) => Vec3
  /** teeth along the edges: count per side, color, size as fraction of width */
  teeth?: { count: number; color: Vec3; size: number }
  /** terminal spine color */
  spine?: Vec3
}

function widthAt(profile: FleshyLeafOptions['profile'], t: number): number {
  switch (profile) {
    case 'blade': // agave: widest near 30%, long taper
      return t < 0.3 ? Math.pow(Math.sin((t / 0.3) * Math.PI * 0.5), 0.6) : Math.pow(1 - (t - 0.3) / 0.7, 0.85)
    case 'sword': // sansevieria: parallel sides, pointed tip
      return Math.min(1, Math.sin(Math.min(1, t * 6 + 0.15) * Math.PI * 0.5)) * (t > 0.82 ? Math.pow(1 - (t - 0.82) / 0.18, 0.8) : 1)
    case 'aloe': // triangular
      return t < 0.08 ? 0.75 + t * 3 : Math.pow(1 - (t - 0.08) / 0.92, 0.8)
    case 'spoon': // echeveria
      return Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, t * 0.97 + 0.03), 0.65)), 0.75)
  }
}

/** Thick leaf with a ridge on top and a keel below (ridge / edges / keel per row). Tip points along `dir`. */
export function fleshyLeaf(b: MeshBuilder, base: Vec3, dir: Vec3, up: Vec3, length: number, width: number, o: FleshyLeafOptions): void {
  const d = norm(dir)
  let right = cross(d, up)
  if (dot(right, right) < 1e-6) right = cross(d, [1, 0, 0])
  right = norm(right)
  const n2 = norm(cross(right, d))
  const R = o.rows
  type Row = { L: Vec3; T: Vec3; R: Vec3; K: Vec3; c: Vec3; e: Vec3; s: number; w: number; ctr: Vec3 }
  const rows: Row[] = []
  for (let i = 0; i <= R; i++) {
    const t = i / R
    const w = (i === R ? 0 : widthAt(o.profile, t)) * width * 0.5
    const centre = add(add(base, mul(d, length * t)), mul(n2, -length * o.curl * t * t))
    const th = w * o.thick
    const ridge = add(centre, mul(n2, th))
    const c = o.color(t)
    const e = o.edge(t)
    const sw = o.swayBase + (o.swayTip - o.swayBase) * t
    rows.push({
      L: add(centre, mul(right, -w)),
      T: ridge,
      R: add(centre, mul(right, w)),
      K: add(centre, mul(n2, -th * 0.8)),
      c,
      e,
      s: sw,
      w,
      ctr: centre,
    })
  }
  for (let i = 0; i < R; i++) {
    const a = rows[i]
    const z = rows[i + 1]
    const aw = a.w > 1e-6
    const zw = z.w > 1e-6
    if (!aw && zw) {
      b.flatTri(a.T, z.L, z.T, a.c, z.e, z.c, a.s, z.s, z.s, n2)
      b.flatTri(a.T, z.T, z.R, a.c, z.c, z.e, a.s, z.s, z.s, n2)
      if (o.lower) {
        b.flatTri(a.T, z.K, z.L, shade(a.c, 0.7), shade(z.c, 0.6), shade(z.e, 0.7), a.s, z.s, z.s, mul(n2, -1))
        b.flatTri(a.T, z.R, z.K, shade(a.c, 0.7), shade(z.e, 0.7), shade(z.c, 0.6), a.s, z.s, z.s, mul(n2, -1))
      }
    } else if (aw && !zw) {
      b.flatTri(a.L, z.T, a.T, a.e, z.c, a.c, a.s, z.s, a.s, n2)
      b.flatTri(a.T, z.T, a.R, a.c, z.c, a.e, a.s, z.s, a.s, n2)
      if (o.lower) {
        b.flatTri(a.L, a.K, z.T, shade(a.e, 0.7), shade(a.c, 0.6), z.c, a.s, a.s, z.s, mul(n2, -1))
        b.flatTri(a.K, a.R, z.T, shade(a.c, 0.6), shade(a.e, 0.7), z.c, a.s, a.s, z.s, mul(n2, -1))
      }
    } else if (aw && zw) {
      b.flatQuad(a.L, z.L, z.T, a.T, a.e, z.e, z.c, a.c, a.s, z.s, z.s, a.s, n2)
      b.flatQuad(a.T, z.T, z.R, a.R, a.c, z.c, z.e, a.e, a.s, z.s, z.s, a.s, n2)
      if (o.lower) {
        b.flatQuad(a.L, a.K, z.K, z.L, shade(a.e, 0.7), shade(a.c, 0.55), shade(z.c, 0.55), shade(z.e, 0.7), a.s, a.s, z.s, z.s, mul(n2, -1))
        b.flatQuad(a.K, a.R, z.R, z.K, shade(a.c, 0.55), shade(a.e, 0.7), shade(z.e, 0.7), shade(z.c, 0.55), a.s, a.s, z.s, z.s, mul(n2, -1))
      }
    }
  }
  if (o.teeth && o.teeth.count > 0) {
    const { count, color, size } = o.teeth
    for (let k = 0; k < count; k++) {
      const t0 = 0.12 + (0.7 * k) / count
      const t1 = t0 + 0.05
      const i0 = Math.min(R, Math.round(t0 * R))
      const i1 = Math.min(R, Math.max(i0 + 1, Math.round(t1 * R)))
      for (const sd of [-1, 1]) {
        const e0 = sd < 0 ? rows[i0].L : rows[i0].R
        const e1 = sd < 0 ? rows[i1].L : rows[i1].R
        const out = mul(right, sd * width * size)
        const tip = add(add(mul(add(e0, e1), 0.5), out), mul(d, length * 0.02))
        b.flatTri(e0, tip, e1, color, shade(color, 1.3), color, rows[i0].s, rows[i0].s, rows[i1].s, add(out, n2))
      }
    }
  }
  if (o.spine) {
    const last = rows[R]
    const prev = rows[R - 1]
    const tip = add(last.ctr, mul(d, length * 0.06))
    const hw = Math.max(prev.w * 0.12, width * 0.02)
    b.flatTri(add(prev.ctr, mul(right, -hw)), add(prev.ctr, mul(right, hw)), tip, o.spine, o.spine, shade(o.spine, 1.4), last.s, last.s, last.s, n2)
    b.flatTri(add(prev.ctr, mul(right, -hw)), tip, add(prev.ctr, mul(right, hw)), o.spine, shade(o.spine, 1.4), o.spine, last.s, last.s, last.s, mul(n2, -1))
  }
}

