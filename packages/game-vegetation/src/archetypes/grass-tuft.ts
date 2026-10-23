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
  const count = Math.round((spec.count ?? 34) * (spec.seedHeads ? 0.75 : 1) * (spec.umbrellaHeads ? 0.2 : 1) * (over ? 1.4 : 1) * ctx.pick(1, 0.55, 0.22))
  const height = (spec.height ?? 0.35) * (over ? 1.3 : 1)
  const bladeH = spec.umbrellaHeads ? height * 0.35 : height
  const radius = spec.radius ?? height * 0.45
  let base = rgb(spec.color ?? 0x6aa646)
  base = tintGreen(base, ctx.condition)
  const dry = ctx.condition === 'dry' || ctx.condition === 'dead'
  const c0 = shade(base, 0.5)
  const c1 = mix(lighten(base, 0.8), [0.85, 0.85, 0.45], dry ? 0.2 : 0.18)
  const segs = ctx.pick(3, 2, 1)
  const wid = Math.max(0.018, height * ctx.pick(0.13, 0.16, 0.2))
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, TAU)
    const d0 = rng.range(0, radius * 0.35)
    const p: Vec3 = [Math.cos(a) * d0, 0, Math.sin(a) * d0]
    const h = bladeH * rng.range(0.55, 1.15) * (1 - d0 / (radius * 1.8))
    // colour variation: some blades yellower, some darker
    const v = rng.next()
    const tone = v < 0.2 ? mix(c1, [0.78, 0.78, 0.32], 0.45) : v > 0.8 ? shade(c1, 0.8) : c1
    const col0 = jitter(v > 0.8 ? shade(c0, 0.85) : c0, rng, 0.012, 0.12, 0.06)
    const col1 = jitter(tone, rng, 0.02, 0.12, 0.07)
    blade(ctx.foliage, p, a + rng.range(-0.3, 0.3), h, wid * rng.range(0.8, 1.35), col0, col1, { segs, lean: rng.range(0.22, 0.7), swayMax: 1, twist: rng.range(-0.4, 0.4) })
  }
  if (spec.umbrellaHeads) {
    // papyrus: bare triangular stems, each topped by an umbrella of thin arching rays
    const ns = Math.max(3, Math.round((spec.count ?? 18) * 0.36 * ctx.pick(1, 0.6, 0.35)))
    const ray = ctx.pick(11, 7, 4)
    const gc = shade(base, 0.9)
    for (let i = 0; i < ns; i++) {
      const a = rng.range(0, TAU)
      const d0 = rng.range(0, radius * 0.6)
      const b0: Vec3 = [Math.cos(a) * d0, 0, Math.sin(a) * d0]
      const h = height * rng.range(0.85, 1.2)
      const la = rng.range(0, TAU)
      const lean = h * rng.range(0.03, 0.12) * (1 + d0 / radius)
      const top: Vec3 = [b0[0] + Math.cos(la) * lean, h, b0[2] + Math.sin(la) * lean]
      const mid: Vec3 = [b0[0] + Math.cos(la) * lean * 0.3, h * 0.5, b0[2] + Math.sin(la) * lean * 0.3]
      tube(ctx.foliage, [b0, mid, top], { sides: 3, radii: [height * 0.011, height * 0.009, height * 0.007], color: (t) => mix(shade(gc, 0.75), lighten(gc, 0.5), t), sway: (t) => 0.3 + 0.7 * t * t, end: 'none' })
      for (let k = 0; k < ray; k++) {
        const ra = (k / ray) * TAU + rng.range(-0.2, 0.2)
        const len = height * rng.range(0.2, 0.3)
        const dx = Math.cos(ra)
        const dz = Math.sin(ra)
        const p1: Vec3 = [top[0] + dx * len * 0.5, top[1] + len * 0.22, top[2] + dz * len * 0.5]
        const p2: Vec3 = [top[0] + dx * len, top[1] - len * 0.18, top[2] + dz * len]
        tube(ctx.foliage, [top, p1, p2], { sides: 3, radii: [height * 0.005, height * 0.004, height * 0.0025], color: (t) => mix(shade(gc, 1.05), lighten(gc, 0.9), t), sway: (t) => 0.6 + 0.4 * t, end: 'none' })
      }
      if (ctx.lod < 2) {
        // tuft of bracts under the umbrella
        icoShell(ctx.foliage, { center: [top[0], top[1] - 0.01, top[2]], radii: [height * 0.025, height * 0.018, height * 0.025], detail: 0, rng, noise: 0.1, color: (v) => shade(lighten(gc, 0.6), 0.8 + v.h * 0.3), sway: () => 0.9 })
      }
    }
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
