import type { Vec3 } from '@adatechnology/game-destruction'

/** Small deterministic PRNG (mulberry32): returns a function giving numbers in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hash of a few numbers into an unsigned 32-bit seed. */
export function hashNumbers(...values: number[]): number {
  let h = 2166136261
  for (const v of values) {
    const n = Math.round(v * 1000) | 0
    h = Math.imul(h ^ n, 16777619)
    h ^= h >>> 13
  }
  return h >>> 0
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export function vec3Length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

export function normalize3(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2])
  return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 1, 0]
}

/** `0xRRGGBB` -> `[r, g, b]` in 0..1. */
export function hexToRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]
}

export function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const r = Math.round(ar + (((b >> 16) & 255) - ar) * t)
  const g = Math.round(ag + (((b >> 8) & 255) - ag) * t)
  const bl = Math.round(ab + ((b & 255) - ab) * t)
  return (r << 16) | (g << 8) | bl
}
