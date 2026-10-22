/** Seeded random helpers. Same seed and key always produce the same stream. */

export type Rng = () => number

export function mulberry32(a: number): Rng {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(input: string | number): number {
  const s = String(input)
  let h = 1779033703 ^ s.length
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

/** Independent stream for a `(seed, key)` pair. */
export const createRng = (seed: string | number, key: string): Rng => mulberry32(hashString(seed + '|' + key))

/** Picks a key of `{ key: weight }`. */
export function pickWeighted(rng: Rng, weights: Record<string, number>): string {
  const keys = Object.keys(weights)
  let total = 0
  for (const k of keys) total += weights[k]
  let x = rng() * total
  for (const k of keys) {
    x -= weights[k]
    if (x < 0) return k
  }
  return keys[keys.length - 1]
}

/** Weighted draw without replacement. */
export function weightedOrder<T extends { weight: number }>(candidates: T[], rng: Rng): T[] {
  const arr = candidates.slice()
  const out: T[] = []
  while (arr.length) {
    let total = 0
    for (const c of arr) total += c.weight
    let x = rng() * total
    let i = 0
    for (; i < arr.length - 1; i++) {
      x -= arr[i].weight
      if (x < 0) break
    }
    out.push(arr.splice(i, 1)[0])
  }
  return out
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
