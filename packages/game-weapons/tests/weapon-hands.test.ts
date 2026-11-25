import { describe, expect, it } from 'vitest'

import { createArsenal, weaponHandsOf } from '../src'

describe('the hands of a weapon', () => {
  const arsenal = createArsenal()

  it('a handgun takes one hand and goes in the hip holster; a rifle or a shotgun takes both and hangs on its sling', () => {
    expect(weaponHandsOf(arsenal, 'glock_17')).toEqual({ hands: 1, slot: 'hip' })
    expect(weaponHandsOf(arsenal, 'pistol_9mm')).toEqual({ hands: 1, slot: 'hip' })
    for (const id of ['ak_47', 'colt_m4a1', 'shotgun_pump_12', 'rifle_bolt_308']) expect(weaponHandsOf(arsenal, id), id).toEqual({ hands: 2, slot: 'sling' })
  })

  it('a machine pistol that goes one in each hand takes one hand; a two-handed tool takes both', () => {
    expect(weaponHandsOf(arsenal, 'mini_uzi').hands).toBe(1)
    expect(weaponHandsOf(arsenal, 'extinguisher')).toEqual({ hands: 2, slot: null })
    expect(weaponHandsOf(arsenal, 'lighter')).toEqual({ hands: 1, slot: 'hip' })
    expect(weaponHandsOf(arsenal, 'flamethrower')).toEqual({ hands: 2, slot: 'back' })
  })

  it('the two-hand melee weapons (axe, sledgehammer, pickaxe, shovel, katana, chainsaw) take both hands; the hatchet and the hammer take one', () => {
    for (const id of ['axe', 'sledgehammer', 'pickaxe', 'shovel', 'katana']) expect(weaponHandsOf(arsenal, id), id).toEqual({ hands: 2, slot: 'back' })
    expect(weaponHandsOf(arsenal, 'chainsaw')).toEqual({ hands: 2, slot: null })
    for (const id of ['hatchet', 'hammer', 'machete', 'knife']) expect(weaponHandsOf(arsenal, id).hands, id).toBe(1)
    for (const id of ['axe', 'sledgehammer', 'pickaxe', 'chainsaw']) expect(arsenal.weapons.get(id)?.tags, id).toContain('two_handed')
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
