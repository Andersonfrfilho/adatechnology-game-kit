import type { Color, PropItem } from './types'

/** Deterministic PRNG (mulberry32 variant) returning floats in [0, 1). */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Seed of the details draw: `M.seed` (number or string) or a hash of the position. */
export const seedOf = (M: PropItem): number =>
  (M.seed != null
    ? typeof M.seed === 'number'
      ? M.seed
      : [...String(M.seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)
    : Math.round((M.x || 0) * 37 + (M.z || 0) * 91 + 1000)) >>> 0

/** `'#rrggbb'` or number to number. */
export const hex = (v: Color): number => (typeof v === 'string' ? parseInt(v.replace('#', ''), 16) : v)

/** Scales the brightness of a colour by factor `f` (clamped per channel). */
export const shade = (c: Color, f: number): number => {
  const n = hex(c)
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f))
  const b = Math.min(255, Math.round((n & 255) * f))
  return (r << 16) | (g << 8) | b
}

/** Linear mix of two colours. */
export const mix = (a: Color, b: Color, t: number): number => {
  const x = hex(a)
  const y = hex(b)
  const m = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t)
  return (m(16) << 16) | (m(8) << 8) | m(0)
}
