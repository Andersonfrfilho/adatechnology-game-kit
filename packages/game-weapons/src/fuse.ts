import type { ExplosiveDef } from './explosive-types'

/** The fuse of an explosive with no randomness: a fixed `fuse`, the burn of a safety fuse (length times rate), or the middle of `fuseRange`. */
export const nominalFuse = (explosive: ExplosiveDef, fuseLength?: number): number | undefined => {
  const length = fuseLength ?? explosive.fuseLength
  if (length !== undefined && explosive.burnRate !== undefined) return length * explosive.burnRate
  if (explosive.fuseRange) return (explosive.fuseRange[0] + explosive.fuseRange[1]) / 2
  return explosive.fuse
}

/**
 * The fuse of one throw. A safety fuse burns `fuseLength × burnRate` seconds, scattered by `burnTolerance` (a fraction, ±); `fuseRange` picks a time
 * between its two ends; a fixed `fuse` is returned as is. Draws from `random` only when the explosive is not fixed, so fixed ones leave the stream alone.
 */
export const sampleFuse = (explosive: ExplosiveDef, random: () => number, fuseLength?: number): number | undefined => {
  const length = fuseLength ?? explosive.fuseLength
  if (length !== undefined && explosive.burnRate !== undefined) {
    const tolerance = explosive.burnTolerance ?? 0
    return length * explosive.burnRate * (tolerance > 0 ? 1 + tolerance * (2 * random() - 1) : 1)
  }
  if (explosive.fuseRange) return explosive.fuseRange[0] + (explosive.fuseRange[1] - explosive.fuseRange[0]) * random()
  return explosive.fuse
}
