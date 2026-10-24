import type { ItemRules } from './rules-types'
import type { CategoryDef, ContainerDef, ItemDef, PlaceDef } from './types'
import { BODY_SLOTS, DURABILITY_KINDS, RARITIES } from './types'

export interface ItemsParts {
  readonly items: ReadonlyMap<string, ItemDef>
  readonly categories: ReadonlyMap<string, CategoryDef>
  readonly places: ReadonlyMap<string, PlaceDef>
  readonly containers: ReadonlyMap<string, ContainerDef>
  readonly rules: ItemRules
}

/** Ids that appear more than once in a list a game passed in. */
export const findDuplicateIds = (kind: string, entries: readonly { readonly id: string }[] | undefined): string[] => {
  const seen = new Set<string>()
  const problems: string[] = []
  for (const { id } of entries ?? []) {
    if (seen.has(id)) problems.push(`${kind} "${id}" is listed more than once`)
    seen.add(id)
  }
  return problems
}

const isFraction = (value: number | undefined): boolean => value === undefined || (value >= 0 && value <= 1)
const isPositive = (value: number): boolean => Number.isFinite(value) && value > 0

const checkItem = (item: ItemDef, { categories, places }: ItemsParts): string[] => {
  const problems: string[] = []
  const issue = (text: string): number => problems.push(`item "${item.id}" ${text}`)
  if (!categories.has(item.category)) issue(`has unknown category "${item.category}"`)
  if (!RARITIES.includes(item.rarity)) issue(`has unknown rarity "${item.rarity}"`)
  if (item.size.length !== 3 || !item.size.every(isPositive)) issue(`has an invalid size [${item.size.join(', ')}]`)
  if (!(item.weight >= 0) || !Number.isFinite(item.weight)) issue(`has a weight of ${item.weight} kg`)
  if (item.volume !== undefined && !isPositive(item.volume)) issue(`has a volume of ${item.volume} L`)
  if (item.shelfLife !== undefined && !isPositive(item.shelfLife)) issue(`has a shelf life of ${item.shelfLife} days`)
  if (item.portions !== undefined && !(Number.isInteger(item.portions) && item.portions > 0)) issue(`has ${item.portions} portions`)
  if (item.durability && !DURABILITY_KINDS.includes(item.durability.kind)) issue(`has unknown durability kind "${item.durability.kind}"`)
  const { protection } = item
  if (protection) {
    for (const slot of protection.slots) if (!BODY_SLOTS.includes(slot)) issue(`protects unknown body slot "${slot}"`)
    if (protection.slots.length === 0) issue('has protection but covers no body slot')
    if (![protection.bite, protection.scratch, protection.warmth].every(isFraction)) issue('has a protection value outside 0..1')
  }
  if (item.carry && !(item.carry.capacityKg > 0 && isFraction(item.carry.weightReduction))) issue('has an invalid carry (capacity above 0, reduction within 0..1)')
  if (places.size > 0) for (const place of item.finds?.places ?? []) if (!places.has(place)) issue(`is found in unknown place "${place}"`)
  return problems
}

const checkContainer = (container: ContainerDef, { categories }: ItemsParts): string[] => {
  const problems: string[] = []
  for (const category of Object.keys(container.categories ?? {})) {
    if (!categories.has(category)) problems.push(`container "${container.id}" draws from unknown category "${category}"`)
  }
  const [low, high] = container.count ?? [0, 0]
  if (low < 0 || high < low) problems.push(`container "${container.id}" has an invalid count [${low}, ${high}]`)
  return problems
}

const checkRules = ({ rarity, freshness, storage, carry, protection }: ItemRules): string[] => {
  const problems: string[] = []
  const hasNegativeWeight = RARITIES.some((id) => !(rarity.weights[id] >= 0))
  if (hasNegativeWeight || !RARITIES.some((id) => rarity.weights[id] > 0 && !rarity.fixedOnly.includes(id))) {
    problems.push('rules.rarity.weights must be non-negative with at least one rollable rarity above 0')
  }
  if (!(freshness.stale > 0 && freshness.stale < freshness.spoiled && freshness.spoiled < freshness.rotten)) problems.push('rules.freshness must rise: 0 < stale < spoiled < rotten')
  for (const [id, rule] of Object.entries(storage)) if (!isPositive(rule.multiplier) || (rule.limitDays !== undefined && !isPositive(rule.afterLimit ?? 0))) problems.push(`rules.storage "${id}" is invalid`)
  if (!(isPositive(carry.baseKg) && carry.perStrengthKg >= 0 && isPositive(carry.factor) && carry.encumbered > 0 && carry.overloaded > carry.encumbered)) problems.push('rules.carry is invalid')
  if (!(protection.cap > 0 && protection.cap <= 1 && isFraction(protection.tornShare))) problems.push('rules.protection is invalid')
  return problems
}

/** Every inconsistency of a catalog, one line each; empty when it is sound. */
export const checkItems = (parts: ItemsParts): string[] => [
  ...[...parts.items.values()].flatMap((item) => checkItem(item, parts)),
  ...[...parts.containers.values()].flatMap((container) => checkContainer(container, parts)),
  ...checkRules(parts.rules),
]
