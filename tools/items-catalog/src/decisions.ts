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

/** What a recipe phrase stands for: one item, the empty hands, or nothing yet (an id that T3.1c has to create). */
export type TermTarget = { readonly item?: string; readonly none?: true }

export type DimensionDecision = { readonly size: readonly [number, number, number]; readonly source: 'household' | 'REF' | 'model' }

export type Decisions = {
  readonly categoryMap: DecisionTable<NamedId>
  readonly gameCategoryMap: DecisionTable<NamedId>
  readonly householdCategoryMap: DecisionTable<{ readonly category: string; readonly tag: string }>
  readonly placeMap: DecisionTable<NamedId>
  readonly rarityMap: DecisionTable<Rarity>
  readonly regionIds: DecisionTable<string>
  /** Team id -> household id, for the exact equivalents. */
  readonly merge: DecisionTable<string>
  /** Team id -> English id. */
  readonly ids: DecisionTable<string>
  /** Team id -> 'game': the story items only the game has. */
  readonly scope: DecisionTable<'game'>
  readonly gameOnlyExtras: DecisionTable<'game'>
  readonly householdRarity: Decision<Rarity>
  /** Final item id -> measure. */
  readonly dimensions: DecisionTable<DimensionDecision>
  readonly densityByCategory: Decision<Readonly<Record<string, number>>>
  readonly stackByCategory: DecisionTable<number>
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
