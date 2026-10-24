import { describe, expect, it } from 'vitest'

import { createArsenal } from '../src'
import type { AttachmentDef, FireMode, Vec3, WeaponState } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const NO_FAULTS = { faults: false } as const
const FOREVER = 60

/** Puts an accessory on and waits for the work to end. */
const fitted = (weapon: WeaponState, id: string, install: 'field' | 'tool' | 'bench' = 'bench'): WeaponState => {
  const result = weapon.fit(id, { install })
  if (!result.ok) throw new Error(`could not fit ${id} on ${weapon.def.id}: ${result.reason}`)
  weapon.update(FOREVER)
  weapon.drain()
  return weapon
}

const removed = (weapon: WeaponState, id: string): WeaponState => {
  const result = weapon.remove(id, { install: 'bench' })
  if (!result.ok) throw new Error(`could not remove ${id} from ${weapon.def.id}: ${result.reason}`)
  weapon.update(FOREVER)
  weapon.drain()
  return weapon
}

const firstShotNoise = (weapon: WeaponState): number => {
  weapon.update(FOREVER)
  return weapon.trigger(ORIGIN, AIM, 0, false).noise
}

const arsenal = createArsenal({ rules: NO_FAULTS })

describe('weapons as they ship', () => {
  it('carry exactly the numbers of their def, with or without factory parts', () => {
    for (const def of arsenal.weapons.values()) {
      if (def.action.kind !== 'firearm') continue
      const state = arsenal.create(def.id, { seed: 3 })
      expect(state.capacity, def.id).toBe(def.action.magazine)
      expect(state.attachments, def.id).toEqual(def.fitted ?? [])
      expect(state.suppressed, def.id).toBe(def.fitted?.some((part) => part.id === 'integral_suppressor') ?? false)
      expect(state.stock, def.id).toBe('extended')
      expect(state.spread, def.id).toBe(def.action.spreadDeg)
    }
  })

  it('times the aim as 0.15 s plus 0.05 s per kg of what is on the weapon', () => {
    const rifle = arsenal.create('colt_m4a1')
    expect(rifle.aimSeconds).toBeCloseTo(arsenal.rules.aim.base + arsenal.rules.aim.perKg * rifle.mass, 10)
    expect(rifle.mass).toBeCloseTo(arsenal.weapons.get('colt_m4a1')?.mass ?? 0, 10)
    expect(arsenal.create('glock_17').aimSeconds).toBeLessThan(arsenal.create('colt_m4a1').aimSeconds)
  })
})

describe('fit and remove', () => {
  it('returns every removable factory part to the numbers of the def when it is put back (round trip)', () => {
    for (const def of arsenal.weapons.values()) {
      for (const part of def.fitted ?? []) {
        if (part.integral) continue
        const state = arsenal.create(def.id, { seed: 5 })
        const before = { capacity: state.capacity, mass: state.mass, aim: state.aimSeconds, spread: state.spread, attachments: state.attachments }
        removed(state, part.id)
        expect(state.attachments.some((other) => other.id === part.id), `${def.id} ${part.id}`).toBe(false)
        fitted(state, part.id)
        expect({ capacity: state.capacity, mass: state.mass, aim: state.aimSeconds, spread: state.spread }, `${def.id} ${part.id}`).toEqual({ capacity: before.capacity, mass: before.mass, aim: before.aim, spread: before.spread })
        expect(state.attachments.map((other) => other.id).sort(), `${def.id} ${part.id}`).toEqual(before.attachments.map((other) => other.id).sort())
      }
    }
  })

  it('takes the factory muzzle brake out: recoil goes up by what the brake took and the noise down', () => {
    const state = arsenal.create('barrett_mrad')
    const base = arsenal.weapons.get('barrett_mrad')
    if (base?.action.kind !== 'firearm') throw new Error('no mrad')
    removed(state, 'muzzle_brake')
    const unbraked = firstShotNoise(state)
    expect(unbraked).toBeCloseTo(((base.action.noise ?? arsenal.calibers.get(base.action.caliber)?.noise ?? 0) / 1.1), 6)
    state.refill()
    const result = state.trigger(ORIGIN, AIM, 0, false)
    expect(result.recoil[0]).toBeCloseTo(base.action.recoil[0] / 0.75, 6)
  })

  it('refuses a factory part that is integral, an accessory that is not there and an unknown one', () => {
    const rifle = arsenal.create('svd_dragunov')
    expect(rifle.remove('pso_1')).toEqual({ ok: false, reason: 'fixed' })
    expect(arsenal.create('colt_m4a1').remove('suppressor')).toEqual({ ok: false, reason: 'not_fitted' })
    expect(arsenal.create('colt_m4a1').fit('moon_launcher')).toEqual({ ok: false, reason: 'unknown' })
  })

  it('asks for the tool the work needs and takes the seconds of the rules, with the phase and the event', () => {
    const state = arsenal.create('colt_m4a1')
    expect(state.fit('suppressor', { install: 'field' })).toEqual({ ok: false, reason: 'install' })
    expect(state.fit('suppressor', { install: 'tool' })).toEqual({ ok: true, seconds: 15 })
    expect(state.phase).toMatchObject({ id: 'fit', start: 0, end: 15 })
    expect(state.drain()).toEqual([{ type: 'attachment', action: 'fit', id: 'suppressor', mount: 'muzzle', at: 0 }])
    expect(state.attachments.some((part) => part.id === 'suppressor')).toBe(false)
    expect(state.trigger(ORIGIN, AIM, 0, false).status).toBe('busy')
    expect(state.reload()).toBe(false)
    state.update(14.9)
    expect(state.suppressed).toBe(false)
    state.update(0.2)
    expect(state.suppressed).toBe(true)
    expect(state.phase).toBeNull()
    const quick = createArsenal({ rules: { attachments: { fitSeconds: { field: 0, tool: 0, bench: 0 } } } }).create('colt_m4a1')
    expect(quick.fit('suppressor', { install: 'tool' })).toEqual({ ok: true, seconds: 0 })
    expect(quick.suppressed).toBe(true)
  })

  it('does not start a second job while one runs', () => {
    const state = arsenal.create('colt_m4a1')
    state.fit('vertical_grip')
    expect(state.fit('weapon_light')).toEqual({ ok: false, reason: 'busy' })
  })
})

describe('what the accessories do', () => {
  it('mutes a suppressed M4 to 0.4 of its noise and marks the shot, then back to the full noise when it comes off', () => {
    const base = firstShotNoise(arsenal.create('colt_m4a1', { seed: 4 }))
    const state = fitted(arsenal.create('colt_m4a1', { seed: 4 }), 'suppressor')
    state.update(FOREVER)
    const result = state.trigger(ORIGIN, AIM, 0, false)
    expect(result.noise).toBeCloseTo(base * 0.4, 6)
    expect(result.suppressed).toBe(true)
    expect(state.drain().find((event) => event.type === 'shot')).toMatchObject({ suppressed: true })
    expect(arsenal.create('colt_m4a1').trigger(ORIGIN, AIM, 0, false).suppressed).toBeUndefined()
    removed(state, 'suppressor')
    state.refill()
    expect(firstShotNoise(state)).toBeCloseTo(base, 6)
  })

  it('mutes a suppressed UMP-45 to a quarter: the .45 is subsonic', () => {
    const base = firstShotNoise(arsenal.create('hk_ump_45'))
    const state = fitted(arsenal.create('hk_ump_45'), 'suppressor')
    expect(firstShotNoise(state)).toBeCloseTo(base * 0.25, 6)
  })

  it('takes 5% of the energy off a suppressed shot (speed times the square root of 0.95)', () => {
    const plain = arsenal.create('colt_m4a1').trigger(ORIGIN, AIM, 0, false).shots[0]
    const state = fitted(arsenal.create('colt_m4a1'), 'suppressor')
    const shot = state.trigger(ORIGIN, AIM, 0, false).shots[0]
    expect((shot?.energy ?? 0) / (plain?.energy ?? 1)).toBeCloseTo(0.95, 3)
  })

  it('gives an AK-47 an extended magazine: 45 rounds and a reload 15% slower (and none left over when it comes off)', () => {
    const state = arsenal.create('ak_47', { reserve: 90 })
    const base = arsenal.weapons.get('ak_47')
    if (base?.action.kind !== 'firearm') throw new Error('no ak')
    fitted(state, 'extended_magazine', 'field')
    expect(state.capacity).toBe(45)
    state.refill()
    expect(state.ammo).toBe(45)
    state.trigger(ORIGIN, AIM, 0, false)
    state.update(5)
    state.reload()
    const phase = state.phase
    expect((phase?.end ?? 0) - (phase?.start ?? 0)).toBeCloseTo((base.action.timings?.reload ?? base.action.reload) * 1.15, 6)
    state.update(FOREVER)
    expect(state.ammo).toBe(45)
    removed(state, 'extended_magazine')
    expect(state.capacity).toBe(30)
    expect(state.ammo).toBe(30)
    expect(state.reserve).toBe(90 - 1 + 15 - 0)
  })

  it('makes a drum magazine hold 75 and jam half as much again, a dual coupler halve every second reload', () => {
    const drum = fitted(arsenal.create('ak_47'), 'drum_magazine', 'field')
    expect(drum.capacity).toBe(75)
    const jammy = createArsenal({ rules: { faults: true, faultChance: () => 0.2 } }).create('colt_m4a1', { seed: 9 })
    fitted(jammy, 'dual_coupler', 'field')
    const durations: number[] = []
    for (let i = 0; i < 4; i++) {
      jammy.refill()
      jammy.setCondition('new')
      jammy.trigger(ORIGIN, AIM, 0, false)
      jammy.clearFault()
      jammy.update(5)
      jammy.refill()
      jammy.trigger(ORIGIN, AIM, 0, false)
      jammy.update(5)
      if (jammy.reload()) durations.push((jammy.phase?.end ?? 0) - (jammy.phase?.start ?? 0))
      jammy.update(FOREVER)
    }
    expect(durations.length).toBeGreaterThanOrEqual(2)
    expect(durations[1]).toBeCloseTo((durations[0] ?? 0) * 0.5, 6)
  })

  it('folds the stock of an MP5A3: faster draw and aim, more vertical recoil and spread, after the phase', () => {
    const state = arsenal.create('hk_mp5a3', { seed: 2 })
    const base = arsenal.weapons.get('hk_mp5a3')
    if (base?.action.kind !== 'firearm') throw new Error('no mp5')
    const before = { aim: state.aimSeconds, spread: state.spread }
    expect(state.setStock('collapsed')).toBe(true)
    expect(state.phase).toMatchObject({ id: 'stock', end: arsenal.rules.stock.seconds })
    expect(state.stock).toBe('extended')
    expect(state.drain()).toEqual([{ type: 'stock', state: 'collapsed', kind: 'retract', at: 0 }])
    state.update(1)
    expect(state.stock).toBe('collapsed')
    expect(state.aimSeconds).toBeCloseTo(before.aim * 0.85, 10)
    expect(state.spread).toBeCloseTo(before.spread * 1.15, 10)
    state.draw()
    expect((state.phase?.end ?? 0) - (state.phase?.start ?? 0)).toBeCloseTo(arsenal.rules.draw * 0.8, 10)
    state.update(1)
    expect(state.trigger(ORIGIN, AIM, 0, false).recoil[0]).toBeCloseTo(base.action.recoil[0] * 1.3, 10)
    expect(state.setStock('collapsed')).toBe(false)
    expect(arsenal.create('glock_17').setStock('collapsed')).toBe(false)
    expect(arsenal.create('hk_g3a3').setStock('collapsed')).toBe(false)
  })

  it('takes the improvised suppressor off at a shot drawn between 30 and 60, without touching the spread or the faults', () => {
    const run = (seed: number, withFilter: boolean): { breakAt: number | undefined; directions: Vec3[]; noises: number[] } => {
      const state = arsenal.create('colt_m4a1', { seed, reserve: 500 })
      if (withFilter) fitted(state, 'oil_filter_suppressor', 'tool')
      state.setSafety(false)
      let breakAt: number | undefined
      const directions: Vec3[] = []
      const noises: number[] = []
      for (let shot = 1; shot <= 80; shot++) {
        state.update(1)
        if (state.ammo === 0) state.refill()
        const result = state.trigger(ORIGIN, AIM, 0, false)
        directions.push(result.shots[0]?.direction ?? [0, 0, 0])
        noises.push(result.noise)
        if (state.drain().some((event) => event.type === 'attachment' && event.action === 'break')) breakAt = shot
      }
      return { breakAt, directions, noises }
    }
    const first = run(21, true)
    expect(first.breakAt).toBeGreaterThanOrEqual(30)
    expect(first.breakAt).toBeLessThanOrEqual(60)
    expect(run(21, true).breakAt).toBe(first.breakAt)
    const bare = run(21, false)
    expect(first.directions).toEqual(bare.directions)
    const at = first.breakAt ?? 0
    expect(first.noises[at - 2]).toBeLessThan(bare.noises[at - 2] ?? 0)
    expect(first.noises[at]).toBeCloseTo(bare.noises[at] ?? 0, 6)
    expect(new Set(Array.from({ length: 12 }, (_, seed) => run(seed + 100, true).breakAt)).size).toBeGreaterThan(3)
  })

  it('cuts the recoil of a bipod only when supported and a vertical grip always', () => {
    const base = arsenal.weapons.get('colt_m4a1')
    if (base?.action.kind !== 'firearm') throw new Error('no m4')
    const grip = fitted(arsenal.create('colt_m4a1'), 'vertical_grip', 'field')
    expect(grip.trigger(ORIGIN, AIM, 0, false).recoil[0]).toBeCloseTo(base.action.recoil[0] * 0.85, 10)
    const bipod = fitted(arsenal.create('colt_m4a1'), 'bipod', 'field')
    expect(bipod.trigger(ORIGIN, AIM, 0, false).recoil[0]).toBeCloseTo(base.action.recoil[0], 10)
    const lying = fitted(arsenal.create('colt_m4a1'), 'bipod', 'field')
    lying.setStance({ supported: true })
    expect(lying.trigger(ORIGIN, AIM, 0, false).recoil[0]).toBeCloseTo(base.action.recoil[0] * 0.4, 10)
  })

  it('makes the hip as wide as the rules say and a laser takes half of the excess; aiming takes it all', () => {
    const wide = createArsenal({ rules: { ...NO_FAULTS, aim: { hipSpread: 6 } } })
    const base = wide.weapons.get('colt_m4a1')
    if (base?.action.kind !== 'firearm') throw new Error('no m4')
    const state = wide.create('colt_m4a1')
    expect(state.spread).toBeCloseTo(base.action.spreadDeg * 6, 10)
    state.setStance({ aiming: true })
    expect(state.spread).toBeCloseTo(base.action.spreadDeg, 10)
    state.setStance({ aiming: false })
    fitted(state, 'laser_sight', 'field')
    expect(state.spread).toBeCloseTo(base.action.spreadDeg * 6, 10)
    expect(state.toggle('laser_sight')).toBe(true)
    expect(state.spread).toBeCloseTo(base.action.spreadDeg * (1 + 5 * 0.5), 10)
    expect(state.drain().some((event) => event.type === 'toggle' && event.on)).toBe(true)
    expect(state.toggle('laser_sight')).toBe(false)
    expect(state.toggle('suppressor')).toBeNull()
    expect(arsenal.create('colt_m4a1').spread).toBe(base.action.spreadDeg)
  })

  it('gives the ammunition backpack 500 rounds of capacity, configurable', () => {
    const belt = fitted(arsenal.create('fn_minimi'), 'ammo_backpack', 'field')
    expect(belt.capacity).toBe(500)
    const small = createArsenal({ rules: NO_FAULTS, patch: { attachments: { ammo_backpack: { effects: [{ stat: 'capacity', set: 300 }] } } } })
    expect(fitted(small.create('fn_minimi'), 'ammo_backpack', 'field').capacity).toBe(300)
    expect(arsenal.canFit('colt_m4a1', 'ammo_backpack')).toEqual({ ok: false, reason: 'no_mount' })
  })

  it('counts a tripod as support (the factory one of the M2 is already in its numbers)', () => {
    const m2 = arsenal.create('browning_m2')
    expect(m2.attachments).toEqual([{ id: 'tripod', mount: 'underbarrel', integral: true }])
    expect(m2.remove('tripod')).toEqual({ ok: false, reason: 'fixed' })
  })
})

describe('canFit', () => {
  it('fits a suppressor on a threaded muzzle within its calibre limits, not on a pistol or a weapon with a fixed device', () => {
    expect(arsenal.canFit('colt_m4a1', 'suppressor')).toEqual({ ok: true, mount: 'muzzle' })
    expect(arsenal.canFit('ak_47', 'suppressor')).toEqual({ ok: true, mount: 'muzzle' })
    expect(arsenal.canFit('glock_17', 'suppressor')).toEqual({ ok: false, reason: 'no_mount' })
    expect(arsenal.canFit('mac_10', 'suppressor')).toEqual({ ok: false, reason: 'interface' })
    expect(arsenal.canFit('fn_scar_h', 'oil_filter_suppressor')).toEqual({ ok: false, reason: 'caliber' })
    expect(arsenal.canFit('colt_m4a1', 'oil_filter_suppressor')).toEqual({ ok: true, mount: 'muzzle' })
  })

  it('refuses an occupied place, a covered place and a category that does not match', () => {
    expect(arsenal.canFit('fn_minimi', 'bipod')).toEqual({ ok: false, reason: 'occupied' })
    expect(arsenal.canFit('colt_m4a1', 'vertical_grip', { fitted: [{ id: 'm203', mount: 'underbarrel' }] })).toEqual({ ok: false, reason: 'blocked' })
    expect(arsenal.canFit('colt_m4a1', 'm203', { fitted: [{ id: 'vertical_grip', mount: 'rail_bottom' }] })).toEqual({ ok: false, reason: 'blocked' })
    const picky: AttachmentDef = { id: 'pistol_only_light', kind: 'light', mounts: ['rail_left'], interfaces: ['picatinny'], categories: ['pistol'], mass: 0.1, install: 'field', effects: [], model: 'weapon_light', sources: ['derived'] }
    const custom = createArsenal({ rules: NO_FAULTS, attachments: [picky] })
    expect(custom.canFit('colt_m4a1', 'pistol_only_light')).toEqual({ ok: false, reason: 'category' })
  })

  it('lets the game veto an accessory with isCompatible and add its own', () => {
    const never = createArsenal({ rules: NO_FAULTS, isCompatible: (_def, attachment) => attachment.kind !== 'suppressor' })
    expect(never.canFit('colt_m4a1', 'suppressor')).toEqual({ ok: false, reason: 'rejected' })
    expect(never.canFit('colt_m4a1', 'bipod')).toMatchObject({ ok: true })
    const own: AttachmentDef = { id: 'tac_laser', kind: 'laser', mounts: ['rail_right'], interfaces: ['mlok'], mass: 0.05, install: 'field', effects: [{ stat: 'hipSpreadExcess', mul: 0.25 }], laser: { color: 0x00ff00, range: 80, visibleFrom: 20 }, model: 'laser_sight', sources: ['derived'] }
    const custom = createArsenal({ rules: NO_FAULTS, attachments: [own] })
    expect(custom.canFit('colt_m4a1', 'tac_laser')).toEqual({ ok: true, mount: 'rail_right' })
    expect(custom.canFit('ak_47', 'tac_laser')).toEqual({ ok: false, reason: 'no_mount' })
  })

  it('drops an accessory from the arsenal with remove, and refuses a weapon fitted with one that is gone', () => {
    const without = createArsenal({ remove: { attachments: ['suppressor'] } })
    expect(without.attachments.has('suppressor')).toBe(false)
    expect(() => createArsenal({ remove: { attachments: ['bipod'] } })).toThrow(/fitted with unknown attachment "bipod"/)
  })
})

describe('snapshot and restore', () => {
  it('rebuilds a weapon with its parts, stock, ammunition and condition', () => {
    const state = arsenal.create('colt_m4a1', { seed: 8, reserve: 77, condition: 'worn' })
    fitted(state, 'suppressor', 'tool')
    fitted(state, 'weapon_light', 'field')
    state.toggle('weapon_light')
    state.setStock('collapsed')
    state.update(5)
    state.trigger(ORIGIN, AIM, 0, false)
    state.update(1)
    state.cycleMode()
    const snapshot = state.snapshot()
    const copy = arsenal.restore(snapshot, { seed: 8 })
    expect(copy.snapshot()).toEqual(snapshot)
    expect(copy.suppressed).toBe(true)
    expect(copy.stock).toBe('collapsed')
    expect(copy.condition).toBe('worn')
    expect(copy.ammo).toBe(state.ammo)
    expect(copy.reserve).toBe(77)
    expect(copy.mode as FireMode).toBe(state.mode)
    expect(copy.mass).toBeCloseTo(state.mass, 10)
    expect(copy.attachments.find((part) => part.id === 'weapon_light')?.on).toBe(true)
  })
})
