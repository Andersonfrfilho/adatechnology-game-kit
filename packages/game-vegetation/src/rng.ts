/** FNV-1a 32-bit string hash. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mix two uint32 values into one. */
export function hashMix(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

export function toSeed(seed: number | string | undefined): number {
  if (seed === undefined) return 1
  if (typeof seed === 'string') return hashString(seed)
  return seed >>> 0 || 1
}

/** mulberry32 PRNG with small helpers. Never uses Math.random. */
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = seed >>> 0
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1))
  }
  chance(p: number): boolean {
    return this.next() < p
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))]
  }
  /** approx gaussian (sum of 3 uniforms), mean 0, roughly -1..1 */
  gauss(): number {
    return (this.next() + this.next() + this.next()) / 1.5 - 1
  }
  /** independent child generator derived from this one's seed and a label / index */
  fork(label: number | string): Rng {
    return new Rng(hashMix(this.s, typeof label === 'string' ? hashString(label) : label + 1))
  }
  /** a fresh uint32 derived without advancing structure-dependent streams */
  seed(): number {
    return Math.floor(this.next() * 4294967296) >>> 0
  }
}

export function createRng(seed: number | string | undefined): Rng {
  return new Rng(toSeed(seed))
}
