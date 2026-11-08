import { engine } from '@adatechnology/game-floorplan'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import { GROUND, register as registerStructure, slabsOffSupport, toDestructibleSpec, validateSpec, validateStructure } from '@adatechnology/game-floorplan-structure'
import type { SourceDoor, Structure } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import { buildResidentialTower, register, residentialTemplateIds } from '../src'

register(engine, { region: 'br' })
registerStructure(engine)

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]
/** The tower is a spec built straight from its layout (`buildResidentialTower`), checked below. */
const HOUSES = residentialTemplateIds.filter((id) => id !== 'residential_tower')

/** Construction tests (CLAUDE.md §11): every residential typology is a structure a structural engineer signs, the validator of the SDK finds nothing. */
describe('residential construction', () => {
  for (const id of HOUSES) {
    it(`${id}: confined masonry, concrete and load paths on seeds ${SEEDS[0]}-${SEEDS[SEEDS.length - 1]}`, () => {
      for (const seed of SEEDS) {
        const plan = engine.generate(id, { seed }) as unknown as { structure: Structure; doors: SourceDoor[] }
        expect(validateStructure(plan.structure, { doors: plan.doors }), `${id} seed ${seed}`).toEqual([])
      }
    })
  }

  it('residential_tower: the frame, core and piles reach the ground with NBR 6118 sections', () => {
    expect(validateSpec(buildResidentialTower({ storeys: 20 }))).toEqual([])
  }, 180000)

  /**
   * A crater under a corner of the house (3 m in radius, 2 m deep): the ground beams, the pillars and the wall pillars over it lose their support and fall, and
   * the load path solved again leaves nothing standing without one (no part floats, CLAUDE.md §12).
   */
  for (const id of HOUSES) {
    it(`${id}: a crater under a corner leaves no unsupported part standing`, () => {
      const plan = engine.generate(id, { seed: 1 }) as unknown as { structure: Structure; doors: SourceDoor[] }
      expect(validateStructure(plan.structure, { doors: plan.doors })).toEqual([])
      const spec = toDestructibleSpec(plan.structure, { wallDetail: 'coarse' })
      // what bears on the ground: the ground beams of a house, the pillars of a building
      const onGround = new Set((spec.joints ?? []).filter((joint) => joint.b === GROUND).map((joint) => joint.a))
      const bearers = spec.parts.filter((part) => onGround.has(part.id))
      expect(bearers.length).toBeGreaterThan(0)
      const world = createDestruction({ seed: 1 })
      const house = world.add(spec)
      const events: DestructionEvent[] = []
      world.on('*', (event) => events.push(event))
      const bearing = new Set(world.state(house)!.parts.filter((part) => (part.stress ?? 0) > 0).map((part) => part.id))
      world.groundLoss({ x: Math.min(...bearers.map((part) => part.position[0])), z: Math.min(...bearers.map((part) => part.position[2])), radius: 3, depth: 2, source: 'crater' })
      // 15 s in quarter-second steps: the collapse settles well within it, and a long synchronous loop starves the test runner on a loaded machine
      for (let t = 0; t < 15; t += 0.25) world.update(0.25)
      const parts = world.state(house)!.parts
      const standing = parts.filter((part) => part.status !== 'broken' && part.status !== 'collapsed')
      expect(events.some((event) => event.type === 'subside' && event.status === 'unsupported')).toBe(true)
      expect(events.some((event) => event.type === 'collapse')).toBe(true)
      expect(standing.filter((part) => bearing.has(part.id) && !((part.stress ?? 0) > 0)).map((part) => part.id)).toEqual([])
      // and no slab or roof that only rests is left standing on one edge: its centre is over what it still bears on
      expect(slabsOffSupport(spec, world.state(house)!)).toEqual([])
      expect(standing.length).toBeGreaterThan(parts.length / 2)
    })
  }
})
