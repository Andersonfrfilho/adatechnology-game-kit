import { describe, expect, it } from 'vitest'

import { AMMO, CALIBERS, DEFAULT_RULES, ammoIgnition, createArsenal, checkArsenal } from '../src'
import type { Vec3, WeaponState } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const arsenal = createArsenal({ rules: { faults: false } })

/** Takes the weapon out, lets it be ready, pulls once and returns the first shot. */
const shootOnce = (weapon: WeaponState) => {
  weapon.update(5)
  const r = weapon.trigger(ORIGIN, AIM, 1 / 60, false)
  const shot = r.shots[0]
  if (!shot) throw new Error(`no shot: ${r.status}`)
  return shot
}

describe('the ammo table', () => {
  it('has the load every calibre ships with, with a mass, an energy and four penetrations', () => {
    expect(checkArsenal({ weapons: arsenal.weapons, calibers: arsenal.calibers, explosives: arsenal.explosives, ammo: arsenal.ammo })).toEqual([])
    for (const c of CALIBERS) {
      const load = arsenal.loadOf(c.id)
      expect(load.kind).toBe(c.kind)
      expect(load.energy).toBeCloseTo(arsenal.muzzleEnergy(c.id), 6)
      for (const k of ['steel', 'concrete', 'brick', 'wood'] as const) expect(load.penetration[k]).toBeGreaterThanOrEqual(0)
    }
  })

  it('is real: M80 ball (lead core) does not cross an 8.5 mm structural flange, M993 AP does, the .50 BMG M33 ball does too', () => {
    const m80 = arsenal.loadOf('7_62x51', 'fmj')
    const m993 = arsenal.loadOf('7_62x51', 'ap')
    const m33 = arsenal.loadOf('50bmg', 'fmj')
    expect(m80.def.core).toBe('lead')
    expect(m993.def.core).toBe('tungsten_carbide')
    expect(m993.def.basis).toBe('published')
    expect(m993.penetration.steel).toBe(18) // Nammo AP8: 18 mm RHA at 100 m
    expect(m80.penetration.steel).toBeLessThan(m993.penetration.steel)
    expect(m33.penetration.steel).toBeGreaterThan(m80.penetration.steel)
    // lighter and faster than the ball, so more energy per gram but a different mass
    expect(m993.grams).toBeCloseTo(8.2, 5)
    expect(m993.speed).toBe(930)
  })

  it('every pistol and shotgun load goes through less steel than the rifle loads and the AP loads go through more than the ball of the same calibre', () => {
    const rifle = Math.min(...['5_56x45', '7_62x39', '7_62x51'].map((id) => arsenal.loadOf(id).penetration.steel))
    for (const id of ['9x19', '45acp', '12ga_00buck', '12ga_slug']) expect(arsenal.loadOf(id).penetration.steel).toBeLessThan(rifle)
    for (const [cal, ball] of [['5_56x45', 'fmj'], ['7_62x51', 'fmj'], ['50bmg', 'fmj'], ['30_06', 'fmj']] as const) {
      expect(arsenal.loadOf(cal, 'ap').penetration.steel).toBeGreaterThan(arsenal.loadOf(cal, ball).penetration.steel)
    }
    expect(AMMO.every((a) => a.sources.length > 0)).toBe(true)
  })

  it('the shot carries the round: kind, mass, energy and penetration of the load in the weapon', () => {
    const w = arsenal.create('rifle_bolt_308', { seed: 3 })
    const ball = shootOnce(w)
    expect(ball.ammo).toBe('fmj')
    expect(ball.penetration).toEqual(arsenal.loadOf('7_62x51').penetration)
    expect(ball.incendiary).toBeUndefined()
    const ap = arsenal.create('rifle_bolt_308', { seed: 3, ammoKind: 'ap' })
    expect(ap.ammoKind).toBe('ap')
    const s = shootOnce(ap)
    expect(s.ammo).toBe('ap')
    expect(s.mass).toBeCloseTo(8.2, 5)
    expect(s.penetration!.steel).toBe(18)
    expect(s.energy).toBeCloseTo(0.5 * 0.0082 * ((ball.speed * 930) / 850) ** 2, 3)
    const t = arsenal.create('rifle_bolt_308', { seed: 3 })
    t.setAmmoKind('tracer')
    expect(shootOnce(t).tracer).toBe(true)
    const b = arsenal.create('rifle_bolt_308', { seed: 3 })
    b.setAmmoKind('ap')
    expect(arsenal.restore(b.snapshot()).ammoKind).toBe('ap')
  })

  it('an unknown load throws; the table is configurable without touching the code', () => {
    expect(() => arsenal.create('rifle_bolt_308').setAmmoKind('buck')).toThrow(/no ammo/)
    const custom = createArsenal({
      rules: { faults: false },
      patch: { ammo: { '7_62x51:fmj': { penetration: { steel: 20 } } } },
      ammo: [{ id: '7_62x51:incendiary', caliber: '7_62x51', kind: 'incendiary', label: 'test API', core: 'steel', jacket: 'steel', incendiary: true, penetration: { steel: 9, concrete: 100, brick: 200, wood: 300 }, basis: 'estimated', sources: ['test'] }],
    })
    expect(shootOnce(custom.create('rifle_bolt_308')).penetration!.steel).toBe(20)
    expect(shootOnce(custom.create('rifle_bolt_308', { ammoKind: 'incendiary' })).incendiary).toBe(true)
    expect(() => createArsenal({ remove: { ammo: ['9x19:fmj'] } })).toThrow(/9x19/)
  })
})

describe('ignition of the rounds', () => {
  const get = (id: string) => AMMO.find((a) => a.id === id)!
  const chance = (id: string) => ammoIgnition(get(id), DEFAULT_RULES.ignition)

  it('builds the spark from the core and the jacket: lead under copper almost never, steel core and steel jacket more, armour piercing most', () => {
    const ball = chance('7_62x51:fmj').spark
    expect(ball).toBeLessThan(0.02)
    expect(chance('7_62x39:fmj').spark).toBeGreaterThan(ball * 10)
    expect(chance('5_45x39:fmj').spark).toBeGreaterThan(ball * 10)
    expect(chance('7_62x51:ap').spark).toBeGreaterThan(chance('7_62x39:fmj').spark)
    expect(chance('5_56x45:ap').spark).toBeGreaterThan(chance('5_56x45:fmj').spark)
    // independent chances of the core and the jacket
    const { core, jacket } = DEFAULT_RULES.ignition
    expect(chance('7_62x39:fmj').spark).toBeCloseTo(1 - (1 - core.steel) * (1 - jacket.steel))
  })

  it('gives the flame to incendiary and tracer rounds only', () => {
    expect(chance('7_62x51:fmj').flame).toBe(0)
    expect(chance('7_62x51:ap').flame).toBe(0)
    expect(chance('50bmg:incendiary').flame).toBe(DEFAULT_RULES.ignition.flame.incendiary)
    expect(chance('7_62x51:tracer').flame).toBe(DEFAULT_RULES.ignition.flame.tracer)
    expect(chance('12ga_00buck:incendiary').flame).toBeGreaterThan(0)
  })

  it('reads the numbers from the rules, so a game can change them', () => {
    const rules = { ...DEFAULT_RULES.ignition, flame: { incendiary: 0.9, tracer: 0 } }
    expect(ammoIgnition(get('50bmg:incendiary'), rules).flame).toBe(0.9)
    expect(ammoIgnition(get('7_62x51:tracer'), rules).flame).toBe(0)
  })

  it('puts the chances in the shot of a loaded weapon, and a game can change the rules', () => {
    const ball = shootOnce(arsenal.create('rifle_bolt_308', { seed: 1 }))
    expect(ball.ignition?.spark).toBeLessThan(0.02)
    expect(ball.ignition?.flame).toBe(0)
    const api = shootOnce(arsenal.create('ak_47', { seed: 1, ammoKind: 'incendiary' }))
    expect(api.ignition?.flame).toBe(DEFAULT_RULES.ignition.flame.incendiary)
    const custom = createArsenal({ rules: { faults: false, ignition: { flame: { incendiary: 0.25, tracer: 0 } } } })
    expect(shootOnce(custom.create('ak_47', { seed: 1, ammoKind: 'incendiary' })).ignition?.flame).toBe(0.25)
  })
})
