import { describe, expect, it } from 'vitest'

import { createArsenal, createMeleeBlowCycle, MELEE_FAMILIES, meleeFamilyOf, meleeStrikeClips } from '../src'

describe('melee families', () => {
  it('names only melee weapons of the arsenal', () => {
    const arsenal = createArsenal()
    for (const family of MELEE_FAMILIES) {
      for (const id of family.weapons) expect(arsenal.weapons.get(id)?.action.kind, id).toBe('melee')
      expect(family.blows.length).toBeGreaterThan(0)
      for (const blow of family.blows) expect(blow.seconds).toBeGreaterThan(0)
    }
  })

  it('puts the knife in the short-blade family, a cut then a thrust', () => {
    expect(meleeFamilyOf('knife')?.id).toBe('short_blade')
    expect(meleeFamilyOf('shovel')).toBeUndefined()
    expect(meleeStrikeClips().knife).toBe('knife_slash')
  })

  it('swings a bat with both hands and chops with a machete, and puts no weapon in two families', () => {
    expect(meleeFamilyOf('baseball_bat')?.blows[0]).toMatchObject({ clip: 'bat_swing', motion: 'bat_swing' })
    // a pipe, a crowbar and a sledgehammer are clubs swung as the bat; an axe keeps the shovel's low swing
    for (const club of ['iron_pipe', 'crowbar', 'sledgehammer', 'nail_bat']) expect(meleeFamilyOf(club)?.id, club).toBe('bat_swing')
    expect(meleeFamilyOf('axe')?.blows[0]?.motion).toBe('swing')
    expect(meleeFamilyOf('machete')?.blows[0]?.motion).toBe('chop')
    const all = MELEE_FAMILIES.flatMap((family) => family.weapons)
    expect(new Set(all).size).toBe(all.length)
  })

  it('alternates the blows and starts over after a pause', () => {
    const cycle = createMeleeBlowCycle()
    expect(cycle.next('knife', 0)?.motion).toBe('slash')
    expect(cycle.next('knife', 0.5)?.motion).toBe('stab')
    expect(cycle.next('knife', 1)?.motion).toBe('slash')
    expect(cycle.next('knife', 5)?.motion).toBe('slash')
    expect(cycle.next('pistol_9mm', 5)).toBeUndefined()
  })
})
