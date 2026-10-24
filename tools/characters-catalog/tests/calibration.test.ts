import { CALIBERS, muzzleEnergy } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'

import { bodiesHit, penetrationForce, torsoResistance } from '../src/penetration'

import { inputs, readOutput } from './helpers'

type PhysicalPreset = {
  readonly torsoResistance: number
  readonly calibration: readonly { readonly caliber: string; readonly force: number; readonly bodies: number; readonly energyKeptFirstBody: number; readonly bestiaryEnergyKept?: number }[]
}
type TeamGamePreset = {
  readonly calibers: Readonly<Record<string, { readonly penetration: number; readonly points: number; readonly pellets?: number }>>
  readonly regionCost: { readonly torso: number }
  readonly damageKeptPerBody: number
}

const rule = inputs.decisions.physicalPenetration.value
const preset = readOutput<PhysicalPreset>('presetPhysical')
const teamGame = readOutput<TeamGamePreset>('presetTeamGame')
const caliberOf = (id: string) => {
  const caliber = CALIBERS.find((entry) => entry.id === id)
  if (!caliber) throw new Error(`game-weapons has no calibre ${id}`)
  return caliber
}

// The P7 calibration table of the design (T4 §2): the bodies a shot crosses, from game-weapons energies, mass and diameter alone.
const TABLE: readonly (readonly [string, number, number])[] = [
  ['9x19', 2, 7.67],
  ['5_56x45', 3, 16.56],
  ['7_62x51', 4, 26.67],
  ['7_62x39', 3, 18.52],
  ['12ga_00buck', 1, 4.35],
]

describe('P7 physical penetration', () => {
  it('has a torso resistance of 7.5: flesh 22 cm x 0.25 plus bone 2 cm x 1.0', () => {
    expect(torsoResistance(rule)).toBe(7.5)
    expect(preset.torsoResistance).toBe(7.5)
  })

  it.each(TABLE)('%s crosses %i bodies, with force P = sqrt(E m / A) = %f from the game-weapons calibre', (id, bodies, force) => {
    const caliber = caliberOf(id)
    const energy = muzzleEnergy(caliber)
    const area = (Math.PI * caliber.diameter ** 2) / 4
    const independentForce = Math.sqrt((energy * caliber.bulletGrams) / area)
    expect(independentForce).toBeCloseTo(force, 1)
    expect(penetrationForce({ id, diameter: caliber.diameter, bulletGrams: caliber.bulletGrams, muzzleSpeed: caliber.muzzleSpeed })).toBeCloseTo(independentForce, 9)
    expect(bodiesHit(independentForce, 7.5)).toBe(bodies)
  })

  it('writes the same counts in the generated preset and keeps the energy per body within 0.05 of the Bestiário (9 mm, 5.56, .308)', () => {
    expect(preset.calibration.map((row) => [row.caliber, row.bodies])).toEqual(TABLE.map(([id, bodies]) => [id, bodies]))
    for (const row of preset.calibration) {
      if (row.bestiaryEnergyKept === undefined) continue
      expect(Math.abs(row.energyKeptFirstBody - row.bestiaryEnergyKept), row.caliber).toBeLessThanOrEqual(rule.tolerance.energyKept)
    }
    expect(preset.calibration.filter((row) => row.bestiaryEnergyKept !== undefined).map((row) => row.energyKeptFirstBody)).toEqual([0.51, 0.69, 0.78])
  })

  it('stops a shot that is not strong enough: the 00 buckshot pellet hits one body and a weaker force hits none after it', () => {
    expect(bodiesHit(4.35, 7.5)).toBe(1)
    expect(bodiesHit(7.5, 7.5)).toBe(1)
    expect(bodiesHit(7.51, 7.5)).toBe(2)
  })

  it('gives the default points of the design, 3.5 * E^0.37: 35, 59 and 71.7 (the design rounds the .308 down to 71)', () => {
    const { coefficient, exponent } = rule.points
    const points = (id: string): number => coefficient * muzzleEnergy(caliberOf(id)) ** exponent
    expect([points('9x19'), points('7_62x39')].map(Math.round)).toEqual([35, 59])
    expect(points('7_62x51')).toBeGreaterThan(71)
    expect(points('7_62x51')).toBeLessThan(72)
  })
})

describe('the team-game preset (the game pen points, golden only)', () => {
  it('crosses the same bodies as the game: pen points minus 1 per torso, until nothing is left', () => {
    const crossed = (id: string): number => {
      let pen = teamGame.calibers[id]?.penetration ?? 0
      let bodies = 0
      while (pen > 0) {
        bodies += 1
        pen -= teamGame.regionCost.torso
      }
      return bodies
    }
    expect(['9x19', '12ga_00buck', '7_62x39', '7_62x51'].map(crossed)).toEqual([2, 1, 3, 4])
    expect(teamGame.damageKeptPerBody).toBe(0.75)
  })

  it('has the game points per calibre (the ZombiAdA table)', () => {
    expect(['9x19', '12ga_00buck', '7_62x39', '7_62x51'].map((id) => teamGame.calibers[id]?.points)).toEqual([35, 12, 55, 75])
    expect(teamGame.calibers['12ga_00buck']?.pellets).toBe(9)
  })
})
