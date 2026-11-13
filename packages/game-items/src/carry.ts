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

const LITRES_PER_CUBIC_METRE = 1000

/** Volume of one unit, litres: the catalog's `volume`, or the bounding box of its size. */
export const itemLitres = (item: ItemDef): number => item.volume ?? item.size[0] * item.size[1] * item.size[2] * LITRES_PER_CUBIC_METRE

/** The bag of a character: how many item slots it has and how much it holds. */
export interface BagOption {
  slots: number
  capacityKg: number
  /** Volume the bag holds, litres; without it only slots and weight limit the bag. */
  capacityLitres?: number
  /** Inside length, width and height, metres; without it the shape of the item is not checked. */
  inside?: readonly [number, number, number]
}

/** The bag a bag item gives: its `carry.capacityKg` is the slot count the team's game reads from `cap`; the weight limit is the character's; the volume is the bag's real litres. */
export const bagOption = (bag: ItemDef | undefined, characterMaxKg: number, rules: ItemRules = DEFAULT_RULES): BagOption => ({
  slots: bag?.carry ? Math.round(bag.carry.capacityKg) : rules.inventory.defaultSlots,
  capacityKg: characterMaxKg,
  inside: (bag ? rules.inventory.bagInside[bag.id] : undefined) ?? rules.inventory.defaultInside,
  capacityLitres: (bag ? (rules.inventory.bagLitres[bag.id] ?? bag.volume) : undefined) ?? rules.inventory.defaultLitres,
})

/** Whether a box of `size` goes into a space of `inside` turned any way: its dimensions, longest first, each within the space's. */
export const fitsInside = (size: readonly number[], inside: readonly number[]): boolean => {
  const byLength = (a: number, b: number): number => b - a
  const sorted = [...size].sort(byLength)
  const room = [...inside].sort(byLength)
  return sorted.every((length, index) => length <= (room[index] ?? 0) + 1e-9)
}

export type TakeResult = 'ok' | 'bag_full' | 'too_heavy' | 'too_long' | 'too_bulky'

/** What is being added: `count` units, taking `slotsNeeded` new slots, weighing `weightFactor` of their full weight (`1 - weightReduction` inside a bag). */
export interface TakeOptions {
  count?: number
  slotsNeeded?: number
  weightFactor?: number
}

/** Whether `item` can go into the bag now: first the slots, then the weight, then the shape against the inside dimensions, then the volume (when the bag has them). */
export const canTake = (item: ItemDef, bag: BagOption, used: { slots: number; loadKg: number; litres?: number }, options: TakeOptions = {}): TakeResult => {
  const { count = 1, slotsNeeded = 1, weightFactor = 1 } = options
  if (used.slots + slotsNeeded > bag.slots) return 'bag_full'
  if (used.loadKg + item.weight * count * weightFactor > bag.capacityKg) return 'too_heavy'
  if (bag.inside !== undefined && !fitsInside(item.size, bag.inside)) return 'too_long'
  if (bag.capacityLitres !== undefined && (used.litres ?? 0) + itemLitres(item) * count > bag.capacityLitres) return 'too_bulky'
  return 'ok'
}
