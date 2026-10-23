import type { VineSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { add, catmull, lerp, mul, norm, sampleLine, TAU, sub, cross } from '../math'
import { jitter, mix, rgb, shade, tintGreen, lighten } from '../color'
import { tube } from '../geometry/tube'
import { leaf } from '../geometry/leaf'
import { flowerHead } from '../geometry/flower'

/** Climbing plant along a host polyline or a wall rectangle in the xy plane facing +z. */
export function generateVine(spec: VineSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const dead = ctx.condition === 'dead'
  const over = ctx.condition === 'overgrown'
  const host = spec.host ?? { wall: { width: 2.5, height: 2.2 } }
  const base = tintGreen(rgb(spec.leafColor ?? 0x3f8a3a), ctx.condition)
  const stemC = rgb(spec.stemColor ?? 0x5a4630)
  const lsize = spec.leafSize ?? 1
  const density = (spec.density ?? 1) * (over ? 1.5 : 1) * (dead ? 0.15 : ctx.condition === 'dry' ? 0.6 : 1)
  const c0 = shade(base, 0.65)
  const c1 = mix(lighten(base, 0.5), [0.7, 0.85, 0.4], 0.1)

  const stems: Vec3[][] = []
  if ('path' in host) {
    const pts = host.path
    const nStems = 2
    for (let s = 0; s < nStems; s++) {
      const off = rng.range(0.02, 0.06)
      const wob = rng.range(0, TAU)
      const path = pts.map((p, i) => add(p, [Math.sin(i * 1.7 + wob + s * 2) * off, Math.cos(i * 1.3 + wob) * off, Math.sin(i * 0.9 + s) * off]))
      stems.push(catmull(path, ctx.pick(2, 1, 1)))
    }
  } else {
    const W = host.wall.width
    const Hh = host.wall.height
    const n = Math.max(2, Math.round(W / 0.7))
    for (let i = 0; i < n; i++) {
      const x0 = -W / 2 + (W * (i + 0.5)) / n + rng.range(-0.1, 0.1)
      const topY = Hh * rng.range(0.55, 0.98) * (over ? 1 : 0.92)
      const ctrl: Vec3[] = [[x0, 0, 0.03]]
      let x = x0
      for (let k = 1; k <= 5; k++) {
        x += rng.range(-0.18, 0.18)
        ctrl.push([clamp(x, -W / 2, W / 2), (topY * k) / 5, 0.03 + rng.range(0, 0.02)])
      }
      const main = catmull(ctrl, ctx.pick(2, 1, 1))
      stems.push(main)
      // side branches spreading across the wall
      const nb = Math.round(rng.range(2, 3.5) * (over ? 1.4 : 1))
      for (let b = 0; b < nb; b++) {
        const t = rng.range(0.25, 0.85)
        const s = sampleLine(main, t)
        const dir = rng.sign()
        const len = W * rng.range(0.18, 0.4)
        const end: Vec3 = [clamp(s.p[0] + dir * len, -W / 2, W / 2), Math.min(Hh, s.p[1] + rng.range(0.05, 0.35)), 0.035]
        const mid: Vec3 = [lerp(s.p[0], end[0], 0.5), lerp(s.p[1], end[1], 0.5) + rng.range(-0.08, 0.08), 0.04]
        stems.push(catmull([s.p, mid, end], ctx.pick(2, 1, 1)))
      }
    }
  }
  // draw stems and leaves
  const flowers = spec.flowers && !dead
  for (let si = 0; si < stems.length; si++) {
    const st = stems[si]
    const n = st.length
    tube(ctx.wood, st, { sides: 3, radii: st.map((_, i) => (si < 3 ? 0.014 : 0.009) * (1 - 0.5 * (i / (n - 1)))), color: (t) => shade(stemC, 0.8 + 0.4 * t), sway: (t) => 0.1 + 0.3 * t, end: 'point' })
    const spacing = 0.16 / Math.max(0.2, density)
    let length = 0
    for (let i = 1; i < n; i++) length += Math.hypot(...(sub(st[i], st[i - 1]) as Vec3))
    const count = Math.max(0, Math.round((length / spacing) * ctx.pick(1, 0.4, 0.2)))
    const lrng = rng.fork(si + 100)
    for (let k = 0; k < count; k++) {
      const t = (k + lrng.range(0.1, 0.9)) / count
      const s = sampleLine(st, t)
      const side = k % 2 ? 1 : -1
      const hostNormal: Vec3 = 'path' in host ? norm(cross(s.d, [0, 1, 0.01])) : [0, 0, 1]
      const lateral = norm(cross(hostNormal, s.d))
      const dir = norm(add(add(mul(lateral, side * 0.9), mul(s.d, lrng.range(0.0, 0.5))), mul(hostNormal, 0.35)))
      const len = 0.17 * lsize * lrng.range(0.8, 1.3)
      const cc0 = jitter(c0, lrng, 0.012, 0.07, 0.04)
      const cc1 = jitter(c1, lrng, 0.012, 0.07, 0.04)
      leaf(ctx.foliage, add(s.p, mul(hostNormal, 0.01)), dir, hostNormal, len, len * 0.9, dead ? [0.4, 0.34, 0.24] : cc0, dead ? [0.5, 0.42, 0.28] : cc1, { rows: 2, curl: 0.15, fold: 0.4, swayBase: 0.3, swayTip: 0.8, peak: 0.4, round: 0.6, baseWidth: 0.2 })
      if (flowers && spec.flowers && lrng.next() < (0.16 * (spec.flowers.count ?? 12)) / 12 * ctx.pick(1, 0.6, 0)) {
        const cols = spec.flowers.colors.map(rgb)
        const sz = spec.flowers.style === 'passion' ? 0.06 : 0.055
        flowerHead(ctx.flowers, {
          kind: spec.flowers.style === 'passion' ? 'passion' : 'bract',
          center: add(s.p, mul(hostNormal, 0.05)),
          axis: norm(add(hostNormal, [lrng.range(-0.3, 0.3), 0.2, lrng.range(-0.3, 0.3)])),
          size: sz * lrng.range(0.9, 1.3),
          colors: cols,
          centerColor: [1, 1, 1],
          rng: lrng.fork(k),
          lod: ctx.lod,
          sway: 0.6,
        })
      }
    }
  }
  return { collider: null, bendable: true }
}

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v)
