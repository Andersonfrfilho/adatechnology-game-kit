import { describe, expect, it } from 'vitest'

import { canDualWield, createArsenal } from '../src'
import type { WeaponState } from '../src'

const fireOnce = (state: WeaponState): ReturnType<WeaponState['trigger']> => {
  state.update(1)
  return state.trigger([0, 0, 0], [0, 0, -1], 1 / 60, false)
}

describe('a weapon in each hand', () => {
  const arsenal = createArsenal()

  it('takes the handguns, the machine pistols and the one-hand blades, never a rifle, a long gun or a two-hand tool', () => {
    for (const id of ['glock_17', 'beretta_92fs', 'desert_eagle_mark_xix', 'sw_686', 'taurus_82', 'pistol_9mm', 'mini_uzi', 'uzi', 'mac_10', 'vz61', 'hk_mp7a1', 'knife', 'tactical_knife', 'machete', 'hatchet']) {
      expect(canDualWield(arsenal, id), id).toBe(true)
    }
    for (const id of ['ak_47', 'colt_m4a1', 'hk_mp5a3', 'fn_p90', 'shotgun_pump_12', 'rpg_7', 'axe', 'sledgehammer', 'frag_grenade', 'flamethrower', 'hand', 'no_such_weapon']) {
      expect(canDualWield(arsenal, id), id).toBe(false)
    }
  })

  it('follows the rules of the game: a list added, a weapon left out', () => {
    const custom = createArsenal({ rules: { dualWield: { weapons: ['hk_mp5k'], exclude: ['desert_eagle_mark_xix'] } } })
    expect(canDualWield(custom, 'hk_mp5k')).toBe(true)
    expect(canDualWield(custom, 'mini_uzi')).toBe(false)
    expect(canDualWield(custom, 'desert_eagle_mark_xix')).toBe(false)
    expect(canDualWield(custom, 'glock_17')).toBe(true)
  })

  it('opens the spread and lifts the recoil of a weapon held in one hand, and back when the other hand is free', () => {
    const one = arsenal.create('glock_17', { seed: 3 })
    const dual = arsenal.create('glock_17', { seed: 3 })
    dual.setStance({ dualWield: true })
    const rule = arsenal.rules.dualWield
    expect(dual.spread).toBeCloseTo(one.spread * rule.spread, 9)
    const shotOne = fireOnce(one)
    const shotDual = fireOnce(dual)
    expect(shotOne.status).toBe('ok')
    expect(shotDual.status).toBe('ok')
    expect(shotDual.recoil[0]).toBeCloseTo(shotOne.recoil[0] * rule.recoil, 9)
    dual.setStance({ dualWield: false })
    expect(dual.spread).toBeCloseTo(one.spread, 9)
  })

  it('does not aim with a weapon in each hand: the stance stays at the hip', () => {
    const state = arsenal.create('glock_17', { seed: 1 })
    state.setStance({ aiming: true })
    const aimed = state.spread
    state.setStance({ dualWield: true, aiming: true })
    const hip = arsenal.create('glock_17', { seed: 1 })
    hip.setStance({ dualWield: true })
    expect(state.spread).toBeCloseTo(hip.spread, 9)
    expect(state.spread).toBeGreaterThanOrEqual(aimed)
  })

  it('keeps a magazine and a reload per weapon: two of the same weapon count their rounds apart', () => {
    const right = arsenal.create('glock_17', { seed: 1 })
    const left = arsenal.create('glock_17', { seed: 2 })
    right.setStance({ dualWield: true })
    left.setStance({ dualWield: true })
    expect(fireOnce(right).status).toBe('ok')
    expect(right.ammo).toBe(right.capacity - 1)
    expect(left.ammo).toBe(left.capacity)
    expect(right.reload()).toBe(true)
    expect(right.reloading).toBe(true)
    expect(left.reloading).toBe(false)
  })
})
