import type { RosetteSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, dirFromAngles, lerp, mul } from '../math'
import { jitter, mix, rgb, shade, tintFlesh, lighten } from '../color'
import { fleshyLeaf } from '../geometry/succulent'
import { tube } from '../geometry/tube'
import { icoShell } from '../geometry/shell'

export function generateRosette(spec: RosetteSpec, ctx: Ctx): ArchResult {
  const form = spec.form ?? 'agave'
  const rng = ctx.rng
  const over = ctx.condition === 'overgrown'
  switch (form) {
    case 'sword': {
      const h = (spec.height ?? 0.8) * (over ? 1.2 : 1)
      const n = Math.round((spec.leafCount ?? 9) * (over ? 1.3 : 1) * ctx.pick(1, 0.7, 0.55))
      const base = tintFlesh(rgb(spec.color ?? 0x3f7a45), ctx.condition)
      const edgeC = tintFlesh(rgb(spec.edgeColor ?? 0xc9c24a), ctx.condition)
      const dark = shade(base, 0.6)
      const light = mix(base, [0.62, 0.78, 0.6], 0.45)
      for (let i = 0; i < n; i++) {
        const az = (i / n) * TAU * 1.0 + rng.range(-0.3, 0.3)
        const el = rng.range(1.2, 1.5)
        const len = h * rng.range(0.55, 1.0) * (ctx.condition === 'dead' ? 0.6 : 1)
        const ring = rng.range(0, 0.08)
        const base0: Vec3 = [Math.cos(az) * ring, 0.0, Math.sin(az) * ring]
        const band = rng.range(0, TAU)
        fleshyLeaf(ctx.foliage, base0, dirFromAngles(az, el), dirFromAngles(az + Math.PI, 0.2), len, h * 0.16 * rng.range(0.85, 1.15), {
          rows: ctx.pick(7, 4, 2),
          profile: 'sword',
          thick: 0.25,
          curl: rng.range(0.03, ctx.condition === 'dry' ? 0.3 : 0.12),
          lower: false,
          swayBase: 0,
          swayTip: 0.5,
          color: (t) => mix(dark, light, 0.5 + 0.5 * Math.sin(t * 22 + band)),
          edge: (t) => mix(edgeC, shade(edgeC, 0.8), 0.5 + 0.5 * Math.sin(t * 22 + band)),
        })
      }
      break
    }
    case 'aloe': {
      const h = (spec.height ?? 0.55) * (over ? 1.2 : 1)
      const n = Math.round((spec.leafCount ?? 12) * ctx.pick(1, 0.7, 0.5))
      const base = tintFlesh(rgb(spec.color ?? 0x6f9f6a), ctx.condition)
      const edge = rgb(spec.edgeColor ?? 0xe8e0c8)
      for (let i = 0; i < n; i++) {
        const ring = i < n * 0.4 ? 0 : i < n * 0.75 ? 1 : 2
        const az = i * 2.4 + rng.range(-0.2, 0.2)
        const el = [1.15, 0.85, 0.55][ring] + rng.range(-0.1, 0.1)
        const len = h * [0.75, 0.95, 0.85][ring] * rng.range(0.9, 1.1)
        const c = jitter(base, rng, 0.01, 0.06, 0.04)
        fleshyLeaf(ctx.foliage, [0, 0.02, 0], dirFromAngles(az, el), [0, 1, 0], len, h * 0.26, {
          rows: ctx.pick(3, 2, 2),
          profile: 'aloe',
          thick: 0.45,
          curl: 0.28,
          lower: ctx.lod === 0,
          swayBase: 0,
          swayTip: 0.5,
          color: (t) => mix(shade(c, 0.62), lighten(c, 0.5), t),
          edge: (t) => mix(shade(c, 0.5), shade(c, 0.95), t),
          teeth: ctx.lod === 0 ? { count: 5, color: edge, size: 0.07 } : undefined,
        })
      }
      if (spec.bloom && ctx.condition !== 'dead' && ctx.lod < 2) {
        const bc = rgb(spec.bloom.color)
        const stalkH = h * 1.5
        const tip: Vec3 = [0.04, stalkH, 0.02]
        tube(ctx.foliage, [[0, 0.1, 0], [0.02, stalkH * 0.5, 0.0], tip], { sides: 4, radii: [0.012, 0.01, 0.007], color: () => [0.45, 0.55, 0.3], sway: (t) => 0.3 + 0.6 * t, end: 'point' })
        for (let k = 0; k < 9; k++) {
          const t = 0.62 + (0.38 * k) / 9
          const y = lerp(0.1, stalkH, t)
          const a = k * 2.3
          const p: Vec3 = [lerp(0, 0.04, t) + Math.cos(a) * 0.012, y, lerp(0, 0.02, t) + Math.sin(a) * 0.012]
          const dir = dirFromAngles(a, -0.8)
          icoShell(ctx.flowers, { center: add(p, mul(dir, 0.03)), radii: [0.014, 0.04, 0.014], detail: 0, noise: 0, rng, color: (v) => mix(shade(bc, 0.8), lighten(bc, 0.4), v.h), sway: () => 0.9 })
        }
      }
      break
    }
    case 'echeveria': {
      const h = spec.height ?? 0.14
      const base = tintFlesh(rgb(spec.color ?? 0x8fb0a0), ctx.condition)
      const tipC = rgb(spec.edgeColor ?? 0xd88aa0)
      const rings = ctx.pick([5, 7, 9, 11], [5, 8, 10], [6, 9])
      rings.forEach((cnt, r) => {
        for (let i = 0; i < cnt; i++) {
          const az = (i / cnt) * TAU + r * 0.45 + rng.range(-0.1, 0.1)
          const el = [1.35, 1.0, 0.65, 0.35][Math.min(r, 3)]
          const len = h * [0.5, 0.65, 0.8, 0.9][Math.min(r, 3)]
          const c = jitter(base, rng, 0.008, 0.05, 0.04)
          fleshyLeaf(ctx.foliage, [0, 0.01 + r * 0.004, 0], dirFromAngles(az, el), [0, 1, 0], len, h * 0.42, {
            rows: ctx.pick(3, 2, 2),
            profile: 'spoon',
            thick: 0.6,
            curl: 0.25,
            lower: ctx.lod === 0,
            swayBase: 0,
            swayTip: 0.15,
            color: (t) => mix(shade(c, 0.7), mix(lighten(c, 0.4), tipC, 0.5), Math.pow(t, 2)),
            edge: (t) => mix(shade(c, 0.6), tipC, Math.pow(t, 1.5) * 0.9),
          })
        }
      })
      break
    }
    default: {
      // agave
      const h = (spec.height ?? 0.9) * (over ? 1.15 : 1)
      const n = Math.round((spec.leafCount ?? 20) * ctx.pick(1, 0.7, 0.55))
      const base = tintFlesh(rgb(spec.color ?? 0x5f9a8a), ctx.condition)
      const tooth = rgb(spec.edgeColor ?? 0x5a3a2a)
      for (let i = 0; i < n; i++) {
        const f = i / n
        const az = i * 2.399963 + rng.range(-0.15, 0.15)
        const el = lerp(1.35, 0.3, Math.pow(f, 0.8)) + rng.range(-0.06, 0.06)
        const len = h * lerp(0.55, 1, Math.pow(f, 0.6)) * rng.range(0.92, 1.08)
        const c = jitter(base, rng, 0.012, 0.06, 0.04)
        fleshyLeaf(ctx.foliage, [0, 0.03, 0], dirFromAngles(az, el), [0, 1, 0], len, len * 0.3, {
          rows: ctx.pick(3, 2, 2),
          profile: 'blade',
          thick: 0.5,
          curl: lerp(0.12, 0.3, f),
          lower: ctx.lod === 0,
          swayBase: 0,
          swayTip: 0.25,
          color: (t) => mix(shade(c, 0.6), mix(lighten(c, 0.6), [0.7, 0.8, 0.6], 0.25), Math.pow(t, 0.9)),
          edge: (t) => mix(shade(c, 0.5), shade(c, 1.0), t * 0.8),
          teeth: ctx.lod === 0 && f > 0.35 ? { count: 4, color: tooth, size: 0.05 } : undefined,
          spine: ctx.lod < 2 ? tooth : undefined,
        })
      }
      break
    }
  }
  return { collider: null, bendable: true }
}
