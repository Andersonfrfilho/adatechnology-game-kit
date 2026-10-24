import { readFileSync } from 'node:fs'

import { extractLiteral } from '@adatechnology/golden-tool'

import { SOURCE_PATHS } from './paths'

export type GameItem = {
  readonly id: string
  readonly n: string
  readonly cat: string
  readonly kg: number
  readonly rar: string
  readonly onde: readonly string[]
  readonly uso?: string
  readonly f?: number
  readonly s?: number
}

export type GameExtraItem = {
  readonly id: string
  readonly n: string
  readonly cat: string
  readonly kg: number
  readonly rar: string
  readonly cal?: string
  readonly q?: number
  readonly arma?: number
  readonly uso?: string
}

export type GameContainerRule = { readonly n: readonly [number, number]; readonly cats: Readonly<Record<string, number>> | null }

/** `LOOT` row: [id, name, faction, category, where, effect, rarity]. */
export type GameFactionLootRow = readonly [string, string, string, string, string, string, string]

export type GameData = {
  readonly items: readonly GameItem[]
  readonly extra: readonly GameExtraItem[]
  readonly rarityWeights: Readonly<Record<string, number>>
  readonly containers: Readonly<Record<string, GameContainerRule>>
  readonly fixed: Readonly<Record<string, readonly string[]>>
  readonly factionLoot: readonly GameFactionLootRow[]
  /** Source of `useItem`, kept so a test can prove the effects table still matches the game. */
  readonly useItemSource: string
}

const functionSource = (source: string, name: string): string => {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`items-catalog: function ${name} not found in the game source`)
  const end = source.indexOf('\nfunction ', start + 1)
  return source.slice(start, end < 0 ? undefined : end)
}

export const extractGame = (): GameData => {
  const source = readFileSync(SOURCE_PATHS.game, 'utf8')
  return {
    items: extractLiteral(source, 'ITENS'),
    extra: extractLiteral(source, 'EXTRA'),
    rarityWeights: extractLiteral(source, 'RAR_W'),
    containers: extractLiteral(source, 'CONT_TAB'),
    fixed: extractLiteral(source, 'FIXOS'),
    factionLoot: extractLiteral(source, 'LOOT'),
    useItemSource: functionSource(source, 'useItem'),
  }
}
