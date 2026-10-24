import type { PlaceTag, Rarity } from './types'

/** Where an item is stored; ids of `StorageRules`. A game adds its own. */
export type StorageId = string

export interface StorageRule {
  /** How much faster (above 1) or slower (below 1) the item ages there. */
  multiplier: number
  /** The multiplier only holds while the place has power (fridge, freezer); without it the item ages at the ambient rate. */
  needsPower?: boolean
  /** The multiplier holds for this many days only, then `afterLimit` applies (a cooler with ice). */
  limitDays?: number
  afterLimit?: number
}

export type StorageRules = Readonly<Record<StorageId, StorageRule>>

export interface ItemRules {
  rarity: {
    /** Draw weight of each rarity when a stack is rolled. */
    weights: Readonly<Record<Rarity, number>>
    /** Rarities that only turn up at fixed spots, never in a roll. */
    fixedOnly: readonly Rarity[]
  }
  /** Where `fresh` ends and `stale`, `spoiled` and `rotten` begin, as fractions of `shelfLife`. */
  freshness: { stale: number; spoiled: number; rotten: number }
  storage: StorageRules
  carry: {
    /** `(baseKg + perStrengthKg × strength) × factor`. */
    baseKg: number
    perStrengthKg: number
    factor: number
    /** Fractions of the maximum load: above `encumbered` the carrier is slowed, above `overloaded` it cannot run. */
    encumbered: number
    overloaded: number
  }
  protection: {
    /** Highest share of an attack clothing can block: there is always some risk. */
    cap: number
    /** Condition a blocked attack costs the piece. */
    wear: { bite: number; scratch: number }
    /** Share of its value a torn piece (condition 0) still protects. */
    tornShare: number
    /** A repair kit restores up to the maximum condition minus this. */
    repairMargin: number
  }
  spawn: {
    /** On day 0 of the outbreak, stock on shelves in these places appears brand new (condition 100) instead of in the team's ranges. */
    retailNew: boolean
    retailPlaces: readonly PlaceTag[]
  }
}
