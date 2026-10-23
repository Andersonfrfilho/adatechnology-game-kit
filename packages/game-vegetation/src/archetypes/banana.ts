import type { BananaSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, catmull, dirFromAngles, mul, norm } from '../math'
import { jitter, mix, rgb, shade, tintGreen, lighten } from '../color'
import { tube } from '../geometry/tube'
import { leaf } from '../geometry/leaf'
import { icoShell } from '../geometry/shell'

export function generateBanana(spec: BananaSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const dead = ctx.condition === 'dead'
  const dry = ctx.condition === 'dry'
  const over = ctx.condition === 'overgrown'
  const H = (spec.height ?? 3.6) * (over ? 1.12 : 1)
  const stemH = H * 0.5
  const R = H * 0.04
  const leafBase = tintGreen(rgb(spec.leafColor ?? 0x66a83e), ctx.condition)
  const nLeaves = Math.round((spec.leafCount ?? 8) * (dead ? 0.5 : over ? 1.2 : 1))
  const tornShare = spec.torn ?? (dry ? 0.9 : 0.5)
  const stemC = mix(rgb(0x9cb86a), tintGreen(rgb(0x9cb86a), ctx.condition), 1)

  // pseudostem: leaf sheaths read as bands and flares
  const ctrl: Vec3[] = []
  const lean = rng.range(-0.05, 0.05)
  for (let i = 0; i <= 4; i++) {
    const t = i / 4
    ctrl.push([lean * stemH * t * t, stemH * t, Math.sin(t * 2.5) * 0.02])
  }
  const full = catmull(ctrl, ctx.pick(5, 3, 1))
  const radii = full.map((_, i) => {
    const t = i / (full.length - 1)
    return R * (1 - 0.3 * t) * (1 + 0.45 * Math.exp(-t * 14)) * (1 + 0.04 * Math.cos(t * 26))
  })
  tube(ctx.wood, full, {
    sides: ctx.pick(9, 6, 5),
    radii,
    color: (t, a) => {
      const sheath = 0.86 + 0.14 * Math.cos(t * 26)
      const stripe = 0.93 + 0.07 * Math.cos(a * TAU * 4)
      let c = shade(stemC, sheath * stripe * (0.7 + 0.3 * Math.min(1, t * 5)))
      c = mix(c, [0.55, 0.4, 0.22], Math.max(0, 0.18 - t) * 2.2)
      if (dead) c = mix(c, [0.45, 0.36, 0.22], 0.7)
      return c
    },
    sway: (t) => 0.04 * t,
    end: 'flat',
  })
  const top = full[full.length - 1]
  ctx.piece('crown', 'crown', 'trunk')

  // leaves
  const rows = ctx.pick(9, 6, 3)
  for (let i = 0; i < nLeaves; i++) {
    const f = rng.fork(i)
    const ring = i % 3
    const az = (i / nLeaves) * TAU * 1.0 + f.range(-0.25, 0.25)
    const L = H * f.range(0.55, 0.72) * (ring === 2 ? 0.85 : 1)
    const el = [1.15, 0.8, 0.45][ring] + f.range(-0.12, 0.12)
    const horiz = dirFromAngles(az, 0)
    // petiole: a short stalk before the blade
    const petL = L * 0.18
    const pEnd: Vec3 = [top[0] + horiz[0] * petL * Math.cos(el), top[1] + petL * Math.sin(el), top[2] + horiz[2] * petL * Math.cos(el)]
    tube(ctx.foliage, [top, pEnd], { sides: 3, radii: [R * 0.22, R * 0.15], color: () => shade(leafBase, 0.85), sway: () => 0.2, end: 'none' })
    const torn = f.next() < tornShare || dead
    const c0 = dead ? mix(leafBase, [0.4, 0.32, 0.2], 0.85) : jitter(shade(leafBase, 0.7), f, 0.01, 0.06, 0.04)
    const c1 = dead ? mix(leafBase, [0.5, 0.42, 0.25], 0.8) : mix(jitter(lighten(leafBase, 0.5), f, 0.012, 0.06, 0.04), [0.75, 0.85, 0.35], 0.15)
    const tearSeed = f.range(0, 10)
    leaf(ctx.foliage, pEnd, norm([horiz[0] * Math.cos(el), Math.sin(el), horiz[2] * Math.cos(el)]), [0, 1, 0], L, L * 0.34, c0, c1, {
      rows,
      curl: [0.55, 0.7, 0.8][ring] * (dry ? 1.2 : 1),
      fold: 0.35,
      swayBase: 0.25,
      swayTip: 1,
      peak: 0.45,
      round: 0.5,
      baseWidth: 0.12,
      tear: torn ? (row, side) => (row % 2 === 1 && row > 1 && row < rows ? 0.35 + 0.35 * Math.abs(Math.sin(tearSeed + row * 1.3 + side)) : 1) : undefined,
    })
  }

  // bunch and bud
  if (spec.bunch && !dead && ctx.lod < 2) {
    const out = dirFromAngles(rng.range(0, TAU), 0)
    const stalk: Vec3[] = [add(top, [0, -0.05, 0]), add(top, add(mul(out, R * 1.6), [0, -0.2, 0])), add(top, add(mul(out, R * 2.2), [0, -0.7, 0])), add(top, add(mul(out, R * 2.1), [0, -1.1, 0]))]
    const sp = catmull(stalk, 2)
    tube(ctx.wood, sp, { sides: 4, radii: sp.map(() => R * 0.2), color: () => [0.35, 0.45, 0.2], sway: (t) => 0.15 + 0.3 * t, end: 'none' })
    const hands = ctx.pick(5, 3, 0)
    const fingers = ctx.pick(7, 4, 0)
    const green = rgb(0x86b04a)
    const yellow = rgb(0xc8c24a)
    const frng = rng.fork('bunch')
    ctx.fruitItem(() => {
      for (let h = 0; h < hands; h++) {
        const t = 0.45 + (0.5 * h) / Math.max(1, hands - 1)
        const idx = Math.min(sp.length - 1, Math.floor(t * (sp.length - 1)))
        const base = sp[idx]
        const ha = h * 1.9
        for (let k = 0; k < fingers; k++) {
          const a = ha + (k / fingers) * 2.4 - 1.2
          const dirOut = dirFromAngles(a, -0.9)
          const fl = 0.16
          const center = add(base, add(mul(dirOut, fl * 0.55 + R * 0.35), [0, -0.02, 0]))
          icoShell(ctx.fruit, {
            center,
            radii: [0.026, fl * 0.55, 0.026],
            detail: 0,
            rng: frng,
            noise: 0.04,
            color: (v) => mix(shade(green, 0.75), mix(green, yellow, 0.3), v.h),
            sway: () => 0.2,
          })
        }
      }
    })
    if (spec.bud) {
      const end = sp[sp.length - 1]
      const bc = rgb(0x7a2a62)
      icoShell(ctx.flowers, { center: add(end, [0, -0.17, 0]), radii: [0.08, 0.18, 0.08], detail: ctx.pick(1, 0, 0) as 0 | 1, rng: frng, noise: 0.05, color: (v) => mix(shade(bc, 0.6), lighten(bc, 0.5), v.h), sway: () => 0.3 })
    }
  } else if (spec.bud && !dead && ctx.lod < 2) {
    const bc = rgb(0x7a2a62)
    icoShell(ctx.flowers, { center: add(top, [0.1, 0.15, 0]), radii: [0.08, 0.18, 0.08], detail: 0, rng: rng.fork('bud'), noise: 0.05, color: (v) => mix(shade(bc, 0.6), lighten(bc, 0.5), v.h), sway: () => 0.3 })
  }
  return { collider: { kind: 'cylinder', radius: R * 1.05, height: stemH * 0.9 }, bendable: true }
}
