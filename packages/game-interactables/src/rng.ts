/** FNV-1a hash of a string to a 32-bit unsigned integer. */
export function hashString(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic random generator (mulberry32). Returns a function producing floats in [0, 1). Numbers and strings are accepted as seeds. */
export function rng(seed: number | string = 1): () => number {
  let a = (typeof seed === 'number' ? Math.floor(seed) >>> 0 : hashString(seed)) || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
