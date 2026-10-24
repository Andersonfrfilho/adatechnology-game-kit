const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193
const MIX = 0x9e3779b1

/** Deterministic mulberry32 generator; returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** A seed for the stream called `name`: the same seed gives each name its own sequence, so lightning never shifts the schedule. */
export function streamSeed(seed: number, name: string): number {
  let hash = FNV_OFFSET
  for (let index = 0; index < name.length; index++) hash = Math.imul(hash ^ name.charCodeAt(index), FNV_PRIME) >>> 0
  return Math.imul((seed >>> 0) ^ hash, MIX) >>> 0
}

export function createStream(seed: number, name: string): () => number {
  return createRng(streamSeed(seed, name))
}

export function drawBetween(rng: () => number, range: readonly [min: number, max: number]): number {
  return range[0] + rng() * (range[1] - range[0])
}
