import type { Vec3, Condition } from './types'
import type { Rng } from './rng'
import { clamp, lerp3 } from './math'

/** 0xRRGGBB -> sRGB triplet 0..1. All colors in this package are handled as sRGB triplets until MeshData is built (then linear). */
export function rgb(hex: number): Vec3 {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

export function toHsv(c: Vec3): Vec3 {
  const [r, g, b] = c
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const d = mx - mn
  let h = 0
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6
    else if (mx === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
    if (h < 0) h += 1
  }
  return [h, mx < 1e-6 ? 0 : d / mx, mx]
}

export function fromHsv(h: number, s: number, v: number): Vec3 {
  h = ((h % 1) + 1) % 1
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  switch (i % 6) {
    case 0:
      return [v, t, p]
    case 1:
      return [q, v, p]
    case 2:
      return [p, v, t]
    case 3:
      return [p, q, v]
    case 4:
      return [t, p, v]
    default:
      return [v, p, q]
  }
}

export const shade = (c: Vec3, f: number): Vec3 => [clamp(c[0] * f, 0, 1), clamp(c[1] * f, 0, 1), clamp(c[2] * f, 0, 1)]
export const mix = (a: Vec3, b: Vec3, t: number): Vec3 => lerp3(a, b, t)

/** Hue / value / saturation jitter (amounts are max deltas). */
export function jitter(c: Vec3, rng: Rng, hue = 0.02, val = 0.08, sat = 0.06): Vec3 {
  const [h, s, v] = toHsv(c)
  return fromHsv(h + rng.gauss() * hue, clamp(s + rng.gauss() * sat, 0, 1), clamp(v * (1 + rng.gauss() * val), 0, 1))
}

/** Warm the hue toward yellow and darken the top (used for lit tips). */
export function lighten(c: Vec3, amt: number): Vec3 {
  const [h, s, v] = toHsv(c)
  return fromHsv(h - amt * 0.03, clamp(s - amt * 0.12, 0, 1), clamp(v + amt * 0.35, 0, 1))
}

export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

export function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
}

const DRY: Vec3 = [0.66, 0.56, 0.22]
const DEAD: Vec3 = [0.4, 0.35, 0.27]
const PALE: Vec3 = [0.74, 0.7, 0.5]

/** Tint a leaf / green-tissue color by condition. */
export function tintGreen(c: Vec3, condition: Condition): Vec3 {
  switch (condition) {
    case 'dry':
      return mix(c, DRY, 0.55)
    case 'dead':
      return mix(c, DEAD, 0.85)
    case 'overgrown': {
      const [h, s, v] = toHsv(c)
      return fromHsv(h - 0.004, clamp(s * 1.08, 0, 1), v * 0.9)
    }
    default:
      return c
  }
}

/** Tint a succulent / cactus body color by condition (dead = pale and bleached). */
export function tintFlesh(c: Vec3, condition: Condition): Vec3 {
  switch (condition) {
    case 'dry':
      return mix(c, [0.62, 0.6, 0.34], 0.4)
    case 'dead':
      return mix(c, PALE, 0.8)
    case 'overgrown':
      return shade(c, 0.95)
    default:
      return c
  }
}
