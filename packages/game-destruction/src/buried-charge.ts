import { TNT_PER_JOULE } from './blast-wave'

/** Metres of soil per cube root of a kilogram of TNT over which the air blast of a buried charge falls by a factor of e (scaled depth). */
export const BURIED_BLAST_SCALE_DEPTH = 0.4

/**
 * The share of a blast's energy that still reaches the air and the structures when the charge sits `depth` metres under the ground: the soil
 * takes the rest into the crater, the shock in the ground and the heave. Zero or negative depth (at or above ground) passes all of it.
 */
export function buriedTransmission(depth: number, energy: number): number {
  if (!(depth > 0) || !(energy > 0)) return 1
  const tntKilograms = energy * TNT_PER_JOULE
  return Math.exp(-depth / (BURIED_BLAST_SCALE_DEPTH * Math.cbrt(Math.max(tntKilograms, 1e-9))))
}
