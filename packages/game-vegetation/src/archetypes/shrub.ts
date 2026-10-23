import type { ShrubSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, clamp, lerp, mul, norm } from '../math'
import { jitter, mix, rgb, shade, tintGreen, lighten } from '../color'
import { Rng } from '../rng'
import { tube } from '../geometry/tube'
import { clump, clumpLeaves } from '../geometry/shell'
import { boxShell } from '../geometry/boxshell'
import { blossom, flowerHead, type FlowerKind } from '../geometry/flower'
import { leaf } from '../geometry/leaf'
import { leafAmount } from './shared'

const DEFAULT_LEAF = [0x3f8a3a, 0x4a9a42, 0x357a38]

export function generateShrub(spec: ShrubSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const shape = spec.shape ?? 'round'
  const over = ctx.condition === 'overgrown'
  const dead = ctx.condition === 'dead'
  const R = (spec.radius ?? 0.6) * (over ? 1.2 : 1)
  const H = (spec.height ?? (shape === 'hedge' ? 1.1 : R * 1.5)) * (over ? 1.15 : 1)
  const density = (spec.density ?? 1) * leafAmount(ctx, false)
  const palette = (spec.leafColor ?? DEFAULT_LEAF).map((c) => tintGreen(rgb(c), ctx.condition))
  const stemC = rgb(spec.stemColor ?? 0x6a4c34)
  const flowers = spec.flowers && !dead && !(ctx.season === 'winter' && rng.fork('w').next() < 0.5)
  const variegation = spec.variegation?.map(rgb)
  const lsize = spec.leafSize ?? 1

  const flowerDots = (center: Vec3, rx: number, ry: number, rz: number, count: number, frng: Rng, crown: Vec3): void => {
    if (!spec.flowers) return
    const fl = spec.flowers
    const colors = fl.colors.map(rgb)
    const size = (fl.size ?? 0.045) * (shape === 'hedge' ? 1 : 1)
    const style = fl.style ?? 'dots'
    for (let i = 0; i < count; i++) {
      const a = frng.range(0, TAU)
      const y = frng.range(0.05, 1)
      const r = Math.sqrt(1 - y * y)
      const d: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r]
      const p: Vec3 = [center[0] + d[0] * rx * 1.0, center[1] + d[1] * ry * 1.0, center[2] + d[2] * rz * 1.0]
      const n = norm(add(d, mul(norm([p[0] - crown[0], p[1] - crown[1], p[2] - crown[2]]), 0.5)))
      const c = frng.pick(colors)
      if (style === 'dots') {
        blossom(ctx.flowers, add(p, mul(n, size * 0.2)), n, size, shade(c, 1.05), jitter(c, frng, 0.01, 0.05), 0.6, ctx.pick(5, 4, 3), frng.range(0, TAU))
      } else if (style === 'clusters') {
        flowerHead(ctx.flowers, { kind: 'bract', center: add(p, mul(n, size * 0.2)), axis: n, size: size * 1.4, colors, centerColor: [1, 1, 1], rng: frng.fork(i), lod: ctx.lod, sway: 0.6 })
      } else {
        flowerHead(ctx.flowers, { kind: (style === 'hibiscus' ? 'hibiscus' : 'bell') as FlowerKind, center: add(p, mul(n, size * 0.1)), axis: n, size: size * 1.6, colors, centerColor: [1, 0.85, 0.3], rng: frng.fork(i), lod: ctx.lod, sway: 0.6 })
      }
    }
  }

  if (shape === 'hedge') {
    const length = spec.length ?? 2.4
    const width = spec.width ?? Math.max(0.6, H * 0.6)
    const sections = Math.max(1, Math.round(length / (width * 1.1)))
    const secLen = length / sections
    const grid = ctx.pick(3, 2, 1)
    const base = dead ? mix(palette[0], [0.42, 0.33, 0.22], 0.65) : ctx.condition === 'dry' ? mix(palette[0], [0.5, 0.45, 0.22], 0.35) : palette[0]
    for (let i = 0; i < sections; i++) {
      const sr = rng.fork(i * 17 + 3)
      const cx = -length / 2 + secLen * (i + 0.5)
      const h = H * sr.range(0.96, 1.04)
      const seed = sr.seed()
      const sect = new Rng(seed)
      const c = jitter(base, sect, 0.01, 0.05, 0.04)
      boxShell(ctx.foliage, {
        center: [cx, h * 0.5, 0],
        size: [secLen * 1.04, h, width],
        grid,
        round: 0.38,
        rng: sect,
        noise: ctx.lod === 0 ? 0.045 : 0.03,
        color: (p, hh, n) => {
          let k = lerp(0.7, 1.15, clamp(hh, 0, 1))
          if (n[1] > 0.5) k *= 1.08
          return mix(shade(c, k), lighten(c, 0.6), clamp((hh - 0.9) * 4, 0, 0.5))
        },
        sway: (hh) => 0.3 * hh,
      })
      if (ctx.lod < 2) {
        // leafy lumps breaking the clipped surface (small low-poly clumps instead of a plain box)
        const nb = ctx.pick(9, 7, 0)
        const br = width * 0.2
        for (let k = 0; k < nb; k++) {
          const onTop = k % 5 < 2
          const px = cx + sr.range(-secLen / 2, secLen / 2) * 0.92
          const pz = sr.range(-width / 2, width / 2) * 0.85
          const side = pz > 0 ? 1 : -1
          const pos: Vec3 = onTop ? [px, h - br * 0.5, pz] : [px, sr.range(0.25, 0.85) * h, side * (width / 2 - br * 0.35)]
          const lr = br * sr.range(0.75, 1.15)
          clump(ctx.foliage, { center: pos, radius: lr, squash: 0.68, detail: 0, seed: sr.seed(), base: shade(c, sr.range(0.84, 0.98)), crown: [cx, h * 0.3, 0], swayK: 0.3, noise: 0.15, flatBottom: 0.2, ao: 0.6 })
        }
      }
      if (ctx.lod === 0) {
        // leaf flecks poking from the clipped surface
        const lc0 = shade(c, 0.75)
        const lc1 = lighten(c, 0.9)
        for (let k = 0; k < 14; k++) {
          const onTop = k % 3 !== 0
          const px = cx + sr.range(-secLen / 2, secLen / 2)
          const pz = sr.range(-width / 2, width / 2) * 0.9
          const pos: Vec3 = onTop ? [px, h * 0.98, pz] : [px, sr.range(0.3, 0.9) * h, (pz > 0 ? 1 : -1) * width * 0.5]
          const n: Vec3 = onTop ? [sr.range(-0.3, 0.3), 1, sr.range(-0.3, 0.3)] : [0, 0.3, pz > 0 ? 1 : -1]
          leaf(ctx.foliage, pos, norm(add(n, [sr.range(-0.4, 0.4), 0, sr.range(-0.4, 0.4)])), n, 0.1 * lsize, 0.08 * lsize, lc0, lc1, { curl: 0.2, swayBase: 0.3, swayTip: 0.5 })
        }
      }
      if (flowers) flowerDots([cx, h * 0.5, 0], secLen * 0.5, h * 0.5, width * 0.5, ctx.pick(8, 5, 0) * Math.round((spec.flowers?.count ?? 10) / 10), sr.fork('f'), [cx, h * 0.3, 0])
    }
    return { collider: null, bendable: true }
  }

  // round / loose: multi stem bush with clumps
  const crownC: Vec3 = [0, H * 0.5, 0]
  const nStems = ctx.pick(6, 4, 3)
  const nClumps = Math.max(3, Math.round(ctx.pick(9, 10, 4) * clamp(density, 0.3, 1.4) * (shape === 'loose' ? 0.9 : 1)))
  const anchors: { p: Vec3; r: number; seed: number }[] = []
  for (let i = 0; i < nClumps; i++) {
    const f = rng.fork(i + 1)
    const a = (i / nClumps) * TAU * 1.0 + f.range(-0.5, 0.5)
    const layer = i % 3
    const rr = R * (layer === 0 ? f.range(0.0, 0.35) : f.range(0.45, 0.8)) * (shape === 'loose' ? 1.15 : 1)
    const y = H * (layer === 0 ? f.range(0.55, 0.8) : layer === 1 ? f.range(0.35, 0.55) : f.range(0.22, 0.4))
    anchors.push({ p: [Math.cos(a) * rr, y, Math.sin(a) * rr], r: R * f.range(0.42, 0.62) * (shape === 'loose' ? 0.9 : 1) * (ctx.lod === 1 ? 0.8 : 1), seed: f.seed() })
  }
  // stems from the ground to the lower clumps
  for (let i = 0; i < nStems; i++) {
    const a = anchors[i % anchors.length]
    const base: Vec3 = [a.p[0] * 0.12, 0, a.p[2] * 0.12]
    const mid: Vec3 = [a.p[0] * 0.5, a.p[1] * 0.5, a.p[2] * 0.5]
    tube(ctx.wood, [base, mid, [a.p[0] * 0.85, a.p[1] * 0.85, a.p[2] * 0.85]], { sides: ctx.pick(5, 4, 3), radii: [R * 0.05, R * 0.04, R * 0.025], color: (t) => shade(stemC, 0.7 + 0.4 * t), sway: (t) => 0.1 + 0.3 * t, end: 'point' })
  }
  anchors.forEach((a, idx) => {
    const crn = idx % 2 === 0
    const base = variegation && crn ? variegation[idx % variegation.length] : palette[idx % palette.length]
    const o = {
      center: a.p,
      radius: a.r,
      squash: shape === 'loose' ? 0.85 : 0.8,
      detail: (ctx.lod === 0 ? 1 : 0) as 0 | 1,
      seed: a.seed,
      base: dead ? mix(base, [0.4, 0.35, 0.27], 0.6) : base,
      crown: crownC,
      leaves: ctx.lod === 0 ? { count: 6 + Math.round(a.r * 8), length: a.r * 0.5 * lsize, width: a.r * 0.4 * lsize } : ctx.lod === 1 ? { count: 2 + Math.round(a.r * 3), length: a.r * 0.55 * lsize, width: a.r * 0.45 * lsize } : undefined,
      swayK: 0.7,
      noise: shape === 'loose' ? 0.3 : 0.2,
      flatBottom: 0.6,
      ao: 0.45,
    }
    clump(ctx.foliage, o)
    if (ctx.lod < 2) clumpLeaves(ctx.foliage, o)
  })
  if (variegation && ctx.lod < 2) {
    // colorful croton leaves: broad leaves in the variegation palette all over the surface
    const vr = rng.fork('vari')
    const n = ctx.pick(36, 14, 0)
    for (let i = 0; i < n; i++) {
      const a = vr.range(0, TAU)
      const y = vr.range(0.15, 1)
      const r = Math.sqrt(1 - y * y)
      const d: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r]
      const p: Vec3 = [d[0] * R * 0.8, H * 0.5 + d[1] * H * 0.42, d[2] * R * 0.8]
      const c = vr.pick(variegation)
      leaf(ctx.foliage, p, norm(add(mul(d, 0.4), [0, 0.8, 0])), d, 0.17 * lsize, 0.1 * lsize, shade(c, 0.75), lighten(c, 0.3), { rows: 2, curl: 0.25, fold: 0.5, swayBase: 0.6, swayTip: 0.9, peak: 0.45 })
    }
  }
  if (flowers && spec.flowers) {
    const fr = rng.fork('flowers')
    const count = Math.round((spec.flowers.count ?? 24) * ctx.pick(1, 0.5, 0))
    flowerDots([0, H * 0.5, 0], R * 1.0, H * 0.52, R * 1.0, count, fr, crownC)
  }
  return { collider: null, bendable: true }
}
