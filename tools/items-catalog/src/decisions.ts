import { readFileSync } from 'node:fs'

import type { BodySlot, Rarity } from '@adatechnology/game-items'

import { DECISIONS_PATH } from './paths'

/** A reconciliation choice, with where it comes from and why; `citation` points to the words of the Itens page that justify it. */
export type Decision<TValue> = {
  readonly value: TValue
  readonly source: string
  readonly reason: string
  readonly citation?: { readonly line: number; readonly quote: string }
}

export type DecisionTable<TValue> = Readonly<Record<string, Decision<TValue>>>

export type NamedId = { readonly id: string; readonly name: string }

/** Traits that pick any item of the catalog ("1 roupa" is any clothing, "ingredientes" is anything cookable). */
export type TermMatch = { readonly category?: string; readonly cookable?: true }

/**
 * What a recipe phrase stands for: an item, one of a family of items (`items`), a fluid counted in litres, a thing of the world that is never carried
 * (furniture, a fire, the ground), any item with some traits (`match`), or the empty hands.
 */
export type TermTarget = {
  readonly item?: string
  readonly items?: readonly string[]
  readonly fluid?: string
  readonly world?: string
  readonly match?: TermMatch
  readonly none?: true
}

/** An item the sources do not have and the catalog needs (a pool entry, a recipe term): size comes from `dimensions`, the rest is here. */
export type ExtraItem = {
  readonly category: string
  readonly tags?: readonly string[]
  readonly weight: number
  readonly rarity: Rarity
  readonly stack?: number
  readonly shape?: string
  readonly color?: number
  readonly shelfLife?: number
  readonly portions?: number
  readonly nutrition?: { readonly satiety?: number; readonly hydration?: number }
  readonly places?: readonly string[]
}

export type DimensionDecision = { readonly size: readonly [number, number, number]; readonly source: 'household' | 'REF' | 'model' }

export type Decisions = {
  readonly categoryMap: DecisionTable<NamedId>
  readonly gameCategoryMap: DecisionTable<NamedId>
  readonly householdCategoryMap: DecisionTable<{ readonly category: string; readonly tag: string }>
  /** Household item id -> category of the 14, when its household category would put it in the wrong one. */
  readonly householdItemCategory: DecisionTable<string>
  readonly placeMap: DecisionTable<NamedId>
  readonly rarityMap: DecisionTable<Rarity>
  readonly regionIds: DecisionTable<string>
  /** Team id -> household id, for the exact equivalents. */
  readonly merge: DecisionTable<string>
  /** Team id -> household id of a pair that looks alike and is NOT merged (kept so nobody proposes it again). */
  readonly mergeRejected: DecisionTable<string>
  /** Team id -> English id. */
  readonly ids: DecisionTable<string>
  /** Team id -> 'game': the story items only the game has. */
  readonly scope: DecisionTable<'game'>
  readonly gameOnlyExtras: DecisionTable<'game'>
  /** Final item id -> an item that exists only because the catalog needs it. */
  readonly extraItems: DecisionTable<ExtraItem>
  readonly householdRarity: Decision<Rarity>
  /** Final item id -> measure. */
  readonly dimensions: DecisionTable<DimensionDecision>
  readonly densityByCategory: Decision<Readonly<Record<string, number>>>
  readonly stackByCategory: DecisionTable<number>
  /** Final item id -> stack, for what the category default gets wrong (a brick is not stacked by eight). */
  readonly stackOverrides: DecisionTable<number>
  readonly shapeByCategory: DecisionTable<string>
  readonly slotMap: DecisionTable<readonly BodySlot[]>
  readonly warmthScale: Decision<number>
  readonly carryWheelsAt: Decision<number>
  readonly storageIds: DecisionTable<{ readonly id: string; readonly needsPower: boolean }>
  readonly containerIds: DecisionTable<string>
  readonly gameContainers: DecisionTable<string>
  readonly depletionPlaces: DecisionTable<readonly string[]>
  readonly recipeIds: DecisionTable<string>
  readonly skills: DecisionTable<string>
  readonly recipeTerms: DecisionTable<TermTarget>
  /** Viewer pool type -> item id (a team or household id), or null while there is no item. */
  readonly aliases: DecisionTable<string | null>
  readonly caliberMap: DecisionTable<string>
  readonly gameWeaponMap: DecisionTable<string>
  readonly chargeItems: Decision<readonly string[]>
  readonly fuelItems: Decision<readonly string[]>
}

export const loadDecisions = (): Decisions => JSON.parse(readFileSync(DECISIONS_PATH, 'utf8')) as Decisions

export const valueOf = <TValue>(table: DecisionTable<TValue>, key: string, what: string): TValue => {
  const decision = table[key]
  if (!decision) throw new Error(`items-catalog: no decision for ${what} "${key}" in decisions.json`)
  return decision.value
}
