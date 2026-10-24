/**
 * @adatechnology/game-characters-uniformed: generic uniformed forces for `game-characters`, with the real Brazilian names as `br` content. 7 forces,
 * rank ladders with the command rule, loadouts as item and weapon ids and loot pools shaped like a `FindsProvider`. The valley and its units are the game's.
 */
import type { CharacterPack } from '@adatechnology/game-characters'

import { FORCES, LOADOUTS, LOOT_POOLS, RANKS } from './data'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'
import type { Force, ForceId, LocaleId, UniformedLocale } from './types'

export type * from './types'
export { FORCES, LOADOUTS, LOOT_POOLS, RANKS }
export { obeysOrder, pickCommander, rankOrder, ranksOf } from './rank-rule'
export type { Member, OrderParams } from './rank-rule'
export { createForceFinds } from './finds'
export type { ForceFindsOptions } from './finds'

export const UNIFORMED_LOCALES = { en, 'pt-BR': ptBR } as unknown as Readonly<Record<LocaleId, UniformedLocale>>

export const getForce = (id: ForceId): Force | undefined => FORCES.find((force) => force.id === id)

const PROTECTION_ITEM_IDS = new Set(Object.values(LOOT_POOLS).flatMap((pool) => pool.filter((entry) => entry.category === 'protection').map((entry) => entry.itemId)))

/** The loadouts as presets of `createCharacters({ packs: [createUniformedPack()] })`: `kit.create({ seed, kind: 'riot_police' })`. */
export const createUniformedPack = (): CharacterPack => ({
  id: 'uniformed',
  presets: Object.entries(LOADOUTS).map(([id, loadout]) => ({
    id,
    kind: 'person',
    age: 'adult',
    protection: loadout.items.filter((itemId) => PROTECTION_ITEM_IDS.has(itemId)),
    traits: { force: loadout.force, weapons: loadout.weapons, weaponChoice: loadout.weaponChoice, items: loadout.items },
  })),
})
