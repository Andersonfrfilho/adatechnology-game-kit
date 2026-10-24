import { readFileSync } from 'node:fs'

import { valueOf } from './decisions'
import { WEAPONS_CALIBERS_PATH } from './paths'
import type { Sources } from './sources'

export type GameItemRecord =
  | { id: string; teamId: string; kind: 'ammo_box'; caliber: string; rounds: number; weight: number; rarity: string }
  | { id: string; teamId: string; kind: 'firearm'; weapon: string; weight: number; rarity: string }
  | { id: string; teamId: string; kind: 'throwable'; weapon: string; weight: number; rarity: string }

const loadCaliberIds = (): Set<string> => new Set((JSON.parse(readFileSync(WEAPONS_CALIBERS_PATH, 'utf8')) as { id: string }[]).map((caliber) => caliber.id))

/** The arsenal as items (`EXTRA` of the game): ammo boxes, the three guns, the grenade and the molotov; the two story items stay with the game. */
export const buildAmmoBoxes = ({ game, decisions }: Sources): GameItemRecord[] => {
  const calibers = loadCaliberIds()
  return game.extra.flatMap((item): GameItemRecord[] => {
    if (decisions.gameOnlyExtras[item.id]) return []
    const rarity = valueOf(decisions.rarityMap, item.rar, 'rarity')
    if (item.cat === 'mun') {
      const caliber = valueOf(decisions.caliberMap, item.cal ?? '', 'caliber')
      if (!calibers.has(caliber)) throw new Error(`items-catalog: game-weapons has no caliber "${caliber}"`)
      return [{ id: `ammo_${caliber}`, teamId: item.id, kind: 'ammo_box', caliber, rounds: item.q ?? 0, weight: item.kg, rarity }]
    }
    const weapon = valueOf(decisions.gameWeaponMap, item.id, 'game weapon')
    if (item.cat === 'arma') return [{ id: `firearm_${weapon}`, teamId: item.id, kind: 'firearm', weapon, weight: item.kg, rarity }]
    return [{ id: `throwable_${weapon}`, teamId: item.id, kind: 'throwable', weapon, weight: item.kg, rarity }]
  })
}
