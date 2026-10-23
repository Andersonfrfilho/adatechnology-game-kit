import { describe, expect, it } from 'vitest'

import { createArsenal } from '../src'
import type { WeaponDef } from '../src'

const custom = (id: string, patch: Partial<WeaponDef['action']> = {}): WeaponDef => ({
  id,
  category: 'pistol',
  mass: 1,
  action: { kind: 'firearm', caliber: '9x19', rpm: 300, modes: ['semi'], magazine: 10, reload: 2, spreadDeg: 1, recoil: [1, 1], range: 50, ...patch } as WeaponDef['action'],
})

describe('arsenal options', () => {
  it('patches nested fields without losing the rest', () => {
    const arsenal = createArsenal({ patch: { weapons: { glock_17: { action: { timings: { reload: 1.2 }, magazine: 33 }, dimensions: { barrel: 0.2 } } } } })
    const glock = arsenal.weapons.get('glock_17')
    expect(glock?.action.kind === 'firearm' && glock.action.timings).toMatchObject({ draw: 0.35, reload: 1.2, clear: 1.2 })
    expect(glock?.action.kind === 'firearm' && glock.action.magazine).toBe(33)
    expect(glock?.dimensions).toMatchObject({ length: 0.202, barrel: 0.2 })
  })

  it('patches calibres and explosives, and a throwable follows its explosive', () => {
    const arsenal = createArsenal({ patch: { calibers: { '9x19': { noise: 99 } }, explosives: { m67: { energy: 123456, lethalRadius: 7 } } } })
    expect(arsenal.calibers.get('9x19')?.noise).toBe(99)
    const grenade = arsenal.weapons.get('frag_grenade')?.action
    expect(grenade?.kind === 'throwable' && [grenade.energy, grenade.radius]).toEqual([123456, 7])
  })

  it('adds and replaces by id, removes, and filters with include', () => {
    const arsenal = createArsenal({
      weapons: [custom('my_gun'), { ...custom('glock_17'), name: 'Replaced' }],
      remove: { weapons: ['hammer'], explosives: ['claymore'] },
      include: (def) => def.archetype === undefined,
    })
    expect(arsenal.weapons.has('my_gun')).toBe(true)
    expect(arsenal.weapons.has('hammer')).toBe(false)
    expect(arsenal.explosives.has('claymore')).toBe(false)
    expect(arsenal.weapons.get('glock_17')?.name).toBe('Replaced')
    expect([...arsenal.weapons.values()].every((def) => def.archetype === undefined)).toBe(true)
  })

  it('merges rules and strings over the defaults', () => {
    const arsenal = createArsenal({ locale: 'pt-BR', rules: { heat: { cap: 200 }, faults: false }, strings: { weapons: { glock_17: 'Minha pistola' } } })
    expect(arsenal.rules.heat).toMatchObject({ cap: 200, displayMax: 120, faultFrom: 60 })
    expect(arsenal.rules.faults).toBe(false)
    expect(arsenal.rules.conditions).toHaveLength(4)
    expect(arsenal.name('glock_17')).toBe('Minha pistola')
    expect(arsenal.name('boito_double_barrel')).toBe('Boito (2 canos)')
    expect(arsenal.name('m67')).toBe('Granada M67')
    expect(arsenal.name('stovepipe')).toBe('chaminé')
  })

  it('replaces the fault chance with a plugin', () => {
    const arsenal = createArsenal({ rules: { faultChance: () => 0.5 } })
    const def = arsenal.weapons.get('glock_17') as WeaponDef
    const condition = arsenal.rules.conditions[0]
    expect(condition && arsenal.rules.faultChance({ def, condition, heat: 0 })).toBe(0.5)
  })

  it('names with the English defaults when the locale is unknown', () => {
    const arsenal = createArsenal({ locale: 'xx' })
    expect(arsenal.name('m67')).toBe('M67 fragmentation grenade')
    expect(arsenal.name('volley')).toBe('volley')
  })
})

describe('checkArsenal through createArsenal', () => {
  it('reports every problem at once', () => {
    const broken = [
      custom('bad_caliber', { caliber: 'nope' }),
      custom('bad_modes', { modes: [] }),
      custom('bad_time', { timings: { draw: 0, reload: 1, clear: 1.2 } }),
      { ...custom('bad_explosive'), action: { kind: 'launcher', projectile: 'missing', magazine: 1, reload: 1, family: 'rocket', speed: 100, minArmDistance: 10, backblast: 5, recoil: [1, 1] } } as WeaponDef,
    ]
    let message = ''
    try {
      createArsenal({ weapons: [...broken, custom('twice'), custom('twice')] })
    } catch (error) {
      message = (error as Error).message
    }
    for (const part of ['unknown calibre "nope"', 'no fire modes', 'draw time of 0 s', 'unknown explosive "missing"', 'weapon "twice" is listed more than once']) expect(message).toContain(part)
  })
})
