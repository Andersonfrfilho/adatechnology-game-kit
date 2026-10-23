import type { GrassTuftSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, mul, dirFromAngles } from '../math'
import { jitter, rgb, shade, tintGreen, mix, lighten } from '../color'
import { blade } from '../geometry/blade'
import { tube } from '../geometry/tube'
import { icoShell } from '../geometry/shell'

export function generateGrassTuft(spec: GrassTuftSpec, ctx: Ctx): ArchResult {
  const rng = ctx.rng
  const over = ctx.condition === 'overgrown'
  const count = Math.round((spec.count ?? 34) * (spec.seedHeads ? 0.75 : 1) * (over ? 1.4 : 1) * ctx.pick(1, 0.55, 0.22))
  const height = (spec.height ?? 0.35) * (over ? 1.3 : 1)
  const radius = spec.radius ?? height * 0.45
  let base = rgb(spec.color ?? 0x6aa646)
  base = tintGreen(base, ctx.condition)
  const dry = ctx.condition === 'dry' || ctx.condition === 'dead'
  const c0 = shade(base, 0.5)
  const c1 = mix(lighten(base, 0.8), [0.85, 0.85, 0.45], dry ? 0.2 : 0.18)
  const segs = ctx.pick(3, 2, 1)
  const wid = height * ctx.pick(0.085, 0.11, 0.15)
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, TAU)
    const d0 = rng.range(0, radius * 0.35)
    const p: Vec3 = [Math.cos(a) * d0, 0, Math.sin(a) * d0]
    const h = height * rng.range(0.55, 1.15) * (1 - d0 / (radius * 1.8))
    const col0 = jitter(c0, rng, 0.01, 0.1, 0.05)
    const col1 = jitter(c1, rng, 0.015, 0.1, 0.06)
    blade(ctx.foliage, p, a + rng.range(-0.3, 0.3), h, wid * rng.range(0.8, 1.2), col0, col1, { segs, lean: rng.range(0.22, 0.7), swayMax: 1, twist: rng.range(-0.4, 0.4) })
  }
  if (spec.seedHeads && ctx.condition !== 'dead') {
    const seed = rgb(spec.seedColor ?? 0xd8c98a)
    const n = Math.max(2, Math.round(count / 7))
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU)
      const d0 = rng.range(0, radius * 0.3)
      const base0: Vec3 = [Math.cos(a) * d0, 0, Math.sin(a) * d0]
      const h = height * rng.range(1.5, 2.0)
      const lean = rng.range(0.1, 0.3)
      const dir = dirFromAngles(a, 1.3)
      const mid = add(base0, add(mul([dir[0], 0, dir[2]], h * lean * 0.5), [0, h * 0.55, 0]))
      const tip = add(base0, add(mul([dir[0], 0, dir[2]], h * lean), [0, h, 0]))
      tube(ctx.foliage, [base0, mid, tip], { sides: 3, radii: [height * 0.012, height * 0.009, height * 0.007], color: (t) => mix(c0, seed, t * 0.9), sway: (t) => 0.4 + 0.6 * t, end: 'none' })
      if (ctx.lod < 2) {
        const head = h * 0.22
        const hc = jitter(seed, rng, 0.01, 0.08, 0.05)
        icoShell(ctx.flowers, { center: add(tip, [dir[0] * head * 0.2, head * 0.35, dir[2] * head * 0.2]), radii: [height * 0.035, head * 0.55, height * 0.035], detail: 0, rng, noise: 0.1, color: (v) => shade(hc, 0.8 + v.h * 0.4), sway: () => 1 })
      }
    }
  }
  return { collider: null, bendable: true }
}
