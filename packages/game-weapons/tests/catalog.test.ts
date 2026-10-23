import { describe, expect, it } from 'vitest'

import { ARCHETYPE_IDS, CALIBERS, DEFAULT_LOADOUT, EXPLOSIVES, WEAPONS, checkArsenal, createArsenal } from '../src'
import type { WeaponDef } from '../src'

const arsenal = createArsenal()
const firearms = WEAPONS.filter((def): def is WeaponDef & { action: { kind: 'firearm'; caliber: string; muzzleSpeed?: number; barrel?: number } } => def.action.kind === 'firearm')
const SNAKE_CASE = /^[a-z0-9]+(_[a-z0-9]+)*$/

describe('shipped catalog', () => {
  it('is consistent: checkArsenal finds no problem', () => {
    expect(checkArsenal(arsenal)).toEqual([])
  })

  it('has the calibres, explosives and weapons of the team deliveries', () => {
    expect(CALIBERS).toHaveLength(28)
    expect(EXPLOSIVES).toHaveLength(17)
    expect(WEAPONS.filter((def) => def.sources?.includes('gallery'))).toHaveLength(79)
    expect(ARCHETYPE_IDS).toHaveLength(42)
  })

  it('has unique snake_case ids everywhere', () => {
    for (const ids of [WEAPONS.map((def) => def.id), CALIBERS.map((c) => c.id), EXPLOSIVES.map((e) => e.id)]) {
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) expect(id).toMatch(SNAKE_CASE)
    }
  })

  it('points every real weapon to an archetype that exists', () => {
    const real = WEAPONS.filter((def) => def.sources?.includes('gallery'))
    expect(real.length).toBeGreaterThan(70)
    for (const def of real) expect(ARCHETYPE_IDS, def.id).toContain(def.archetype)
  })

  it('keeps the default loadout available', () => {
    for (const id of DEFAULT_LOADOUT) expect(arsenal.weapons.has(id), id).toBe(true)
  })

  it('takes firearm noise from the calibre, not from the weapon', () => {
    for (const def of firearms) expect(def.action.noise, def.id).toBeUndefined()
    for (const caliber of CALIBERS) expect(caliber.noise, caliber.id).toBeGreaterThan(0)
  })

  it('gives every firearm modes, a rate, and positive handling times', () => {
    for (const def of firearms) {
      expect(def.action.modes.length, def.id).toBeGreaterThan(0)
      expect(def.action.rpm, def.id).toBeGreaterThan(0)
    }
    for (const def of WEAPONS.filter((entry) => entry.sources?.includes('gallery'))) {
      const timings = 'timings' in def.action ? def.action.timings : undefined
      expect(timings, def.id).toBeDefined()
      expect(timings?.draw, def.id).toBe(0.35)
      expect(timings?.clear, def.id).toBe(1.2)
    }
  })
})

describe('energy', () => {
  it('is half the bullet mass times the weapon speed squared, in physical ranges', () => {
    for (const def of firearms) {
      const caliber = arsenal.calibers.get(def.action.caliber)
      const speed = def.action.muzzleSpeed ?? (caliber?.muzzleSpeed ?? 0) * (def.action.barrel ?? 1)
      expect(arsenal.energy(def.id), def.id).toBeCloseTo(0.5 * ((caliber?.bulletGrams ?? 0) / 1000) * speed * speed, 6)
    }
    for (const def of firearms.filter((entry) => entry.action.caliber === '9x19')) {
      expect(arsenal.energy(def.id), def.id).toBeGreaterThan(300)
      expect(arsenal.energy(def.id), def.id).toBeLessThan(700)
    }
    for (const def of firearms.filter((entry) => entry.action.caliber === '50bmg')) {
      expect(arsenal.energy(def.id), def.id).toBeGreaterThan(14000)
      expect(arsenal.energy(def.id), def.id).toBeLessThan(20000)
    }
  })

  it('is the blast of the projectile for a launcher and of the explosive for a throwable', () => {
    expect(arsenal.energy('rpg_7')).toBe(arsenal.explosives.get('pg7v')?.energy)
    expect(arsenal.energy('frag_grenade')).toBe(arsenal.explosives.get('m67')?.energy)
    expect(arsenal.energy('hand')).toBe(0)
  })
})

describe('explosives', () => {
  it('scale the energy with the cube of the lethal radius from the M67 (Hopkinson)', () => {
    const m67 = arsenal.explosives.get('m67')
    for (const explosive of EXPLOSIVES) {
      if (['molotov', 'claymore', 'flashbang'].includes(explosive.id)) continue
      const expected = (m67?.energy ?? 0) * Math.pow(explosive.lethalRadius / (m67?.lethalRadius ?? 1), 3)
      expect(explosive.energy, explosive.id).toBeCloseTo(expected, 1)
    }
  })

  it('give the throwables their energy, noise and radius', () => {
    const pipe = arsenal.explosives.get('pipe_bomb')
    const action = arsenal.weapons.get('pipe_bomb')?.action
    expect(action?.kind === 'throwable' && [action.explosive, action.energy, action.noise, action.radius]).toEqual(['pipe_bomb', pipe?.energy, pipe?.noise, pipe?.lethalRadius])
  })

  it('name every projectile of every launcher', () => {
    for (const def of WEAPONS) if (def.action.kind === 'launcher') expect(arsenal.explosives.has(def.action.projectile), def.id).toBe(true)
  })
})
