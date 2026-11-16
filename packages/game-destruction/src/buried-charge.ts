import { TNT_PER_JOULE } from './blast-wave'

/** Metres of soil per cube root of a kilogram of TNT over which the air blast of a buried charge falls by a factor of e (scaled depth). */
export const BURIED_BLAST_SCALE_DEPTH = 0.4

export type BuriedChargeParams = {
  /** Metres of soil over the charge. */
  readonly cover: number
  /** Kilograms of TNT the charge is worth. */
  readonly tntKilograms: number
}

/** The kit's TNT equivalent of a blast energy (`charge.tnt` of the call when it states one). */
export const tntKilogramsOf = (energy: number, declared?: number): number => declared ?? energy * TNT_PER_JOULE

/** The share of a blast that still reaches the air and the structures through `cover` metres of soil; the soil takes the rest. No cover passes all of it. */
export function buriedTransmission({ cover, tntKilograms }: BuriedChargeParams): number {
  if (!(cover > 0) || !(tntKilograms > 0)) return 1
  return Math.exp(-cover / (BURIED_BLAST_SCALE_DEPTH * Math.cbrt(tntKilograms)))
}
