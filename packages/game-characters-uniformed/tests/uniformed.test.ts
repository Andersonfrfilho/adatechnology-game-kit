import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createCharacters } from '@adatechnology/game-characters'
import { describe, expect, it } from 'vitest'

import { FORCES, LOADOUTS, LOOT_POOLS, RANKS, UNIFORMED_LOCALES, createForceFinds, createUniformedPack, obeysOrder, pickCommander, rankOrder, ranksOf } from '../src'

const weaponIds = (file: string): string[] =>
  (JSON.parse(readFileSync(fileURLToPath(new URL(`../../game-weapons/src/data/${file}`, import.meta.url)), 'utf8')) as { id: string }[]).map((entry) => entry.id)
const KNOWN_WEAPONS = new Set([...weaponIds('firearms.json'), ...weaponIds('explosives.json'), ...weaponIds('explosive-weapons.json')])

describe('forces', () => {
  it('has the 7 generic forces with the real Brazilian names as br content', () => {
    expect(FORCES.map((force) => force.id)).toEqual(['army', 'military_police', 'civil_police', 'highway_police', 'prison_police', 'special_forces', 'tactical_unit'])
    for (const force of FORCES) {
      expect(force.region).toBe('br')
      expect(force.color).toMatch(/^[0-9A-F]{6}$/)
      expect(RANKS.ladders[force.ranks]).toBeDefined()
    }
    expect(FORCES.find((force) => force.id === 'highway_police')?.name['pt-BR']).toBe('Polícia Rodoviária Federal')
  })

  it('keeps the valley out of the SDK data', () => {
    const text = JSON.stringify({ FORCES, RANKS, LOADOUTS, LOOT_POOLS })
    expect(text).not.toMatch(/7º BIS|Vale|Santa Aurora|Bloqueio|Ferraz|Brasa/)
  })
})

describe('ranks and the command rule', () => {
  it('orders the army ladder from private to colonel', () => {
    const army = ranksOf('army')
    expect(army[0]?.id).toBe('private')
    expect(army.at(-1)?.id).toBe('colonel')
    expect(rankOrder('army', 'captain')).toBeGreaterThan(rankOrder('army', 'sergeant_1st'))
    expect(ranksOf('special_forces')).toEqual(army)
  })

  it('reads the thresholds of the page: command from 100, disobedience below -20', () => {
    expect(RANKS.rule.commander.minimumCourageAndLoyalty).toBe(100)
    expect(RANKS.rule.disobeyBelowOpinion).toBe(-20)
  })

  it('gives command to the highest rank alive that is brave and loyal enough', () => {
    const members = [
      { id: 'a', force: 'army', rank: 'corporal', courage: 70, loyalty: 60 },
      { id: 'b', force: 'army', rank: 'major', courage: 40, loyalty: 50 },
      { id: 'c', force: 'army', rank: 'captain', courage: 60, loyalty: 60, alive: false },
      { id: 'd', force: 'army', rank: 'sergeant_1st', courage: 50, loyalty: 50 },
    ] as const
    expect(pickCommander(members)?.id).toBe('d')
    expect(pickCommander([])).toBeUndefined()
  })

  it('makes a higher rank beat opinion, until the opinion falls below -20', () => {
    const superior = { force: 'army', rank: 'captain' } as const
    const subordinate = { force: 'army', rank: 'private' } as const
    expect(obeysOrder({ superior, subordinate, opinion: -20 })).toBe(true)
    expect(obeysOrder({ superior, subordinate, opinion: -21 })).toBe(false)
    expect(obeysOrder({ superior: subordinate, subordinate: superior, opinion: 90 })).toBe(false)
    expect(obeysOrder({ superior: { force: 'civil_police', rank: 'chief_of_police' }, subordinate, opinion: 90 })).toBe(false)
  })
})

describe('loadouts', () => {
  it('names only weapons that game-weapons has', () => {
    expect(Object.keys(LOADOUTS)).toHaveLength(7)
    for (const loadout of Object.values(LOADOUTS)) for (const weapon of loadout.weapons) expect(KNOWN_WEAPONS.has(weapon)).toBe(true)
  })

  it('turns them into presets with the protection they wear', () => {
    const kit = createCharacters({ packs: [createUniformedPack()] })
    const soldier = kit.create({ seed: 1, kind: 'army_soldier' })
    expect(soldier.spec.protection).toEqual(['helmet_combat', 'vest_police'])
    expect(kit.create({ seed: 2, kind: 'riot_police' }).spec.protection).toContain('helmet_riot')
  })
})

describe('loot pools', () => {
  it('has a pool per force, without the unique quest items', () => {
    expect(Object.keys(LOOT_POOLS)).toEqual(FORCES.map((force) => force.id))
    const ids = Object.values(LOOT_POOLS).flat().map((entry) => entry.itemId)
    expect(ids).not.toContain('bunker_card')
    expect(Object.values(LOOT_POOLS).flat().every((entry) => entry.rarity !== 'único')).toBe(true)
    expect(Object.values(LOOT_POOLS).flat().length).toBe(42)
  })

  it('answers like a FindsProvider, deterministically, from the generator of the query', () => {
    const finds = createForceFinds()
    const query = (values: number[]) => {
      let index = 0
      return { place: 'checkpoint', container: 'army', state: 'normal', rng: () => values[index++ % values.length] ?? 0 }
    }
    const first = finds.findsFor(query([0.01]))
    expect(first.length).toBe(LOOT_POOLS.army?.length)
    expect(finds.findsFor(query([0.99]))).toEqual([])
    expect(finds.findsFor({ ...query([0.01]), container: 'house', key: 'prison_police' }).length).toBe(LOOT_POOLS.prison_police?.length)
    expect(finds.findsFor({ ...query([0.01]), container: 'fridge' })).toEqual([])
    expect(createForceFinds({ chanceOf: () => 0 }).findsFor(query([0.5]))).toEqual([])
  })
})

describe('locales', () => {
  it('covers the categories and rarities in en and pt-BR', () => {
    const rarities = new Set(Object.values(LOOT_POOLS).flat().map((entry) => entry.rarity))
    for (const locale of Object.values(UNIFORMED_LOCALES)) {
      expect(Object.keys(locale.categories)).toHaveLength(7)
      for (const rarity of rarities) expect(locale.rarities[rarity]).toBeDefined()
    }
  })
})
