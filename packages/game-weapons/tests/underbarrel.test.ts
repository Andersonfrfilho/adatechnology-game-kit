import { describe, expect, it } from 'vitest'

import { createArsenal } from '../src'
import type { Vec3, WeaponState } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const arsenal = createArsenal({ rules: { faults: false } })

const withLauncher = (weapon: string, launcher: string, seed = 1): WeaponState => {
  const state = arsenal.create(weapon, { seed })
  const result = state.fit(launcher, { install: 'bench' })
  if (!result.ok) throw new Error(`${launcher} on ${weapon}: ${result.reason}`)
  state.update(60)
  state.drain()
  return state
}

const switched = (state: WeaponState, on: boolean): void => {
  expect(state.useUnderbarrel(on)).toBe(true)
  state.update(5)
  state.drain()
}

describe('launchers that go under a barrel', () => {
  it('ship as weapons with the measures of the manuals, the 40 mm grenade and no blast behind', () => {
    const m203 = arsenal.weapons.get('m203')
    expect(m203).toMatchObject({ category: 'launcher', tags: ['underbarrel'], dimensions: { length: 0.38, barrel: 0.305, emptyMass: 1.36 } })
    expect(m203?.action).toMatchObject({ kind: 'launcher', projectile: 'm79_40mm', speed: 76, backblast: 0, magazine: 1, family: 'underbarrel' })
    expect(arsenal.weapons.get('gp_25')).toMatchObject({ dimensions: { length: 0.323, emptyMass: 1.5 } })
    expect(arsenal.weapons.get('gp_25')?.action).toMatchObject({ projectile: 'vog_25', speed: 76 })
    expect(arsenal.weapons.get('ag36')?.action).toMatchObject({ projectile: 'm79_40mm' })
    expect(arsenal.explosives.get('vog_25')).toMatchObject({ lethalRadius: arsenal.explosives.get('m79_40mm')?.lethalRadius, injuryRadius: arsenal.explosives.get('m79_40mm')?.injuryRadius, energy: arsenal.explosives.get('m79_40mm')?.energy })
    expect(arsenal.explosives.get('vog_25')?.sources).toEqual(['lab', 'derived'])
  })

  it('fit only where the real mount exists: the M203 on the M16 and the M4, the GP-25 on the AKs only (the SKS has the bayonet lug but not the GP-25 mount), the AG36 on the HK416', () => {
    const fits = (launcher: string): string[] =>
      [...arsenal.weapons.values()].filter((def) => def.action.kind === 'firearm' && arsenal.canFit(def.id, launcher).ok).map((def) => def.id).sort()
    expect(fits('m203')).toEqual(['colt_m16a2', 'colt_m4a1'])
    expect(fits('gp_25')).toEqual(['ak_12', 'ak_47', 'ak_74', 'akm'])
    expect(fits('ag36')).toEqual(['hk416'])
    expect(arsenal.canFit('ak_47', 'm203')).toEqual({ ok: false, reason: 'interface' })
    expect(arsenal.canFit('glock_17', 'm203')).toEqual({ ok: false, reason: 'no_mount' })
  })

  it('covers the lower rail while on the weapon', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    expect(state.canFit('vertical_grip')).toEqual({ ok: false, reason: 'blocked' })
    expect(state.mass).toBeCloseTo((arsenal.weapons.get('colt_m4a1')?.mass ?? 0) + 1.36 + 0, 6)
  })
})

describe('the M4 with an M203', () => {
  it('has a second state with its own ammunition, off until the switch', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    expect(state.underbarrel?.def.id).toBe('m203')
    expect(state.underbarrelActive).toBe(false)
    expect(state.underbarrel?.ammo).toBe(1)
    expect(state.underbarrel?.reserve).toBe(3)
    expect(state.trigger(ORIGIN, AIM, 0, false).shots).toHaveLength(1)
  })

  it('switches in the seconds of the rules, with the phase and the event, and answers busy meanwhile', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    state.update(1)
    expect(state.useUnderbarrel(true)).toBe(true)
    expect(state.phase).toMatchObject({ id: 'switch', end: state.phase?.start === undefined ? 0 : state.phase.start + 0.8 })
    expect(state.drain()).toEqual([{ type: 'underbarrel', on: true, at: expect.any(Number) as number }])
    expect(state.trigger(ORIGIN, AIM, 0, false).status).toBe('busy')
    expect(state.underbarrelActive).toBe(false)
    expect(state.useUnderbarrel(false)).toBe(false)
    state.update(1)
    expect(state.underbarrelActive).toBe(true)
    expect(state.useUnderbarrel(true)).toBe(false)
  })

  it('fires the launcher rule: one grenade as a throw use with the 40 mm explosive, impact trigger and arming distance, then empty', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    const rifleAmmo = state.ammo
    switched(state, true)
    const result = state.trigger(ORIGIN, AIM, 0, false)
    expect(result.status).toBe('ok')
    expect(result.shots).toEqual([])
    expect(result.uses).toHaveLength(1)
    expect(result.uses[0]).toMatchObject({ kind: 'throw', explosive: 'm79_40mm', trigger: 'impact', armDistance: 10 })
    expect(state.ammo).toBe(rifleAmmo)
    expect(state.underbarrel?.ammo).toBe(0)
    state.update(1)
    expect(state.trigger(ORIGIN, AIM, 0, false).status).toBe('empty')
    expect(state.drain().map((event) => event.type)).toEqual(expect.arrayContaining(['shot', 'empty']))
  })

  it('reloads the launcher by the break stages from its own reserve, leaving the rifle alone', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    switched(state, true)
    state.trigger(ORIGIN, AIM, 0, false)
    state.update(1)
    state.drain()
    const rifleReserve = state.reserve
    expect(state.reload()).toBe(true)
    expect(state.reloading).toBe(false)
    expect(state.underbarrel?.reloading).toBe(true)
    state.update(10)
    const stages = state.drain().filter((event) => event.type === 'reload_stage').map((event) => (event.type === 'reload_stage' ? event.stage : ''))
    expect(stages).toEqual(['breech_open', 'round_in', 'breech_close'])
    expect(state.underbarrel?.ammo).toBe(1)
    expect(state.underbarrel?.reserve).toBe(2)
    expect(state.reserve).toBe(rifleReserve)
  })

  it('goes back to the rifle: the trigger fires bullets again and the launcher keeps what it has', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    switched(state, true)
    state.trigger(ORIGIN, AIM, 0, false)
    state.update(1)
    switched(state, false)
    expect(state.underbarrelActive).toBe(false)
    expect(state.trigger(ORIGIN, AIM, 0, false).shots).toHaveLength(1)
    expect(state.underbarrel?.ammo).toBe(0)
  })

  it('keeps the launcher per accessory: taking it off and fitting it again brings back the rounds it had (no free grenades)', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    switched(state, true)
    state.trigger(ORIGIN, AIM, 0, false)
    state.update(1)
    switched(state, false)
    expect(state.underbarrel?.ammo).toBe(0)
    const result = state.remove('m203', { install: 'bench' })
    expect(result.ok).toBe(true)
    state.update(60)
    expect(state.underbarrel).toBeNull()
    expect(state.underbarrelActive).toBe(false)
    expect(state.fit('m203', { install: 'bench' }).ok).toBe(true)
    state.update(60)
    expect(state.underbarrel?.def.id).toBe('m203')
    expect(state.underbarrel?.ammo).toBe(0)
    expect(state.underbarrel?.reserve).toBe(3)
  })

  it('cannot switch while the launcher reloads, and the idle launcher keeps the clock of the weapon', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    switched(state, true)
    state.trigger(ORIGIN, AIM, 0, false)
    state.update(1)
    state.reload()
    expect(state.useUnderbarrel(false)).toBe(false)
    state.update(10)
    switched(state, false)
    state.update(30)
    switched(state, true)
    state.drain()
    state.trigger(ORIGIN, AIM, 0, false)
    const events = state.drain()
    const shot = events.find((event) => event.type === 'shot')
    expect(shot?.at).toBeGreaterThan(40)
  })

  it('does not move the spread of the rifle: the launcher has streams of its own', () => {
    const shots = (withUnder: boolean): Vec3[] => {
      const state = withUnder ? withLauncher('colt_m4a1', 'm203', 4) : arsenal.create('colt_m4a1', { seed: 4 })
      if (withUnder) switched(state, true)
      if (withUnder) switched(state, false)
      return Array.from({ length: 5 }, () => {
        state.update(1)
        return state.trigger(ORIGIN, AIM, 0, false).shots[0]?.direction ?? [0, 0, 0]
      })
    }
    expect(shots(true)).toEqual(shots(false))
  })

  it('takes the launcher with it when the accessory comes off, and brings it back with the snapshot', () => {
    const state = withLauncher('colt_m4a1', 'm203')
    switched(state, true)
    state.trigger(ORIGIN, AIM, 0, false)
    state.update(1)
    const snapshot = state.snapshot()
    expect(snapshot.underbarrel).toMatchObject({ id: 'm203', ammo: 0 })
    const copy = arsenal.restore(snapshot, { seed: 1 })
    expect(copy.underbarrel?.ammo).toBe(0)
    expect(copy.underbarrel?.def.id).toBe('m203')
    state.update(1)
    switched(state, false)
    expect(state.remove('m203', { install: 'bench' }).ok).toBe(true)
    state.update(60)
    expect(state.underbarrel).toBeNull()
    expect(state.underbarrelActive).toBe(false)
    expect(state.useUnderbarrel(true)).toBe(false)
  })
})

describe('the other launchers', () => {
  it('fire the VOG-25 from an AK-47 and the 40 mm grenade from an HK416 with an AG36', () => {
    const ak = withLauncher('ak_47', 'gp_25')
    switched(ak, true)
    expect(ak.trigger(ORIGIN, AIM, 0, false).uses[0]).toMatchObject({ explosive: 'vog_25' })
    const hk = withLauncher('hk416', 'ag36')
    switched(hk, true)
    expect(hk.trigger(ORIGIN, AIM, 0, false).uses[0]).toMatchObject({ explosive: 'm79_40mm' })
  })

  it('go when the launcher weapon is removed or filtered out of the arsenal (the shipped accessory goes with it)', () => {
    const without = createArsenal({ remove: { weapons: ['m203'] } })
    expect(without.attachments.has('m203')).toBe(false)
    expect(without.attachments.has('gp_25')).toBe(true)
    expect(() => createArsenal({ attachments: [{ id: 'bad_launcher', kind: 'underbarrel', mounts: ['underbarrel'], interfaces: ['m203'], mass: 1, install: 'bench', effects: [], launcher: 'glock_17', model: 'x', sources: ['derived'] }] })).toThrow(/not a launcher weapon/)
  })
})
