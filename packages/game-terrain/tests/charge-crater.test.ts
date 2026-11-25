import { TNT_JOULES } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createTerrain, TERRAIN_MATERIALS } from '../src'

const BOUNDS = [-10, -10, 10, 10] as const
/** PG-7V (RPG-7): 0.45 kg of TNT equivalent (`game-weapons` explosives.json), 200 kJ on the arsenal's damage scale. */
const PG7V = { tnt: 0.45, hasCharge: true, energy: 200_000, radius: 16 } as const

/** The bowl a charge digs in one uniform material, from the catalogue alone: `volume = E / specificEnergy`, a paraboloid of depth over radius `aspect`. */
function bowlDepthOf(material: string, joules: number): number {
  const response = TERRAIN_MATERIALS.find((entry) => entry.id === material)!.hits.explosive!
  const volume = joules / response.specificEnergy
  return response.aspect * Math.cbrt((2 * volume) / (Math.PI * response.aspect))
}

const blast = (surface: string, hit: { readonly tnt?: number; readonly hasCharge?: true; readonly energy: number; readonly radius: number }): ReturnType<ReturnType<typeof createTerrain>['applyHit']> =>
  createTerrain({ bounds: BOUNDS, layout: { surface } }).applyHit({ type: 'explosive', point: [0, 0, 0], ...hit })

describe('a charge craters the ground with its real energy', () => {
  it('an RPG on the soil of a yard digs as deep as its TNT says, not its damage scale', () => {
    const expected = bowlDepthOf('soil', PG7V.tnt * TNT_JOULES)
    const result = blast('dirt', PG7V)!
    expect(expected).toBeGreaterThan(0.35)
    expect(result.depth).toBeGreaterThanOrEqual(expected - 0.01)
    expect(result.depth).toBeGreaterThan(bowlDepthOf('soil', PG7V.energy) * 1.5)
  })

  it('the yard under construction (topsoil over clay) is dug past its topsoil', () => {
    expect(blast('yard', PG7V)!.totalDepth).toBeGreaterThan(0.35)
  })

  it('a blast that was not told its charge keeps its energy (its `tnt` is only the stand-in of the arsenal scale)', () => {
    expect(blast('dirt', { energy: PG7V.energy, radius: PG7V.radius })!.depth).toBeCloseTo(bowlDepthOf('soil', PG7V.energy), 2)
    expect(blast('dirt', { energy: PG7V.energy, tnt: 0.24, radius: PG7V.radius })!.depth).toBeCloseTo(bowlDepthOf('soil', PG7V.energy), 2)
  })
})
