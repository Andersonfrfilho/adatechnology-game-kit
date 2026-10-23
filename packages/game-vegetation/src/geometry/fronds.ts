import type { Lod, Vec3 } from '../types'
import { add, cross, dirFromAngles, lerp, mul, norm } from '../math'
import { shade, mix, jitter } from '../color'
import type { Rng } from '../rng'
import type { MeshBuilder } from './builder'
import { kite, leaf } from './leaf'

export interface PinnateOptions {
  origin: Vec3
  az: number
  /** elevation of the rachis at the base (radians) */
  elev: number
  length: number
  /** gravity droop: fraction of the length lost at the tip */
  droop: number
  /** leaflet length as a fraction of the frond length */
  leafletLen: number
  /** leaflet pairs at lod 0 */
  pairs: number
  c0: Vec3
  c1: Vec3
  lod: Lod
  rng: Rng
  /** sway at base / tip */
  swayBase: number
  swayTip: number
  /** how much leaflets hang down (V shape), default 0.45 */
  hang?: number
  /** leaflet width as a fraction of its length (default 0.2) */
  leafletWidth?: number
}

/** Curved rachis with leaflets on both sides (palm / date / areca frond). Returns the tip. */
export function pinnateFrond(b: MeshBuilder, o: PinnateOptions): Vec3 {
  const horiz = dirFromAngles(o.az, 0)
  const segs = o.lod === 0 ? 8 : o.lod === 1 ? 6 : 4
  const pts: Vec3[] = []
  const ce = Math.cos(o.elev)
  const se = Math.sin(o.elev)
  for (let k = 0; k <= segs; k++) {
    const t = k / segs
    pts.push([o.origin[0] + horiz[0] * o.length * t * ce, o.origin[1] + o.length * (t * se - o.droop * t * t), o.origin[2] + horiz[2] * o.length * t * ce])
  }
  const sideV = norm(cross(horiz, [0, 1, 0]))
  if (o.lod === 2) {
    const mid = pts[Math.floor(segs / 2)]
    leaf(b, o.origin, norm([mid[0] - o.origin[0], mid[1] - o.origin[1] + 0.001, mid[2] - o.origin[2]]), [0, 1, 0], o.length * 1.0, o.length * o.leafletLen * 1.3, o.c0, o.c1, { rows: 3, curl: o.droop * 0.9, fold: 0.5, swayBase: o.swayBase, swayTip: o.swayTip, peak: 0.35, round: 1.2, baseWidth: 0.05 })
    return pts[segs]
  }
  // rachis ribbon
  for (let k = 0; k < segs; k++) {
    const a = pts[k]
    const bq = pts[k + 1]
    const w = o.length * 0.012 * (1 - 0.7 * (k / segs))
    const t0 = k / segs
    const t1 = (k + 1) / segs
    const s0 = lerp(o.swayBase, o.swayTip, t0)
    const s1 = lerp(o.swayBase, o.swayTip, t1)
    const rc = shade(o.c0, 0.75)
    b.flatQuad(add(a, mul(sideV, -w)), add(a, mul(sideV, w)), add(bq, mul(sideV, w * 0.8)), add(bq, mul(sideV, -w * 0.8)), rc, rc, shade(o.c0, 0.9), shade(o.c0, 0.9), s0, s0, s1, s1, [0, 1, 0])
  }
  const pairs = o.lod === 0 ? o.pairs : Math.max(4, Math.round(o.pairs * (o.lod === 1 ? 0.33 : 0.5)))
  const hang = o.hang ?? 0.45
  const lw = o.leafletWidth ?? 0.2
  for (let k = 0; k < pairs; k++) {
    const t = lerp(0.14, 0.98, k / Math.max(1, pairs - 1))
    const f = t * segs
    const idx = Math.min(segs - 1, Math.floor(f))
    const u = f - idx
    const p: Vec3 = [lerp(pts[idx][0], pts[idx + 1][0], u), lerp(pts[idx][1], pts[idx + 1][1], u), lerp(pts[idx][2], pts[idx + 1][2], u)]
    const d = norm([pts[idx + 1][0] - pts[idx][0], pts[idx + 1][1] - pts[idx][1], pts[idx + 1][2] - pts[idx][2]])
    const prof = Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.85)) ** 0.85
    const len = o.length * o.leafletLen * prof * (o.lod === 0 ? 1 : 1.5) * (0.9 + o.rng.next() * 0.2)
    const sw = lerp(o.swayBase, o.swayTip, t)
    const cc0 = jitter(o.c0, o.rng, 0.008, 0.05, 0.03)
    const cc1 = jitter(o.c1, o.rng, 0.008, 0.05, 0.03)
    for (const s of [-1, 1]) {
      const dir = norm(add(add(mul(sideV, s * 0.85), mul(d, 0.6)), [0, -hang, 0]))
      kite(b, p, dir, [0, 1, 0], len, len * lw * (o.lod === 0 ? 1 : o.lod === 1 ? 2.1 : 1.7), mix(cc0, cc1, 0.1), cc1, sw, Math.min(1, sw + 0.1))
    }
  }
  return pts[segs]
}
