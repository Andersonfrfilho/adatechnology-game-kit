import type { FernSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, cross, dirFromAngles, mul, norm, lerp } from '../math'
import { jitter, rgb, shade, tintGreen, mix } from '../color'
import { leaf, kite } from '../geometry/leaf'

export function generateFern(spec: FernSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const over = ctx.condition === 'overgrown'
  const n = Math.round((spec.frondCount ?? 11) * (ctx.condition === 'dead' ? 0.6 : 1) * (over ? 1.3 : 1) * ctx.pick(1, 0.7, 0.35))
  const L0 = (spec.frondLength ?? 0.7) * (over ? 1.15 : 1)
  const base = tintGreen(rgb(spec.color ?? 0x468f3c), ctx.condition)
  const c0 = shade(base, 0.62)
  const c1 = mix(shade(base, 1.12), [0.7, 0.85, 0.3], 0.15)
  const pairs = ctx.pick(11, 6, 0)
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + rng.range(-0.3, 0.3)
    const L = L0 * rng.range(0.7, 1.1) * (i % 3 === 0 ? 1.1 : 0.85)
    const e0 = rng.range(0.5, 1.15) * (i % 2 ? 0.8 : 1.1)
    const droop = rng.range(0.45, 0.9) * (ctx.condition === 'dry' ? 1.3 : 1)
    const horiz = dirFromAngles(az, 0)
    const pts: Vec3[] = []
    const segs = 6
    for (let k = 0; k <= segs; k++) {
      const t = k / segs
      pts.push([horiz[0] * L * t * Math.cos(e0) * 0.9 + 0.0, 0.04 + L * t * Math.sin(e0) - L * t * t * droop, horiz[2] * L * t * Math.cos(e0) * 0.9])
    }
    if (ctx.lod === 2) {
      leaf(ctx.foliage, pts[0], norm([pts[4][0] - pts[0][0], pts[4][1] - pts[0][1], pts[4][2] - pts[0][2]]), [0, 1, 0], L * 1.0, L * 0.34, c0, c1, { rows: 3, curl: 0.5, fold: 0.2, swayBase: 0.2, swayTip: 1, peak: 0.4, round: 1.3 })
      continue
    }
    // rachis as a thin ribbon
    for (let k = 0; k < segs; k++) {
      const a = pts[k]
      const bq = pts[k + 1]
      const d = norm([bq[0] - a[0], bq[1] - a[1], bq[2] - a[2]])
      const side = norm(cross(d, [0, 1, 0]))
      const w = L * 0.012 * (1 - k / segs)
      const t0 = k / segs
      const t1 = (k + 1) / segs
      const rc0 = shade(c0, 0.8 + 0.2 * t0)
      const rc1 = shade(c0, 0.8 + 0.2 * t1)
      ctx.foliage.flatQuad(add(a, mul(side, -w)), add(a, mul(side, w)), add(bq, mul(side, w * 0.8)), add(bq, mul(side, -w * 0.8)), rc0, rc0, rc1, rc1, 0.2 + 0.7 * t0, 0.2 + 0.7 * t0, 0.2 + 0.7 * t1, 0.2 + 0.7 * t1, [0, 1, 0])
    }
    if (pairs === 0) continue
    for (let k = 0; k < pairs; k++) {
      const t = lerp(0.1, 0.97, k / (pairs - 1))
      const f = t * segs
      const idx = Math.min(segs - 1, Math.floor(f))
      const u = f - idx
      const p: Vec3 = [lerp(pts[idx][0], pts[idx + 1][0], u), lerp(pts[idx][1], pts[idx + 1][1], u), lerp(pts[idx][2], pts[idx + 1][2], u)]
      const d = norm([pts[idx + 1][0] - pts[idx][0], pts[idx + 1][1] - pts[idx][1], pts[idx + 1][2] - pts[idx][2]])
      const side = norm(cross(d, [0, 1, 0]))
      const len = L * 0.2 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.12)) * (0.8 + rng.next() * 0.3)
      const col0 = jitter(c0, rng, 0.01, 0.06, 0.04)
      const col1 = jitter(c1, rng, 0.01, 0.06, 0.04)
      for (const s of [-1, 1]) {
        const dir = norm(add(add(mul(side, s * 0.95), mul(d, 0.6)), [0, -0.28, 0]))
        kite(ctx.foliage, p, dir, [0, 1, 0], len, len * 0.5, col0, col1, 0.3 + 0.6 * t, 0.4 + 0.6 * t)
      }
    }
  }
  return { collider: null, bendable: true }
}
