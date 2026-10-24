import type { PlaceTag, Rarity } from './types'

/** What a find is in: the plain world, a fortified house (stocked up) or an abandoned one (already picked over). */
export type FindState = 'normal' | 'fortified' | 'abandoned'

/** Places whose stock falls with the days of the outbreak: `max(floor, 1 - perDay x days)` of the normal count, never below `floor`. */
export interface DepletionRule {
  places: readonly PlaceTag[]
  perDay: number
  floor: number
}

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

/** What eating food does once it is past its best; one entry per freshness state after `fresh`. */
export interface FreshnessEffect {
  /** Multiplies the satiety and hydration the food gives. */
  satietyFactor: number
  /** Chance of food poisoning. */
  poisonChance: number
  /** Morale change (negative hurts). */
  morale: number
  /** False when the food cannot be eaten at all. */
  isEdible: boolean
}

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
  aging: {
    /** Storage with power -> days of shelf life a food keeps when the power fails (a thawed freezer counts as fresh with 2 days to go). */
    thawShelfDays: Readonly<Record<StorageId, number>>
  }
  inventory: {
    /** Slots of a character's bag when no bag item says otherwise. */
    defaultSlots: number
    /** Running speed and breath multiplier while carrying more than `carry.encumbered` of the maximum. */
    encumberedRunFactor: number
  }
  use: {
    freshness: Readonly<Record<'stale' | 'spoiled' | 'rotten', FreshnessEffect>>
    /** Cooking the food leaves this share of its poison chance. */
    cookedPoisonFactor: number
  }
  spawn: {
    /** On day 0 of the outbreak, stock on shelves in these places appears brand new (condition 100) instead of in the team's ranges. */
    retailNew: boolean
    retailPlaces: readonly PlaceTag[]
    /** Containers that count as shelf or stock room inside a retail place; empty means every container of the place. */
    retailContainers: readonly string[]
    /** Condition (0..100) of a found item with wear, by rarity: `[low, high]`. */
    condition: Readonly<Record<Rarity, readonly [number, number]>>
    /** Found food is already old: the days since the outbreak plus this share of its shelf life, `[low, high]`. */
    ageShare: readonly [number, number]
    /** Charge (0..1) of found batteries. */
    charge: readonly [number, number]
    /** Items found partly filled (a jerrycan) and how full, 0..1. */
    fillable: readonly string[]
    fill: readonly [number, number]
  }
  finds: {
    /** The container whose table a container unknown to the catalog uses (the team's game falls back to a corpse). */
    fallbackContainer: string
    /** Ids left out of the roll by category (the game never rolls the 7.62x39 box). */
    rollExcluded: readonly string[]
    depletion: readonly DepletionRule[]
    /** Multiplies the count of a place, by region id. */
    regionMultiplier: Readonly<Record<string, number>>
    /** Maps the state a host passes to one of the three the finds know. */
    states: Readonly<Record<string, FindState>>
    /** The numbers of the explicit house pools (the 3D viewer's `sorteiaConteudo`). */
    pool: {
      /** Footprint (m²) used when the query gives none. */
      defaultFootprint: number
      /** Count of a normal container: `clamp(round(offset + footprint x perSquareMetre + random x jitter), min, max)`. */
      offset: number
      perSquareMetre: number
      jitter: number
      min: number
      max: number
      /** Fortified: this many more entries (up to the pool size), supplies weigh `supplyWeight` times and give `supplyExtraQty` more. */
      fortifiedExtra: number
      supplyWeight: number
      supplyExtraQty: number
      /** Abandoned: this chance of being empty, otherwise `abandonedKept` entries. */
      abandonedEmptyChance: number
      abandonedKept: number
      /** Abandoned and empty: this chance of leaving a bit of junk. */
      junkChance: number
      junkItem: string
      /** Abandoned fridges and freezers also hold this, gone bad. */
      spoiledFoodItem: string
      coldContainers: readonly string[]
    }
  }
}
