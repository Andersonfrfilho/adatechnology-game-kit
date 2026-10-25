import { describe, expect, it } from 'vitest'
import { CALIBERS, MUZZLE_SMOKE, createArsenal, muzzleSmokeOf } from '../src'
import type { WeaponDef } from '../src'

const arsenal = createArsenal({ rules: { faults: false } })

const caliberOf = (id: string) => {
  const found = arsenal.calibers.get(id)
  if (!found) throw new Error(`unknown calibre ${id}`)
  return found
}

const weaponOf = (id: string): WeaponDef => {
  const found = arsenal.weapons.get(id)
  if (!found) throw new Error(`unknown weapon ${id}`)
  return found
}

describe('muzzle smoke profiles and resolver', () => {
  it('ships the four profiles as data: smokeless, black_powder, suppressed and none', () => {
    expect(Object.keys(MUZZLE_SMOKE).sort()).toEqual(['black_powder', 'none', 'smokeless', 'suppressed'])
    expect(MUZZLE_SMOKE.smokeless.puffs).toBeGreaterThanOrEqual(1)
    expect(MUZZLE_SMOKE.smokeless.puffs).toBeLessThanOrEqual(2)
    expect(MUZZLE_SMOKE.smokeless.opacity).toBeLessThan(0.2)
    expect(MUZZLE_SMOKE.smokeless.life).toBeLessThan(1)
    expect(MUZZLE_SMOKE.smokeless.flash).toBe(1)

    expect(MUZZLE_SMOKE.black_powder.puffs).toBeGreaterThan(MUZZLE_SMOKE.smokeless.puffs * 2)
    expect(MUZZLE_SMOKE.black_powder.radius).toBeGreaterThan(MUZZLE_SMOKE.smokeless.radius)
    expect(MUZZLE_SMOKE.black_powder.opacity).toBeGreaterThanOrEqual(0.5)
    expect(MUZZLE_SMOKE.black_powder.life).toBeGreaterThanOrEqual(4)
    expect(MUZZLE_SMOKE.black_powder.growth).toBeGreaterThan(MUZZLE_SMOKE.smokeless.growth)
    expect(MUZZLE_SMOKE.black_powder.flash).toBe(1)

    expect(MUZZLE_SMOKE.suppressed.puffs).toBeLessThanOrEqual(1)
    expect(MUZZLE_SMOKE.suppressed.opacity).toBeLessThan(MUZZLE_SMOKE.smokeless.opacity)
    expect(MUZZLE_SMOKE.suppressed.flash).toBeCloseTo(0.15, 5)

    expect(MUZZLE_SMOKE.none).toEqual({
      puffs: 0,
      radius: 0,
      opacity: 0,
      life: 0,
      drift: 0,
      rise: 0,
      growth: 0,
      flash: 0,
    })
  })

  it('defaults modern calibres (pistols, rifles, SMGs, shotguns, machine guns) to smokeless', () => {
    for (const id of ['22lr', '9x19', '45acp', '12ga_00buck', '5_56x45', '7_62x39', '7_62x51', '338lapua', '50bmg']) {
      expect(muzzleSmokeOf({ caliber: caliberOf(id) }), id).toBe(MUZZLE_SMOKE.smokeless)
    }
    expect(muzzleSmokeOf({})).toBe(MUZZLE_SMOKE.smokeless)
  })

  it('resolves the .45-70 Government black-powder calibre to black_powder', () => {
    const bp = caliberOf('45_70_bp')
    expect(bp).toMatchObject({
      id: '45_70_bp',
      bulletGrams: 26.2,
      muzzleSpeed: 400,
      caseType: 'rifle',
      propellant: 'black_powder',
      sources: ['sdk'],
    })
    expect(CALIBERS.some((c) => c.id === '45_70_bp')).toBe(true)
    expect(muzzleSmokeOf({ caliber: bp })).toBe(MUZZLE_SMOKE.black_powder)
  })

  it('resolves arrow and crossbow_bolt calibres to none (no smoke and no flash)', () => {
    for (const id of ['arrow', 'crossbow_bolt']) {
      const caliber = caliberOf(id)
      expect(caliber.propellant).toBe('none')
      expect(muzzleSmokeOf({ caliber }), id).toBe(MUZZLE_SMOKE.none)
    }
  })

  it('lets a weapon def override the calibre profile via muzzleSmoke', () => {
    const rifle = weaponOf('winchester_1894')
    expect(muzzleSmokeOf({ caliber: caliberOf('30_30'), weapon: rifle })).toBe(MUZZLE_SMOKE.smokeless)
    expect(muzzleSmokeOf({ caliber: caliberOf('30_30'), weapon: { ...rifle, muzzleSmoke: 'black_powder' } })).toBe(MUZZLE_SMOKE.black_powder)
    expect(muzzleSmokeOf({ caliber: caliberOf('45_70_bp'), weapon: { ...rifle, muzzleSmoke: 'smokeless' } })).toBe(MUZZLE_SMOKE.smokeless)
  })

  it('suppressed always wins over calibre propellant and weapon override', () => {
    const rifle = weaponOf('colt_m4a1')
    expect(muzzleSmokeOf({ caliber: caliberOf('5_56x45'), weapon: rifle, suppressed: true })).toBe(MUZZLE_SMOKE.suppressed)
    expect(muzzleSmokeOf({ caliber: caliberOf('45_70_bp'), suppressed: true })).toBe(MUZZLE_SMOKE.suppressed)
    expect(
      muzzleSmokeOf({
        caliber: caliberOf('45_70_bp'),
        weapon: { ...rifle, muzzleSmoke: 'black_powder' },
        suppressed: true,
      }),
    ).toBe(MUZZLE_SMOKE.suppressed)

    const mp5sd = arsenal.create('hk_mp5sd3')
    expect(mp5sd.suppressed).toBe(true)
    expect(muzzleSmokeOf({ caliber: mp5sd.caliber, weapon: mp5sd.def, suppressed: mp5sd.suppressed })).toBe(MUZZLE_SMOKE.suppressed)
  })
})
