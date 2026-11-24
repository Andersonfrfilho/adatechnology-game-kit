/** How the lamps of a street are kept: `lit` is the share of lamps that work, `flicker` the share of all lamps that work badly (a part of `lit`). The rest are burnt out. */
export type LampShares = { readonly lit: number; readonly flicker: number }

/** One lamp: `on` for `PoleOptions.on`, `flicker` for `PoleOptions.flicker`. */
export type LampState = { readonly on: boolean; readonly flicker: boolean }

export type LampStateParams = { readonly seed: number; readonly x: number; readonly z: number; readonly shares: LampShares }

const UINT32 = 2 ** 32

/** FNV-1a of the seed and the spot (centimetres), into [0, 1). */
const hashLamp = (seed: number, x: number, z: number): number => {
  let h = 2166136261
  for (const value of [seed | 0, Math.round(x * 100), Math.round(z * 100)]) {
    h ^= value & 0xffff
    h = Math.imul(h, 16777619)
    h ^= (value >>> 16) & 0xffff
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / UINT32
}

/** Throws when the shares are not `0 <= flicker <= lit <= 1`. */
export function assertLampShares(shares: LampShares): void {
  const { lit, flicker } = shares
  if (!(lit >= 0 && lit <= 1)) throw new RangeError(`lamp shares: lit must be in [0, 1], got ${lit}`)
  if (!(flicker >= 0 && flicker <= lit)) throw new RangeError(`lamp shares: flicker must be in [0, lit], got ${flicker}`)
}

/**
 * Whether the lamp standing at `x, z` works, flickers or is burnt out, by a hash of the seed and the spot: the same street with the same seed keeps the same dead and failing lamps,
 * and the choice does not draw from the builder's random, so the scene around it keeps its draw order.
 */
export function lampStateOf({ seed, x, z, shares }: LampStateParams): LampState {
  assertLampShares(shares)
  const roll = hashLamp(seed, x, z)
  if (roll >= shares.lit) return { on: false, flicker: false }
  return { on: true, flicker: roll >= shares.lit - shares.flicker }
}
