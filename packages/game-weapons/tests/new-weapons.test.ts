import { describe, expect, it } from 'vitest'

import { CALIBERS, checkArsenal, createArsenal } from '../src'
import type { Vec3, WeaponDef, WeaponState } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const FOREVER = 60
const FRAME = 1 / 60
const arsenal = createArsenal({ rules: { faults: false } })

const NEW_WEAPONS = [
  'hk_mp5sd3', 'fn_parafal', 'taurus_t4_civil', 'taurus_th380', 'mossberg_500_cruiser', 'hk_mp5k', 'hk_ump9', 'mini_uzi', 'hk_mp7a1', 'hk_g36', 'hk_g36k', 'hk_g36c',
  'fn_m249', 'fn_minimi_para', 'fn_mag', 'rpk', 'sig_mpx', 'mg3', 'pp19_bizon', 'vz61', 'm134',
] as const

const defOf = (id: string): WeaponDef => {
  const def = arsenal.weapons.get(id)
  if (!def) throw new Error(`no weapon ${id}`)
  return def
}

const fitted = (weapon: WeaponState, id: string): WeaponState => {
  const result = weapon.fit(id, { install: 'bench' })
  if (!result.ok) throw new Error(`could not fit ${id} on ${weapon.def.id}: ${result.reason}`)
  weapon.update(FOREVER)
  weapon.drain()
  return weapon
}

/** Holds the trigger frame by frame and says when each round left and how many there were. */
const hold = (weapon: WeaponState, seconds: number): { firstAt: number; rounds: number } => {
  let firstAt = -1
  let rounds = 0
  for (let frame = 0; frame * FRAME < seconds; frame++) {
    const result = weapon.trigger(ORIGIN, AIM, FRAME, true)
    if (result.rounds > 0 && firstAt < 0) firstAt = frame * FRAME
    rounds += result.rounds
  }
  return { firstAt, rounds }
}

describe('the weapons T1.7.5 added', () => {
  it('has all 21, each from a source that says where its numbers come from', () => {
    for (const id of NEW_WEAPONS) {
      const def = defOf(id)
      expect(def.action.kind, id).toBe('firearm')
      expect(def.sources?.some((source) => source === 'reference' || source === 'arsenal' || source === 'derived'), id).toBe(true)
      expect(def.sources, id).not.toContain('gallery')
    }
    expect(checkArsenal(arsenal)).toEqual([])
  })

  it('fires every one of them: a first round with the magazine it ships with', () => {
    for (const id of NEW_WEAPONS.filter((entry) => entry !== 'm134')) {
      const weapon = arsenal.create(id, { seed: 1 })
      weapon.update(FOREVER)
      const result = weapon.trigger(ORIGIN, AIM, 0, false)
      expect(result.rounds, id).toBe(1)
      expect(weapon.ammo, id).toBe(weapon.capacity - 1)
    }
  })

  it('has the two new calibres with the cartridge of the design', () => {
    const byId = new Map(CALIBERS.map((caliber) => [caliber.id, caliber]))
    expect(byId.get('4_6x30')).toMatchObject({ bulletGrams: 2, muzzleSpeed: 735, cartridge: { caseDiameter: 8, caseLength: 30.5, overallLength: 38.5 } })
    expect(byId.get('32acp')?.cartridge).toBeDefined()
    expect(defOf('hk_mp7a1').action).toMatchObject({ caliber: '4_6x30', magazine: 40, magazineOptions: [20, 30], rpm: 950 })
    expect(defOf('vz61').action).toMatchObject({ caliber: '32acp', magazine: 20 })
  })

  it('makes the MP5SD3 a suppressed weapon whose own noise is the suppressed, subsonic one, and that cannot lose its suppressor', () => {
    const weapon = arsenal.create('hk_mp5sd3', { seed: 1 })
    expect(weapon.suppressed).toBe(true)
    weapon.update(FOREVER)
    const result = weapon.trigger(ORIGIN, AIM, 0, false)
    expect(result.suppressed).toBe(true)
    expect(result.noise).toBeCloseTo(37.5, 6)
    expect(weapon.remove('integral_suppressor')).toEqual({ ok: false, reason: 'fixed' })
    expect(arsenal.create('hk_mp5a3').suppressed).toBe(false)
  })

  it('gives the G36 and the G36K an integral optic that stays, and the G36C a rail', () => {
    for (const id of ['hk_g36', 'hk_g36k']) expect(defOf(id).fitted).toEqual([{ id: 'integral_optic_3x', mount: 'rail_top', integral: true }])
    expect(defOf('hk_g36c').fitted).toEqual([])
    expect(defOf('hk_g36c').mounts?.map((mount) => mount.kind)).toContain('rail_top')
  })

  it('folds or slides the stock of the weapons that have one, with the length it measures', () => {
    expect(defOf('hk_mp7a1').stock).toEqual({ kind: 'retract' })
    expect(defOf('hk_g36').stock).toEqual({ kind: 'fold', foldAxis: 'left' })
    expect(defOf('vz61').stock).toEqual({ kind: 'fold', foldAxis: 'over' })
    expect(defOf('hk_mp5k').stock).toBeUndefined()
    expect(defOf('hk_g36c').dimensions?.lengthCollapsed).toBe(0.5)
  })

  it('lets the civil T4 fire only one round per pull, and the Cruiser stays a pump', () => {
    const modesOf = (id: string): readonly string[] => {
      const { action } = defOf(id)
      return action.kind === 'firearm' ? action.modes : []
    }
    expect(modesOf('taurus_t4_civil')).toEqual(['semi'])
    expect(modesOf('mossberg_500_cruiser')).toEqual(['pump'])
  })

  it('fits the GP-25 on the AK weapons only: not on the SKS and not on the RPK', () => {
    const fits = (id: string): boolean => arsenal.canFit(id, 'gp_25').ok
    for (const id of ['ak_47', 'akm', 'ak_74', 'ak_12']) expect(fits(id), id).toBe(true)
    for (const id of ['sks', 'rpk', 'hk_g36', 'fn_mag']) expect(fits(id), id).toBe(false)
  })

  it('takes the ammunition backpack on the portable belt-fed guns, 500 rounds by default', () => {
    for (const id of ['fn_m249', 'fn_minimi_para', 'fn_mag', 'mg3', 'm134']) {
      expect(arsenal.canFit(id, 'ammo_backpack').ok, id).toBe(true)
      expect(fitted(arsenal.create(id), 'ammo_backpack').capacity, id).toBe(500)
    }
  })
})

describe('the M134 in its three modes', () => {
  it('is 7.62×51 with the real measures, 3000 rpm by default and a box of belt in the hands', () => {
    const def = defOf('m134')
    expect(def.dimensions).toEqual({ length: 0.801, barrel: 0.559, emptyMass: 39 })
    expect(def.action).toMatchObject({ caliber: '7_62x51', rpm: 3000, rpmRange: [2000, 6000], modes: ['auto'], family: 'belt', magazine: 200 })
    expect(def.fitted).toEqual([])
    expect(arsenal.create('m134').capacity).toBe(200)
  })

  it('with the ammunition backpack the belt holds 500, and the capacity is the option of the game', () => {
    expect(fitted(arsenal.create('m134'), 'ammo_backpack').capacity).toBe(500)
    const small = createArsenal({ rules: { faults: false }, patch: { attachments: { ammo_backpack: { effects: [{ stat: 'capacity', set: 800 }] } } } })
    expect(fitted(small.create('m134'), 'ammo_backpack').capacity).toBe(800)
  })

  it('on the tripod it is supported like the M2: less recoil and spread, and more mass', () => {
    const free = arsenal.create('m134')
    const mounted = fitted(arsenal.create('m134'), 'tripod')
    expect(mounted.attachments).toEqual([{ id: 'tripod', mount: 'underbarrel' }])
    expect(mounted.mass).toBeGreaterThan(free.mass)
    expect(mounted.spread).toBeCloseTo(free.spread * 0.7, 10)
    expect(arsenal.canFit('m134', 'tripod')).toEqual({ ok: true, mount: 'underbarrel' })
    expect(arsenal.canFit('colt_m4a1', 'tripod').ok).toBe(false)
  })

  it('needs half a second for the barrels to reach speed, then keeps them turning for a second after the last round', () => {
    const weapon = arsenal.create('m134', { seed: 1 })
    weapon.update(FOREVER)
    const first = hold(weapon, 2)
    expect(first.firstAt).toBeGreaterThanOrEqual(0.5 - FRAME)
    expect(first.firstAt).toBeLessThan(0.5 + 2 * FRAME)
    expect(first.rounds).toBeGreaterThan(60)
    weapon.update(0.5)
    expect(hold(weapon, 0.1).firstAt, 'still spinning half a second after').toBe(0)
    weapon.update(2)
    expect(hold(weapon, 1).firstAt, 'stopped after two seconds').toBeGreaterThanOrEqual(0.5 - FRAME)
  })

  it('fires at the rate the game sets inside 2000 to 6000 rpm, and refuses one outside it', () => {
    const fast = createArsenal({ rules: { faults: false }, patch: { weapons: { m134: { action: { rpm: 6000 } } } } })
    const slow = createArsenal({ rules: { faults: false }, patch: { weapons: { m134: { action: { rpm: 2000 } } } } })
    const roundsIn = (source: typeof arsenal): number => {
      const weapon = source.create('m134', { seed: 1 })
      weapon.update(FOREVER)
      return hold(weapon, 1.5).rounds
    }
    expect(roundsIn(fast)).toBeGreaterThan(roundsIn(slow) * 2.5)
    expect(() => createArsenal({ rules: { faults: false }, patch: { weapons: { m134: { action: { rpm: 9000 } } } } })).toThrow(/m134.*outside its range/)
  })
})
