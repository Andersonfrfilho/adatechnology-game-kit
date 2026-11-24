import { describe, expect, it } from 'vitest'

import type { StructuredResult } from '@adatechnology/game-floorplan-structure'
import type { PlanRect } from '@adatechnology/game-urban'

import { houseSizeOf, registerPacks, stateOfLot } from '../src/game/assemble/houses'
import { lineRects } from '../src/game/geometry'
import { lotPlacement } from '../src/game/placement'
import { polePointsOf, STREET_LIGHT_CURB_SETBACK } from '../src/game/roads'
import { seedOf } from '../src/game/seed'
import { SIDEWALK_WIDTH, plan, site } from './helpers'

const POLE_SPACING = 32
/** The house renderer (`game-floorplan-three`) draws the street grid's two neighbouring poles this far along the facade from the service pole. */
const NEIGHBOUR_POLE_SPAN = 22

/** The engine with the packs the page registers (the structure pack gives every plan its installations, the service pole among them). */
const engine = registerPacks()
const lines = plan.lines ?? []
const streets = lines.filter((line) => line.kind === 'street' || line.kind === 'avenue')
const roadBands = [...streets, ...lines.filter((line) => line.kind === 'river')].flatMap((line) => lineRects(line).map((rect) => ({ line: line.id, rect })))
const isInside = (x: number, z: number, rect: PlanRect): boolean => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3]
const roadUnder = (x: number, z: number): string | undefined => roadBands.find((band) => isInside(x, z, band.rect))?.line

/** Every pole a house of the site brings, in the world: its service pole and the grid's neighbours on each side, turned and moved as the assembler places the house. */
function housePoles(): Array<{ readonly lot: string; readonly isService: boolean; readonly x: number; readonly z: number }> {
  return site.lots.flatMap((lot) => {
    const generated = engine.generate(lot.typology, { seed: seedOf(site.seed, lot.id), ...(stateOfLot(lot) === undefined ? {} : { state: stateOfLot(lot) }) })
    const pole = (generated as StructuredResult).utilities.electrical.serviceEntrance?.pole
    if (!pole) return []
    const placement = lotPlacement(lot.rect, lot.front, houseSizeOf(generated))
    const cos = Math.round(Math.cos(placement.ry))
    const sin = Math.round(Math.sin(placement.ry))
    return [-NEIGHBOUR_POLE_SPAN, 0, NEIGHBOUR_POLE_SPAN].map((du) => ({ lot: lot.id, isService: du === 0, x: placement.x + (pole.u + du) * cos + pole.v * sin, z: placement.z - (pole.u + du) * sin + pole.v * cos }))
  })
}

describe('poles stand on the sidewalk, never on the road', () => {
  it('no street light is on the road of any street nor in the river', () => {
    const points = polePointsOf({ plan, spacing: POLE_SPACING, setback: STREET_LIGHT_CURB_SETBACK })
    expect(points.length).toBeGreaterThan(10)
    for (const point of points) expect(roadUnder(point.x, point.z), `${point.line} (${point.x}, ${point.z})`).toBeUndefined()
  })

  it('every street light stands on the sidewalk of its street, the setback back from the curb', () => {
    for (const point of polePointsOf({ plan, spacing: POLE_SPACING, setback: STREET_LIGHT_CURB_SETBACK })) {
      const street = streets.find((line) => line.id === point.line)!
      const axis = street.points[0]!
      const along = street.points[1]![1] === axis[1] ? 'x' : 'z'
      const fromAxis = Math.abs(along === 'x' ? point.z - axis[1] : point.x - axis[0])
      expect(fromAxis - street.width / 2, `${point.line} (${point.x}, ${point.z})`).toBeCloseTo(STREET_LIGHT_CURB_SETBACK)
      expect(fromAxis).toBeLessThan(street.width / 2 + SIDEWALK_WIDTH)
    }
  })

  it('no pole a house brings (its service pole and the grid beside it) is on the road nor in the river', () => {
    const poles = housePoles()
    expect(poles.length).toBeGreaterThan(0)
    for (const pole of poles) expect(roadUnder(pole.x, pole.z), `${pole.lot} (${pole.x.toFixed(2)}, ${pole.z.toFixed(2)})`).toBeUndefined()
  })

  it('the service pole of a house on the script street is on its sidewalk', () => {
    for (const pole of housePoles().filter((item) => item.isService && item.lot.startsWith('street_'))) {
      expect(Math.abs(pole.z), pole.lot).toBeGreaterThan(5)
      expect(Math.abs(pole.z), pole.lot).toBeLessThan(5 + SIDEWALK_WIDTH)
    }
  })
})
