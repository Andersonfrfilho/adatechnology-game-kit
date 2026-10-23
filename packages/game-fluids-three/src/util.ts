export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Small seeded generator for cosmetic randomness (droplet directions): the same input gives the same droplets. */
export class Rng {
  private state: number
  constructor(seed: number) {
    this.state = (seed >>> 0) || 1
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer hash of a point, to seed cosmetic randomness from world state. */
export const hashPoint = (x: number, y: number, z: number): number => {
  let h = 2166136261
  for (const v of [x, y, z]) h = Math.imul(h ^ Math.round(v * 1000), 16777619)
  return h >>> 0
}
