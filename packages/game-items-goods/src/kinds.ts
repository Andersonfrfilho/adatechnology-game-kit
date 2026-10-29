import { checkCategorized, defineCategories } from '@adatechnology/game-contracts'
import type { CategorizedReport, CategoryOptions, CategoryRegistry } from '@adatechnology/game-contracts'

import { createItemContracts } from './contracts'
import type { ItemContractOptions, KindedItem } from './contracts'
import { GOODS_ITEMS, GOODS_KINDS, GOODS_KNOWN_GAPS } from './data'

/** The registry of the shipped kinds; `options` adds kinds, patches them by id or removes them (a game's own kinds go in `extra`). */
export const createGoodsKinds = (options: CategoryOptions = {}): CategoryRegistry => defineCategories(GOODS_KINDS, options)

export interface CheckGoodsOptions extends ItemContractOptions {
  readonly kinds?: CategoryRegistry
  /** The rows to check (default the goods catalog). */
  readonly entries?: readonly KindedItem[]
  /** Known gaps by item id (default `GOODS_KNOWN_GAPS`). */
  readonly allow?: Readonly<Record<string, readonly string[]>>
}

/** The `category` values a kind lets its items carry (`lootCategory` of its defaults); undefined when the kind declares none. */
export const lootCategoriesOf = (kinds: CategoryRegistry, kind: string): readonly string[] | undefined => {
  const value = kinds.defaults(kind).lootCategory
  if (value === undefined) return undefined
  return Array.isArray(value) ? (value as string[]) : [String(value)]
}

/** Runs the contracts of every item's kind over the catalog, and checks that `category` (read by the loot rolls) is one the kind declares. */
export const checkGoodsItems = (options: CheckGoodsOptions = {}): CategorizedReport => {
  const kinds = options.kinds ?? createGoodsKinds()
  const entries = options.entries ?? (GOODS_ITEMS as unknown as readonly KindedItem[])
  const report = checkCategorized(entries, kinds, createItemContracts({ items: entries, ...options }), { allow: options.allow ?? GOODS_KNOWN_GAPS })
  const problems = [...report.problems]
  for (const entry of entries) {
    if (!kinds.has(entry.kind) || kinds.get(entry.kind)?.abstract) continue
    const declared = lootCategoriesOf(kinds, entry.kind)
    if (declared && !declared.includes(entry.category)) problems.push(`"${entry.id}" (${entry.kind}): category "${entry.category}" is not one of ${declared.join(', ')}, required by the kind's lootCategory`)
  }
  return { ok: problems.length === 0, problems, allowed: report.allowed }
}
