import type { GlobeCactusSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, norm } from '../math'
import { mix, rgb, shade, tintFlesh, lighten } from '../color'
import { ribbedTube } from '../geometry/tube'
import { spineTuft, areole } from '../geometry/spines'
import { icoShell } from '../geometry/shell'
import { blossom } from '../geometry/flower'

export function generateGlobeCactus(spec: GlobeCactusSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const srng = rng.fork('spines')
  const R = (spec.radius ?? 0.28) * (ctx.condition === 'overgrown' ? 1.1 : 1)
  const H = spec.height ?? R * 2.0
  const ribs = spec.ribs ?? 13
  const base = tintFlesh(rgb(spec.color ?? 0x5c9a58), ctx.condition)
  const spineC = rgb(spec.spineColor ?? 0xf0d890)
  const rings = ctx.pick(7, 5, 3)
  const path: Vec3[] = []
  const radii: number[] = []
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1)
    path.push([0, H * 0.9 * t, 0])
    // barrel profile: narrow at the soil line, full at 45%, rounding in at the top
    radii.push(R * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.2 + 0.1) * Math.PI * 0.62) ** 0.7) * (t > 0.85 ? 1 - (t - 0.85) * 1.2 : 1))
  }
  const res = ribbedTube(ctx.foliage, path, {
    ribs,
    radii,
    valley: 0.7,
    dome: ctx.pick(2, 1, 1),
    color: (t, ridge, rib) => {
      const k = (ridge ? 1.08 : 0.68) * (0.75 + 0.3 * t) * (rib % 2 ? 0.97 : 1.03)
      return shade(base, k)
    },
    sway: () => 0,
    rough: (ring, rib) => Math.sin(ring * 2.1 + rib * 1.3) * 0.02,
  })
  if (ctx.lod === 0) {
    for (const rd of res.ridges) {
      if (rd.ring === 0 || rd.t > 0.9) continue
      areole(ctx.spines, rd.p, rd.n, R * 0.08, [0.3, 0.25, 0.18])
      spineTuft(ctx.spines, rd.p, add(rd.n, [0, 0.1, 0]), 5, R * 0.42, spineC, srng)
    }
  }
  const topY = H * 0.9 + R * 0.2
  if (spec.cephalium && ctx.lod < 2) {
    // cap of the crown cactus: red hairy dome with white bristles
    const cc = rgb(spec.cephalium.color)
    const capR = radii[radii.length - 1] * 0.95 + R * 0.12
    icoShell(ctx.fruit, {
      center: [0, H * 0.9 + R * 0.02, 0],
      radii: [capR, R * 0.45, capR],
      detail: ctx.pick(1, 0, 0) as 0 | 1,
      rng: srng,
      noise: 0.08,
      color: (v) => mix(shade(cc, 0.7), mix(lighten(cc, 0.3), [0.95, 0.9, 0.85], 0.35), v.h),
      sway: () => 0,
    })
    if (ctx.lod === 0) {
      for (let i = 0; i < 14; i++) {
        const a = srng.range(0, TAU)
        const rr = Math.sqrt(srng.next()) * capR * 0.8
        const y = H * 0.9 + R * 0.02 + R * 0.45 * Math.sqrt(Math.max(0, 1 - (rr / capR) ** 2))
        spineTuft(ctx.spines, [Math.cos(a) * rr, y, Math.sin(a) * rr], [0, 1, 0], 3, R * 0.22, [0.96, 0.9, 0.8], srng)
      }
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1
        const rr = capR * 0.3
        blossom(ctx.flowers, [Math.cos(a) * rr, H * 0.9 + R * 0.48, Math.sin(a) * rr], [0, 1, 0], R * 0.14, [0.95, 0.4, 0.6], [1, 0.9, 0.5], 0, 5, a)
      }
    }
  } else if (spec.flowers && ctx.condition !== 'dead' && ctx.lod < 2) {
    const fc = rgb(spec.flowers.color)
    const n = spec.flowers.count ?? 6
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU
      const rr = radii[radii.length - 1] * 0.62
      const p: Vec3 = [Math.cos(a) * rr, topY - R * 0.1, Math.sin(a) * rr]
      blossom(ctx.flowers, p, norm([Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4]), R * 0.22, fc, [0.95, 0.8, 0.3], 0, 8, a)
    }
  }
  return { collider: { kind: 'cylinder', radius: R * 1.0, height: H }, bendable: false, thorny: true, foliageMaterial: 'cactus' }
}
