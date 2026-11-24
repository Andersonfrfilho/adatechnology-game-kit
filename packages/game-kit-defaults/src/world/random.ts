const SEED = 12345
const MULTIPLIER = 1664525
const INCREMENT = 1013904223
const MODULUS = 4294967296

/** The room's seeded stream (a linear congruential generator): the ground's fire and smoke draw from it, and `reset` takes it back to its seed like the room's hard reset. */
export type SeededRandom = { readonly next: () => number; readonly reset: () => void }

export function createSeededRandom(): SeededRandom {
  let state = SEED
  return {
    next() {
      state = (state * MULTIPLIER + INCREMENT) >>> 0
      return state / MODULUS
    },
    reset() {
      state = SEED
    },
  }
}
