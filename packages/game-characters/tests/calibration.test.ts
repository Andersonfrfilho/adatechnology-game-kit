import { CALIBERS, muzzleEnergy } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'

import { DEFAULT_DAMAGE_RULES, TORSO_RESISTANCE, createCharacters, energyKept, penetrationForce, pointsFromEnergy } from '../src'
import physical from '../src/presets/physical.json'

// P7: P = √(E·m/A) against the torso resistance 7.5 reproduces the Bestiário table (9 mm hits 2 bodies, 5.56 hits 3, .308 hits 4) and the
// game's PEN for 7.62×39 and 00 buck, with nothing but the calibres game-weapons already has. Counts exact, energy kept within ±0.05.
const caliber = (id: string) => {
  const found = CALIBERS.find((entry) => entry.id === id)
  if (!found) throw new Error(`no calibre ${id}`)
  return found
}

describe('P7 calibration against game-weapons calibers.json', () => {
  it('the torso resistance is flesh 22 cm × 0.25 + bone 2 cm × 1.0 = 7.5', () => {
    expect(TORSO_RESISTANCE).toBe(7.5)
  })

  for (const row of physical.calibration) {
    it(`${row.caliber}: force ${row.force}, ${row.expectedBodies} bodies, keeps ${row.energyKeptFirstBody} of the energy`, () => {
      const entry = caliber(row.caliber)
      const force = penetrationForce(muzzleEnergy(entry), entry.bulletGrams, entry.diameter)
      expect(force).toBeCloseTo(row.force, 2)
      const kit = createCharacters()
      const line = Array.from({ length: 5 }, (_, index) => ({ character: kit.create({ seed: index + 1, kind: 'person' }), part: 'torso', distance: 3 + index }))
      const result = kit.penetrateLine({ energyAt: () => muzzleEnergy(entry), mass: entry.bulletGrams, caliber: entry.diameter, caliberId: entry.id }, line)
      expect(result.hits).toHaveLength(row.expectedBodies)
      expect(energyKept(force, TORSO_RESISTANCE)).toBeCloseTo(row.energyKeptFirstBody, 2)
      if (row.bestiaryEnergyKept !== undefined) expect(Math.abs(energyKept(force, TORSO_RESISTANCE) - row.bestiaryEnergyKept)).toBeLessThanOrEqual(physical.tolerance.energyKept)
    })
  }

  it('points = 3.5·E^0.37: 9×19 → 35, 7.62×39 → 59, .308 → 71.7', () => {
    const points = (id: string) => pointsFromEnergy(muzzleEnergy(caliber(id)), DEFAULT_DAMAGE_RULES)
    expect(Math.round(points('9x19'))).toBe(35)
    expect(Math.round(points('7_62x39'))).toBe(59)
    expect(points('7_62x51')).toBeCloseTo(71.7, 1)
  })

  it('the energy each body takes falls by P/(P+R) along the line', () => {
    const entry = caliber('7_62x51')
    const kit = createCharacters()
    const line = Array.from({ length: 4 }, (_, index) => ({ character: kit.create({ seed: index + 1, kind: 'person', vitality: 1e6 }), part: 'torso', distance: 3 + index }))
    const energy = muzzleEnergy(entry)
    const result = kit.penetrateLine({ energyAt: () => energy, mass: entry.bulletGrams, caliber: entry.diameter }, line)
    const force = penetrationForce(energy, entry.bulletGrams, entry.diameter)
    expect(result.hits[0]!.energy).toBeCloseTo(energy, 6)
    expect(result.hits[1]!.energy).toBeCloseTo(energy * energyKept(force, 7.5), 6)
    expect(result.hits[2]!.energy).toBeCloseTo(energy * energyKept(force, 7.5) * energyKept(force - 7.5, 7.5), 6)
  })
})
