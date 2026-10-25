import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXPLOSIONS, EXPLOSION_ALIASES, createVfx, estimateCost, patchExplosions } from '../src'
import type { ExplosionDef } from '../src'

const SHEET_NUMBERS: Readonly<Record<string, number>> = {
  m67: 214,
  molotov: 27,
  pipe_bomb: 276,
  propane_p13: 222,
  dynamite: 172,
  c4: 292,
  claymore: 748,
  flashbang: 70,
  m79_40mm: 182,
  m72_66mm: 248,
  at4_84mm: 298,
  pg7v: 300,
  fuel_barrel: 186,
  car_fuel_tank: 260,
  fuel_pump: 154,
  fuel_station_tank: 416,
}

describe('the catalogue of the Lab', () => {
  it('has the 16 profiles by explosive id, a generic one and the two aliases', () => {
    expect(Object.keys(EXPLOSIONS).sort()).toEqual([...Object.keys(SHEET_NUMBERS), 'generic'].sort())
    expect(EXPLOSION_ALIASES).toEqual({ carl_gustaf_84mm: 'at4_84mm', vog_25: 'm79_40mm' })
  })

  it('answers for every explosive of game-weapons', () => {
    const explosives = JSON.parse(readFileSync(new URL('../../game-weapons/src/data/explosives.json', import.meta.url), 'utf8')) as { id: string }[]
    const vfx = createVfx({ profile: 'low' })
    expect(explosives).toHaveLength(18)
    for (const { id } of explosives) expect(vfx.explosion(id, [0, 0, 0]), id).not.toBeNull()
    expect(vfx.explosion('generic', [0, 0, 0])).not.toBeNull()
    expect(vfx.explosion('nothing', [0, 0, 0])).toBeNull()
  })

  it('every profile carries its id and the Lab lines it comes from', () => {
    for (const [id, def] of Object.entries(EXPLOSIONS)) {
      expect(def.id).toBe(id)
      expect(def.sources.length, id).toBeGreaterThan(0)
      for (const source of def.sources) expect(source).toMatch(/^(lab:L\d+|derived: .+)$/)
    }
  })

  it('estimateCost is the number the Lab sheet shows', () => {
    for (const [id, expected] of Object.entries(SHEET_NUMBERS)) expect(estimateCost(EXPLOSIONS[id]!), id).toBe(expected)
    expect(estimateCost(EXPLOSIONS.generic!)).toBe(SHEET_NUMBERS.m67)
  })

  it('the numbers are the Lab ones', () => {
    expect(EXPLOSIONS.m67).toMatchObject({ lethal: 5, injury: 15, visualRadius: 1.3, fireballs: 16, shake: 1.1, push: 9, smoke: { count: 18, life: 5.5 }, shrapnel: { count: 150, speed: 34 } })
    expect(EXPLOSIONS.molotov).toMatchObject({ fuel: true, heat: 0.95, heatLifeScale: 1.5, shock: false, ignite: 4.2, smoke: { count: 3, life: 3.5 } })
    expect(EXPLOSIONS.claymore).toMatchObject({ cone: { angle: 0, half: Math.PI / 6, length: 50 }, directionBias: 2, shrapnel: { count: 700, kind: 1, width: 0.025 } })
    expect(EXPLOSIONS.flashbang).toMatchObject({ flash: { light: 160, life: 0.2, color: 0xf4f6ff, intensity: 14, blinding: true }, shock: false, shrapnel: { count: 60, kind: 2 } })
    expect(EXPLOSIONS.c4).toMatchObject({ shock: { duration: 0.28 }, heat: 1.25, flash: { light: 90, life: 0.35, color: 0xfff0d0, intensity: 9 } })
    expect(EXPLOSIONS.fuel_station_tank?.mushroom).toEqual({ height: 16, radius: 5.5, count: 60, stem: 26, life: 12, riseRate: 0.42 })
    expect(EXPLOSIONS.fuel_station_tank?.residualFires).toEqual([
      { radius: 3.2, life: 20, rate: 26, smoke: 1.4 },
      { dx: 4, dz: 3, radius: 1.4, life: 16 },
      { dx: -4, dz: 2, radius: 1.2, life: 15 },
    ])
    expect(EXPLOSIONS.fuel_barrel?.hotParts).toBe(true)
    expect(EXPLOSIONS.pg7v?.shrapnel.embers).toBe(20)
  })

  it('generic is the M67 under another id', () => {
    const { id: _genericId, sources: _genericSources, ...generic } = EXPLOSIONS.generic as ExplosionDef
    const { id: _m67Id, sources: _m67Sources, ...m67 } = EXPLOSIONS.m67 as ExplosionDef
    expect(generic).toEqual(m67)
  })

  it('patchExplosions changes, adds and removes profiles without touching the original', () => {
    const patched = patchExplosions(EXPLOSIONS, { m67: { lethal: 7 }, mine: { ...EXPLOSIONS.m67!, injury: 99 }, c4: null })
    expect(patched.m67!.lethal).toBe(7)
    expect(patched.m67!.injury).toBe(15)
    expect(patched.mine).toMatchObject({ id: 'mine', injury: 99 })
    expect(patched.c4).toBeUndefined()
    expect(EXPLOSIONS.m67!.lethal).toBe(5)
    expect(EXPLOSIONS.c4).toBeDefined()
    const vfx = createVfx({ explosions: patched, profile: 'low' })
    expect(vfx.explosion('c4', [0, 0, 0])).toBeNull()
    expect(vfx.explosion('mine', [0, 0, 0])).not.toBeNull()
  })
})
