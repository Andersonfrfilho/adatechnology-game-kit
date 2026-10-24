import type { Freshness } from './decay'
import { DEFAULT_RULES } from './rules'
import type { ItemRules } from './rules-types'
import type { ItemDef } from './types'
import type { UseEffectDef } from './use-types'

export interface UseContext {
  /** State of the food, from `freshness()`. Default `fresh`. */
  freshness?: Freshness
  /** The food was cooked: it keeps only `cookedPoisonFactor` of its poison chance. */
  isCooked?: boolean
}

export interface NutritionResult {
  satiety: number
  hydration: number
  morale: number
  poisonChance: number
  isEdible: boolean
}

export interface UseResult {
  useId: string
  effect: string
  params: Readonly<Record<string, unknown>>
  /** The item is spent (false for food too rotten to eat). */
  consumes: boolean
  /** Only for `consume_nutrition`. */
  nutrition?: NutritionResult
}

const FRESH_NUTRITION = { satietyFactor: 1, poisonChance: 0, morale: 0, isEdible: true }

const nutritionOf = (item: ItemDef, context: UseContext, rules: ItemRules): NutritionResult => {
  const state = context.freshness ?? 'fresh'
  const effect = state === 'fresh' ? FRESH_NUTRITION : rules.use.freshness[state]
  const poisonShare = context.isCooked ? rules.use.cookedPoisonFactor : 1
  return {
    satiety: (item.nutrition?.satiety ?? 0) * effect.satietyFactor,
    hydration: item.nutrition?.hydration ?? 0,
    morale: effect.morale,
    poisonChance: effect.poisonChance * poisonShare,
    isEdible: effect.isEdible,
  }
}

const findEffect = (item: ItemDef, effects: readonly UseEffectDef[]): UseEffectDef | undefined =>
  effects.find((entry) => entry.items?.includes(item.id)) ?? effects.find((entry) => entry.category?.includes(item.category))

/**
 * What using `item` does, as data: the host applies it (the player, the needs, the world). Pure. The first effect that lists the item wins, then the first
 * that lists its category; `undefined` when nothing happens. Food past its best follows `rules.use.freshness`.
 */
export const resolveUse = (item: ItemDef, effects: readonly UseEffectDef[], context: UseContext = {}, rules: ItemRules = DEFAULT_RULES): UseResult | undefined => {
  const def = findEffect(item, effects)
  if (!def) return undefined
  const base = { useId: def.id, effect: def.effect, params: def.params ?? {}, consumes: def.consumes }
  if (def.effect !== 'consume_nutrition') return base
  const nutrition = nutritionOf(item, context, rules)
  return { ...base, consumes: def.consumes && nutrition.isEdible, nutrition }
}
