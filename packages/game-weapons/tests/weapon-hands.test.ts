import { describe, expect, it } from 'vitest'

import { createArsenal, weaponHandsOf } from '../src'

describe('the hands of a weapon', () => {
  const arsenal = createArsenal()

  it('a handgun takes one hand and goes in the hip holster; a long gun takes both and goes on the back', () => {
    expect(weaponHandsOf(arsenal, 'glock_17')).toEqual({ hands: 1, slot: 'hip' })
    expect(weaponHandsOf(arsenal, 'pistol_9mm')).toEqual({ hands: 1, slot: 'hip' })
    for (const id of ['ak_47', 'colt_m4a1', 'shotgun_pump_12', 'rifle_bolt_308']) expect(weaponHandsOf(arsenal, id), id).toEqual({ hands: 2, slot: 'back' })
  })

  it('a machine pistol that goes one in each hand takes one hand; a two-handed tool takes both', () => {
    expect(weaponHandsOf(arsenal, 'mini_uzi').hands).toBe(1)
    expect(weaponHandsOf(arsenal, 'shovel').hands).toBe(2)
    expect(weaponHandsOf(arsenal, 'extinguisher')).toEqual({ hands: 2, slot: null })
    expect(weaponHandsOf(arsenal, 'lighter')).toEqual({ hands: 1, slot: 'hip' })
    expect(weaponHandsOf(arsenal, 'flamethrower')).toEqual({ hands: 2, slot: 'back' })
  })

  it('the bare hand, the body\'s own blows and an unknown id have nothing to put away', () => {
    for (const id of ['hand', 'kick', 'shove', 'fists']) expect(weaponHandsOf(arsenal, id), id).toEqual({ hands: 0, slot: null })
    expect(weaponHandsOf(arsenal, 'no_such_weapon')).toEqual({ hands: 0, slot: null })
  })

  it('follows the rules of the game', () => {
    const custom = createArsenal({ rules: { hands: { slots: { rifle: 'hip' } } } })
    expect(weaponHandsOf(custom, 'ak_47').slot).toBe('hip')
  })
})
