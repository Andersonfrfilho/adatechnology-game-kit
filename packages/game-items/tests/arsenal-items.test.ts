import { readFileSync } from 'node:fs'

import { createArsenal } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'

import { createItems, itemsFromArsenal } from '../src'
import type { ArsenalItemRecord } from '../src'

const arsenal = createArsenal()
const records = JSON.parse(readFileSync(new URL('../../game-items-goods/src/data/ammo-boxes.json', import.meta.url), 'utf8')) as ArsenalItemRecord[]
const pack = itemsFromArsenal(arsenal, { records })
const catalog = createItems({ packs: [pack] })

const firearms = [...arsenal.weapons.values()].filter((weapon) => weapon.action.kind === 'firearm')
const throwables = [...arsenal.weapons.values()].filter((weapon) => weapon.action.kind === 'throwable')

describe('itemsFromArsenal', () => {
  it('makes a box per calibre, a firearm per firearm and a throwable per throwable, in a consistent catalog', () => {
    expect(catalog.byCategory('ammo')).toHaveLength(arsenal.calibers.size)
    expect(catalog.byCategory('firearms')).toHaveLength(firearms.length)
    expect(catalog.byCategory('throwables')).toHaveLength(throwables.length)
    expect([...catalog.categories.keys()]).toEqual(expect.arrayContaining(['ammo', 'firearms', 'throwables']))
  })

  it('takes mass and length from the weapon definition', () => {
    const glock = arsenal.weapons.get('glock_17')
    const item = catalog.get('firearm_glock_17')
    expect(item).toMatchObject({ category: 'firearms', weight: glock?.mass, weapon: 'glock_17', rarity: 'unique' })
    expect(item.size[0]).toBeCloseTo(0.202)
    expect(item.size[1]).toBeLessThan(item.size[0])
  })

  it('gives a firearm without dimensions a length from its mass', () => {
    const bare = [...arsenal.weapons.values()].find((weapon) => weapon.action.kind === 'firearm' && !weapon.dimensions)
    expect(bare).toBeDefined()
    const item = catalog.get(`firearm_${bare?.id}`)
    expect(item.size[0]).toBeCloseTo(0.15 + 0.2 * (bare?.mass ?? 0))
  })

  it('uses the box of the team game where it listed one: 9x19 is 20 rounds in 0.24 kg, 7.62x39 is rare', () => {
    expect(catalog.get('ammo_9x19')).toMatchObject({ category: 'ammo', weight: 0.24, rarity: 'uncommon' })
    expect(catalog.get('ammo_12ga_00buck').weight).toBe(0.4)
    expect(catalog.get('ammo_7_62x39')).toMatchObject({ weight: 0.54, rarity: 'rare' })
    expect(catalog.get('ammo_7_62x51')).toMatchObject({ weight: 0.25, rarity: 'rare' })
  })

  it('sizes the box to hold its rounds (20 of 9x19 in a tray around 56 x 35 x 46 mm)', () => {
    const [width, height, depth] = catalog.get('ammo_9x19').size
    expect(width).toBeGreaterThan(0.04)
    expect(width).toBeLessThan(0.08)
    expect(height).toBeCloseTo((arsenal.calibers.get('9x19')?.cartridge?.overallLength ?? 0) * 0.001 + 0.006, 4)
    expect(depth).toBeGreaterThan(0.03)
  })

  it('estimates the calibres the game has no box for from the calibre (REF)', () => {
    const rifle = catalog.get('ammo_5_56x45')
    expect(rifle.weight).toBeGreaterThan(0.1)
    expect(rifle.weight).toBeLessThan(0.5)
    const pistol = catalog.get('ammo_45acp')
    expect(pistol.weight).toBeGreaterThan(rifle.weight - 0.1)
    expect(catalog.get('ammo_arrow').weight).toBeGreaterThan(0)
  })

  it('keeps the throwable of the game under its id, linked to the weapon that uses the explosive', () => {
    expect(catalog.get('throwable_m67')).toMatchObject({ weight: 0.4, weapon: 'frag_grenade' })
    expect(catalog.get('throwable_molotov')).toMatchObject({ weight: 0.8, weapon: 'molotov' })
  })

  it('keeps the three firearms of the game with the game weight', () => {
    expect(catalog.get('firearm_remington_870').weight).toBe(3.6)
    expect(catalog.get('firearm_ak_47').weight).toBe(4.3)
    expect(catalog.get('firearm_remington_700').weight).toBe(4)
  })

  it('works without records, all estimated, and is stable', () => {
    const first = itemsFromArsenal(arsenal)
    expect(first.items.map((item) => item.id)).toContain('ammo_9x19')
    expect(itemsFromArsenal(arsenal)).toEqual(first)
    expect(createItems({ packs: [first] }).get('ammo_9x19').weight).toBeGreaterThan(0)
  })

  it('works with a structural arsenal (no import of the weapons package)', () => {
    const tiny = itemsFromArsenal({
      weapons: new Map([['pistol', { id: 'pistol', mass: 1, action: { kind: 'firearm' } }]]),
      calibers: new Map([['9x19', { id: '9x19', bulletGrams: 7.5, caseType: 'pistol' }]]),
    })
    expect(tiny.items.map((item) => item.id)).toEqual(['ammo_9x19', 'firearm_pistol'])
  })
})
