/** Pure helpers shared by every module. They never touch three.js. */

/** Deterministic hash of three numbers to [0, 1). */
export function hash(a: number, b: number, c: number): number {
  const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
  return h - Math.floor(h)
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}

/** Smoothstep on [0, 1]. */
export function smooth(t: number): number {
  t = clamp(t, 0, 1)
  return t * t * (3 - 2 * t)
}

/** Mulberry32 pseudo random generator. The same seed always gives the same sequence. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash of a string, used to derive seeds from vehicle keys and zone ids. */
export function strHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Marks an object and all its children as decals (ignored by raycasts, rollover and crash fields). */
export function markDecal(o: any): void {
  o.traverse((x: any) => {
    x.userData.decal = true
  })
}

/** Lower-case ASCII identifier made from free text ("Rear window 2" -> "rear_window_2"). */
export function slug(text: unknown): string {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}
