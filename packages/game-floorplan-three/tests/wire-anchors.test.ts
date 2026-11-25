import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import { engine } from '@adatechnology/game-floorplan'
import { commercialTemplateIds } from '@adatechnology/game-floorplan-commercial'
import { residentialTemplateIds } from '@adatechnology/game-floorplan-residential'
import { register as registerRural, ruralTemplateIds } from '@adatechnology/game-floorplan-rural'
import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { houseOf, planOf } from './helpers/houses'

const kit = { GameInteractables, GameInteractablesHousehold, GameInteractablesThree }
/** How far from a pole's axis a grid wire may end: its crossarm is 1.6 m wide. */
const CROSSARM_HALF = 0.85

planOf('single_storey_a', 1)
registerRural(engine)
/** The towers take minutes each to draw (30 and 40 storeys): their service entrance is drawn by the same code as every other house's. */
const TOWERS: readonly string[] = ['residential_tower', 'office_tower']
const TEMPLATE_IDS = [...residentialTemplateIds, ...commercialTemplateIds, ...ruralTemplateIds].filter((id) => !TOWERS.includes(id))

/** The x of every pole a wire may end on: the poles drawn as pieces, and the kit's service pole. */
function poleAxesOf(house: House): number[] {
  const pieces = house.structure.parts.filter((part) => part.id.startsWith('pole:')).map((part) => (part.aabb[0] + part.aabb[2]) / 2)
  const service = [...(house.interactives?.entries.values() ?? [])].filter((entry) => entry.type === 'service_entrance').map((entry) => entry.pos[0])
  return [...pieces, ...service]
}

// A wire exists only where both its ends hang from something built: no stretch hangs from a pole that is not a piece, and every grid run ends on a pole
describe('the wires of a house hang from what was built', () => {
  for (const template of TEMPLATE_IDS) for (const withKit of [false, true]) {
    it(`${template}${withKit ? ' with the interactables kit' : ''}: every stretch is held by a built piece, every grid run ends on a pole`, () => {
      const { house } = houseOf(planOf(template, 1) as never, withKit ? { interactives: kit as never } : {}, { quality: 'game' })
      const { parts, supports, byId, unheld } = house.structure
      expect(unheld, 'pieces nothing holds').toEqual([])
      const wiring = parts.filter((part) => part.id.startsWith('wiring:'))
      for (const wire of wiring) {
        const holds = supports.filter((support) => support.part === wire.id)
        expect(holds.length, `${wire.id} is held`).toBeGreaterThan(0)
        for (const support of holds) expect(support.on === 'ground' || byId.has(support.on), `${wire.id} on ${support.on}`).toBe(true)
      }
      const axes = poleAxesOf(house)
      for (const side of ['w', 'e']) {
        const run = wiring.filter((part) => part.id.startsWith(`wiring:grid:${side}:`))
        if (!run.length) continue
        for (const end of [Math.min(...run.map((part) => part.aabb[0])), Math.max(...run.map((part) => part.aabb[2]))]) {
          expect(axes.some((axis) => Math.abs(axis - end) <= CROSSARM_HALF), `grid ${side} end at ${end.toFixed(2)} on a pole (${axes.map((axis) => axis.toFixed(2)).join(', ')})`).toBe(true)
        }
      }
      house.dispose()
    })
  }
})
