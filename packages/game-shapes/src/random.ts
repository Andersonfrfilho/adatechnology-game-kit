import { hash64 } from './hash'

/** mulberry32: a small, fast 32-bit seeded stream in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The stream of one node: its own per (seed, generator, path), so adding a node never shifts another node's draws. */
export const streamFor = (seed: number | string, generator: string, path: string): (() => number) =>
  mulberry32(parseInt(hash64(`${String(seed)}\u0000${generator}\u0000${path}`).slice(0, 8), 16))
