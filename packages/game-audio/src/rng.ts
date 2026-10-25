const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193
const MIX = 0x9e3779b1

/** Deterministic mulberry32 generator; floats in [0, 1). The same generator the golden tool seeds `Math.random` with, so a team routine and its recipe draw the same numbers. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** The seed of the stream called `name` (or numbered `name`): one seed gives each channel its own sequence, so one subject's sounds never shift another's. */
export function streamSeed(seed: number, name: string | number): number {
  const label = String(name)
  let hash = FNV_OFFSET
  for (let index = 0; index < label.length; index++) hash = Math.imul(hash ^ label.charCodeAt(index), FNV_PRIME) >>> 0
  return Math.imul((seed >>> 0) ^ hash, MIX) >>> 0
}

export function streamFor(seed: number, name: string | number): () => number {
  return createRng(streamSeed(seed, name))
}

/** `min + random × (max − min)`: the form every team routine uses (`95 + Math.random() * 40`). */
export function drawBetween(random: () => number, min: number, max: number): number {
  return min + random() * (max - min)
}
