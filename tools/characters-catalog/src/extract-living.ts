import { cutBetween, evaluateLiteral, cutDeclaration, extractLiteral } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from './paths'
import { readSource } from './read-source'

type Rows = readonly (readonly unknown[])[]

export type LivingData = {
  readonly groups: Readonly<Record<string, Record<string, unknown>>>
  readonly people: readonly Record<string, unknown>[]
  readonly extraPeople: readonly Record<string, unknown>[]
  readonly relations: Rows
  readonly relationTypes: Readonly<Record<string, readonly string[]>>
  readonly joinRules: Rows
  readonly states: Rows
  readonly actions: readonly Record<string, unknown>[]
  readonly events: readonly Record<string, unknown>[]
  readonly risk: Rows
  readonly factions: readonly Record<string, unknown>[]
  readonly ranks: Rows
  readonly rankRule: string
  readonly loot: Rows
  readonly lootCategories: Readonly<Record<string, string>>
  readonly generics: Rows
  /** `rng`, `world`, `life`, `apply` and `simulate` plus their tables, verbatim: the life simulation of the valley, a game rule. */
  readonly lifeSimulationSource: string
}

export type PortraitData = {
  readonly people: readonly { readonly id: string; readonly n: string; readonly a: string; readonly g: string; readonly it: string; readonly b: Record<string, unknown> }[]
  readonly groupColors: Readonly<Record<string, string>>
  readonly eyeColors: Readonly<Record<string, number>>
}

const LIFE_START = 'function rng(seed){let a=seed>>>0;'
const LIFE_END = 'const esc=s=>String(s)'

export const extractLiving = (): LivingData => {
  const source = readSource(SOURCE_PATHS.livingValley)
  return {
    groups: extractLiteral(source, 'GROUPS'),
    people: extractLiteral(source, 'NPCS'),
    extraPeople: extractLiteral(source, 'EXTRA'),
    relations: extractLiteral(source, 'RELS'),
    relationTypes: extractLiteral(source, 'RELTYPES'),
    joinRules: extractLiteral(source, 'JOIN'),
    states: extractLiteral(source, 'STATES'),
    actions: extractLiteral(source, 'ACTS'),
    events: extractLiteral(source, 'EV'),
    risk: extractLiteral(source, 'RISK'),
    factions: extractLiteral(source, 'FACT'),
    ranks: extractLiteral(source, 'RANKS'),
    rankRule: evaluateLiteral<string>(cutDeclaration(source, 'RANKRULE').replace(/^const RANKRULE\s*=\s*/, '').replace(/;$/, '')),
    loot: extractLiteral(source, 'LOOT'),
    lootCategories: extractLiteral(source, 'LCAT'),
    generics: extractLiteral(source, 'GENT'),
    lifeSimulationSource: cutBetween(source, LIFE_START, LIFE_END).trimEnd(),
  }
}

export const extractPortraits = (): PortraitData => {
  const source = readSource(SOURCE_PATHS.portraits)
  return {
    people: extractLiteral(source, 'PEOPLE', { PM: { c: 0x5d6e7a, sl: 'long' } }),
    groupColors: extractLiteral(source, 'GC'),
    eyeColors: extractLiteral(source, 'EYE'),
  }
}
