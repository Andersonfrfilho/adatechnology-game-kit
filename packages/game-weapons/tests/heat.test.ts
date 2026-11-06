import { describe, expect, it } from 'vitest'
import { barrelMassOf, coolingTimeConstant, createArsenal, decayHeat, roundsToWarning } from '../src'
import { fireUntilWarning } from './support/heat-session'

const arsenal = createArsenal({ rules: { faults: false } })
const rules = arsenal.rules.heat

type Band = { readonly min: number; readonly max: number }

const roundsAtWarning = (options: Parameters<typeof fireUntilWarning>[0]): number => {
  const result = fireUntilWarning(options)
  if (result.roundsAtWarning === undefined) throw new Error(`${options.weaponId} never reached the warning in ${result.roundsFired} rounds`)
  return result.roundsAtWarning
}

describe('barrel heat: rounds to the warning, from cold, at the real cyclic rate', () => {
  const rapid: ReadonlyArray<readonly [string, string, Band]> = [
    ['colt_m4a1', 'M4 / AR-15: 120 to 150 rounds of rapid fire', { min: 120, max: 150 }],
    ['ak_47', 'AK: the same band as the M4', { min: 110, max: 150 }],
  ]
  for (const [weaponId, label, band] of rapid) {
    it(label, () => {
      const rounds = roundsAtWarning({ weaponId })
      expect(rounds).toBeGreaterThanOrEqual(band.min)
      expect(rounds).toBeLessThanOrEqual(band.max)
    })
  }

  it('M4: the cook-off risk (the end of the fault span) is past 200 rounds of continuous fire', () => {
    const hotArsenal = createArsenal({ rules: { faults: false, heat: { faultFrom: rules.faultFrom + rules.faultSpan } } })
    const weapon = hotArsenal.create('colt_m4a1', { reserve: 1000 })
    let rounds = 0
    for (let frame = 0; frame < 60 * 600 && weapon.heat < rules.faultFrom + rules.faultSpan; frame++) {
      if (weapon.ammo === 0 && !weapon.reloading) weapon.reload()
      rounds += weapon.trigger([0, 1.5, 0], [0, 0, -1], 1 / 60, true).rounds
      if (weapon.ammo > 0 || weapon.reloading) weapon.update(1 / 60)
    }
    expect(rounds).toBeGreaterThanOrEqual(200)
    expect(rounds).toBeLessThanOrEqual(260)
  })

  it('machine guns with a heavy barrel (FN MAG, PKM): 200 to 300 rounds at a sustained 100 rounds per minute', () => {
    for (const weaponId of ['fn_mag', 'pkm']) {
      const rounds = roundsAtWarning({ weaponId, pullEverySeconds: 0.6 })
      expect(rounds, weaponId).toBeGreaterThanOrEqual(200)
      expect(rounds, weaponId).toBeLessThanOrEqual(300)
    }
  })

  it('minigun: six barrels share the heat, well over 1000 rounds of continuous fire', () => {
    const rounds = roundsAtWarning({ weaponId: 'm134' })
    expect(rounds).toBeGreaterThanOrEqual(1100)
    expect(rounds).toBeLessThanOrEqual(1600)
  })

  it('pistol: forty magazines at two shots per second with a reload pause never reach the warning', () => {
    const result = fireUntilWarning({ weaponId: 'glock_17', pullEverySeconds: 0.5, extraReloadSeconds: 3, maxRounds: 17 * 40 })
    expect(result.roundsAtWarning).toBeUndefined()
    expect(result.roundsFired).toBeGreaterThanOrEqual(17 * 40)
    expect(result.peakHeat).toBeLessThan(rules.faultFrom * 0.85)
  })

  it('bolt-action rifle: a shot every 2.5 s for 200 rounds never reaches the warning', () => {
    const result = fireUntilWarning({ weaponId: 'remington_700', pullEverySeconds: 2.5, maxRounds: 200 })
    expect(result.roundsAtWarning).toBeUndefined()
    expect(result.peakHeat).toBeLessThan(rules.faultFrom * 0.8)
  })
})

describe('barrel heat: the model', () => {
  it('air cooling: a hot M4 barrel loses most of its heat in a few minutes (time constant of a few minutes)', () => {
    const def = arsenal.weapons.get('colt_m4a1')
    if (!def) throw new Error('missing colt_m4a1')
    const mass = barrelMassOf(def, rules)
    const tau = coolingTimeConstant(mass, rules)
    expect(tau).toBeGreaterThan(120)
    expect(tau).toBeLessThan(300)
    const after = decayHeat(350, 5 * 60, mass, rules)
    expect(after / 350).toBeLessThan(0.25)
  })

  it('cooling is exact: one long step equals many short ones', () => {
    const def = arsenal.weapons.get('ak_47')
    if (!def) throw new Error('missing ak_47')
    const mass = barrelMassOf(def, rules)
    let stepped = 300
    for (let i = 0; i < 600; i++) stepped = decayHeat(stepped, 0.1, mass, rules)
    expect(stepped).toBeCloseTo(decayHeat(300, 60, mass, rules), 9)
  })

  it('a round adds share x muzzle energy / (barrel mass x specific heat)', () => {
    const weapon = arsenal.create('colt_m4a1', { reserve: 100 })
    const result = weapon.trigger([0, 1.5, 0], [0, 0, -1], 0, false)
    const shot = result.shots[0]
    const def = weapon.def
    if (!shot) throw new Error('no shot')
    const expected = (rules.barrelShare.rifle * shot.energy) / (barrelMassOf(def, rules) * rules.specificHeat)
    expect(weapon.heat).toBeCloseTo(expected, 9)
  })

  it('barrel mass: length x kg per metre of the category, divided by rotary barrels, overridable per weapon', () => {
    const m4 = arsenal.weapons.get('colt_m4a1')
    const glock = arsenal.weapons.get('glock_17')
    const minigun = arsenal.weapons.get('m134')
    if (!m4 || !glock || !minigun) throw new Error('missing data')
    expect(barrelMassOf(m4, rules)).toBeCloseTo((m4.dimensions?.barrel ?? 0) * 1.6, 9)
    expect(barrelMassOf(glock, rules)).toBeCloseTo((glock.dimensions?.barrel ?? 0) * 1.0, 9)
    expect(barrelMassOf(minigun, rules)).toBe(12)
    const quickChange = { ...m4, dimensions: { ...(m4.dimensions as NonNullable<typeof m4.dimensions>), barrelMass: 3 } }
    expect(barrelMassOf(quickChange, rules)).toBe(3)
  })

  it('roundsToWarning agrees with a fired session at the cyclic rate', () => {
    const def = arsenal.weapons.get('colt_m4a1')
    const caliber = arsenal.calibers.get('5_56x45')
    if (!def || !caliber || def.action.kind !== 'firearm') throw new Error('missing data')
    const energy = 0.5 * (caliber.bulletGrams / 1000) * caliber.muzzleSpeed ** 2
    const rounds = roundsToWarning({ def, caliber, energy, rpm: def.action.rpm, rules })
    expect(rounds).toBeGreaterThanOrEqual(115)
    expect(rounds).toBeLessThanOrEqual(135)
  })
})
