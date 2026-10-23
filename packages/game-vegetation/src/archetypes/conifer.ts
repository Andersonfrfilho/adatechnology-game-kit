import type { ConiferSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, catmull, dirFromAngles, lerp, mul } from '../math'
import { jitter, mix, rgb, shade, tintGreen, lighten } from '../color'
import { tube } from '../geometry/tube'
import { leaf } from '../geometry/leaf'
import { barkColor } from '../geometry/wood'

export function generateConifer(spec: ConiferSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const shape = spec.shape ?? 'cone'
  const dead = ctx.condition === 'dead'
  const over = ctx.condition === 'overgrown'
  const H = (spec.height ?? (shape === 'candelabra' ? 14 : 9)) * (over ? 1.08 : 1)
  const R = spec.radius ?? H * (shape === 'candelabra' ? 0.2 : 0.24)
  const trunkR = spec.trunkRadius ?? H * 0.02
  const leafBase = tintGreen(rgb(spec.leafColor ?? (shape === 'candelabra' ? 0x3d6e3a : 0x2f6e3a)), ctx.condition)
  const bark = rgb(spec.barkColor ?? (shape === 'candelabra' ? 0x6a5442 : 0x6b4b34))
  const tiers = spec.tiers ?? (shape === 'candelabra' ? 6 : 9)
  const lean = rng.range(-0.02, 0.02) * H
  const trunkTop = shape === 'candelabra' ? H : H * 0.96
  const ctrl: Vec3[] = []
  for (let i = 0; i <= 4; i++) {
    const t = i / 4
    ctrl.push([lean * t * t, trunkTop * t, Math.sin(t * 3 + 1) * 0.01 * H])
  }
  const tp = catmull(ctrl, ctx.pick(3, 2, 1))
  const tr = tp.map((_, i) => {
    const t = i / (tp.length - 1)
    return trunkR * (1 - 0.7 * t) * (1 + 0.5 * Math.exp(-t * 20))
  })
  tube(ctx.wood, tp, { sides: ctx.pick(8, 6, 4), radii: tr, color: barkColor(bark, 0), sway: () => 0.02, end: 'point' })

  if (shape === 'cone') {
    const foliage = ctx.foliage
    const K = ctx.pick(10, 8, 6)
    const startY = H * (dead ? 0.35 : 0.14)
    for (let i = 0; i < tiers; i++) {
      const f = tiers === 1 ? 0 : i / (tiers - 1)
      const y = lerp(startY, H * 0.9, f)
      const tierH = (H * 0.9 - startY) / tiers * 1.9
      const r = R * lerp(1, 0.14, Math.pow(f, 0.95)) * (1 + (i % 2) * 0.06)
      const col = jitter(leafBase, rng.fork(i), 0.012, 0.06, 0.04)
      const lightTop = mix(lighten(col, 1.0), [0.75, 0.88, 0.5], 0.2)
      const dark = shade(col, 0.62)
      const apex: Vec3 = [lean * (y / H) ** 2, y + tierH * 0.55, 0]
      const innerR = r * 0.32
      const ring = (rad: number, yy: number, k: number, ph: number): Vec3 => [apex[0] + Math.cos((k / K) * TAU + ph) * rad, yy, Math.sin((k / K) * TAU + ph) * rad]
      const tphase = i * 0.7
      for (let k = 0; k < K; k++) {
        const jag = k % 2 === 0 ? 1 : 0.78
        const a0 = ring(innerR, y + tierH * 0.12, k, tphase)
        const a1 = ring(innerR, y + tierH * 0.12, k + 1, tphase)
        const o0 = ring(r * jag, y - tierH * 0.42, k, tphase)
        const o1 = ring(r * (k % 2 === 0 ? 0.78 : 1), y - tierH * 0.42, k + 1, tphase)
        const sw = 0.25 + 0.35 * (1 - f)
        // top surface
        foliage.flat(apex, a1, a0, shade(lightTop, 0.85), 0.2, [0, 1, 0])
        foliage.flatTri(a0, a1, o1, mix(col, lightTop, 0.2), mix(col, lightTop, 0.2), lightTop, 0.2, 0.2, sw, [0, 1, 0])
        foliage.flatTri(a0, o1, o0, mix(col, lightTop, 0.2), lightTop, lightTop, 0.2, sw, sw, [0, 1, 0])
        // underside, dark
        foliage.flatTri(a0, o0, o1, dark, shade(dark, 1.1), shade(dark, 1.1), 0.2, sw, sw, [0, -1, 0])
        foliage.flatTri(a0, o1, a1, dark, shade(dark, 1.1), dark, 0.2, sw, 0.2, [0, -1, 0])
      }
      if (ctx.lod === 0) {
        // drooping branchlets poking out of the skirt
        const nb = 8
        for (let k = 0; k < nb; k++) {
          const ang = (k / nb) * TAU + tphase * 0.5 + rng.fork(i * 9 + k).range(0, 0.5)
          const d = dirFromAngles(ang, -0.35)
          leaf(foliage, [apex[0] + Math.cos(ang) * r * 0.55, y - tierH * 0.2, apex[2] + Math.sin(ang) * r * 0.55], d, [0, 1, 0], r * 0.55, r * 0.22, shade(col, 0.7), lightTop, { rows: 2, curl: 0.45, fold: 0.5, swayBase: 0.3, swayTip: 0.7, peak: 0.4 })
        }
      }
    }
  } else {
    // candelabra (araucaria): whorls of upturned branches carrying thick needle sleeves
    const whorls = Math.max(3, Math.min(tiers, ctx.pick(5, 4, 3)))
    const perWhorl = ctx.pick(8, 6, 5)
    for (let w = 0; w < whorls; w++) {
      const f = whorls === 1 ? 1 : w / (whorls - 1)
      const y = lerp(H * 0.66, H * 0.9, f)
      const len = R * lerp(1.15, 0.6, f)
      const topY = H * lerp(0.93, 1.0, f)
      for (let k = 0; k < perWhorl; k++) {
        const fr = rng.fork(w * 31 + k)
        const az = (k / perWhorl) * TAU + w * 0.9 + fr.range(-0.2, 0.2)
        const out = dirFromAngles(az, 0)
        const start: Vec3 = [lean * (y / H) ** 2, y, 0]
        const rise = Math.max(0.5, topY - y)
        const p1 = add(start, add(mul(out, len * 0.4), [0, rise * 0.02, 0]))
        const p2 = add(start, add(mul(out, len * 0.75), [0, rise * 0.22, 0]))
        const p3 = add(start, add(mul(out, len * 1.0), [0, rise * 0.95, 0]))
        const path = catmull([start, p1, p2, p3], ctx.pick(2, 1, 1))
        const n = path.length
        if (ctx.lod < 2) tube(ctx.wood, path, { sides: ctx.pick(4, 3, 3), radii: path.map((_, i) => trunkR * 0.35 * (1 - 0.6 * (i / (n - 1)))), color: barkColor(bark, 1), sway: (t) => 0.1 + 0.2 * t, end: 'none' })
        const col = jitter(leafBase, fr, 0.012, 0.08, 0.05)
        const sleeve = path.slice(Math.floor(n * 0.2))
        const sr = Math.max(0.12, R * 0.085 * lerp(1, 0.85, f))
        tube(ctx.foliage, sleeve, {
          sides: ctx.pick(6, 5, 4),
          radii: sleeve.map((_, i) => sr * (0.55 + 0.45 * Math.sin(Math.min(1, (i + 0.5) / (sleeve.length - 0.5)) * Math.PI * 0.9 + 0.3))),
          color: (t, a) => mix(shade(col, 0.55), lighten(col, 0.7), clamp01(0.4 * t + 0.6 * (0.5 + 0.5 * Math.sin(a * TAU)))),
          sway: (t) => 0.2 + 0.4 * t,
          end: 'point',
          smooth: false,
          rough: ctx.lod === 0 ? (_r, i) => (i % 2 ? 0.28 : -0.12) : undefined,
        })
      }
    }
    // leader tuft
    tube(ctx.foliage, [[lean, H * 0.93, 0], [lean, H * 1.02, 0]], { sides: 5, radii: [R * 0.07, R * 0.03], color: () => shade(leafBase, 0.9), sway: () => 0.2, end: 'point' })
  }
  return { collider: { kind: 'cylinder', radius: trunkR * 1.2, height: H * 0.6 }, bendable: false }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
