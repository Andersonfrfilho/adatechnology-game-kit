import { DEFAULT_RULES } from './rules'
import type { ItemRules } from './rules-types'
import type { ItemDef } from './types'

export interface CarryEntry {
  item: ItemDef
  count: number
}

export type LoadLevel = 'normal' | 'encumbered' | 'overloaded'

export interface LoadState {
  /** Load as a share of the maximum. */
  ratio: number
  level: LoadLevel
  /** Multiplier of running speed and breath. */
  runFactor: number
  canRun: boolean
}

/** What a character can carry, kg: `(8 + 2.5 x strength) x 1.2` with the default rules. */
export const maxLoadKg = (strength: number, rules: ItemRules = DEFAULT_RULES): number => (rules.carry.baseKg + rules.carry.perStrengthKg * strength) * rules.carry.factor

const sumKg = (entries: readonly CarryEntry[]): number => entries.reduce((total, entry) => total + entry.item.weight * entry.count, 0)

/** Weight carried: what is outside the bag counts in full, what is inside counts times `(1 - weightReduction)`. */
export const carriedKg = (parts: { loose: readonly CarryEntry[]; packed?: readonly CarryEntry[]; weightReduction?: number }): number =>
  sumKg(parts.loose) + sumKg(parts.packed ?? []) * (1 - (parts.weightReduction ?? 0))

/** Above 100% of the maximum, running and breath drop 25%; above 150% the character cannot run. */
export const loadState = (loadKg: number, maxKg: number, rules: ItemRules = DEFAULT_RULES): LoadState => {
  const ratio = maxKg > 0 ? loadKg / maxKg : Number.POSITIVE_INFINITY
  if (ratio > rules.carry.overloaded) return { ratio, level: 'overloaded', runFactor: 0, canRun: false }
  if (ratio > rules.carry.encumbered) return { ratio, level: 'encumbered', runFactor: rules.inventory.encumberedRunFactor, canRun: true }
  return { ratio, level: 'normal', runFactor: 1, canRun: true }
}

/** The bag of a character: how many item slots it has and how much it holds. */
export interface BagOption {
  slots: number
  capacityKg: number
}

/** The bag a bag item gives: its `carry.capacityKg` is the slot count the team's game reads from `cap`; the weight limit is the character's. */
export const bagOption = (bag: ItemDef | undefined, characterMaxKg: number, rules: ItemRules = DEFAULT_RULES): BagOption => ({
  slots: bag?.carry ? Math.round(bag.carry.capacityKg) : rules.inventory.defaultSlots,
  capacityKg: characterMaxKg,
})

export type TakeResult = 'ok' | 'bag_full' | 'too_heavy'

/** Whether `item` can go into the bag now: first the slots, then the weight. */
export const canTake = (item: ItemDef, bag: BagOption, used: { slots: number; loadKg: number }): TakeResult => {
  if (used.slots >= bag.slots) return 'bag_full'
  if (used.loadKg + item.weight > bag.capacityKg) return 'too_heavy'
  return 'ok'
}
