import type { BlastCharge, DestructionEvent } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { fakeRoom } from './helpers/area-room'
import { THREE } from './helpers/houses'

/** The M67 of `@adatechnology/game-weapons`: 200 kJ, 0.24 kg of TNT, a 190 g steel case in 1000 pieces round 180 g of Composition B. */
const M67_ENERGY = 200000
const M67_RADIUS = 15
const M67: BlastCharge = { tnt: 0.24, casing: { mass: 0.19, material: 'steel', fragments: 1000, chargeMass: 0.18, gurneyVelocity: 2700 } }
/** In the kitchen of single_storey_a (u 0 to 3.4, v 5 to 11), a metre over the floor, as the room's screenshots threw it: house-local (2.4, 1.0, 8.8). */
const IN_KITCHEN = new THREE.Vector3(2.4, 1.0, 8.8)

const kitchenHouse = () => {
  const r = fakeRoom()
  r.set('template', 'single_storey_a')
  r.set('seed', 1)
  r.act('build')
  r.frame(0.2)
  const { house } = r.module.houses[0]!
  const id = house.destruction.id!
  const events: DestructionEvent[] = []
  r.world.on('*', (event: DestructionEvent) => events.push(event))
  return { r, house, id, events }
}

describe('a hand grenade in the kitchen of single_storey_a', () => {
  // 0.24 kg of TNT and 1000 pieces of 0.19 g: what it can do to a 21 cm concrete ceiling slab of 27.8 t carried by pillars at 0.65 of their capacity is chip it.
  // Its whole energy lifts the slab 200 000 / (27 775 x 9.81) = 0.73 m once, and the wave puts into the slab only the P-I work of a few hundred pascal-seconds on it.
  // Glass is the other way: 4 mm panes fail at about 6 kPa and the wave is 180 kPa at 2 m, and the fragments hole what they reach.
  it('cracks and breaks the kitchen glass and brings nothing of the structure down in the 25 s after it', () => {
    const { r, house, id, events } = kitchenHouse()
    const at = house.group.localToWorld(IN_KITCHEN.clone())
    r.world.explode([at.x, at.y, at.z], M67_ENERGY, M67_RADIUS, 'player', { charge: M67 })
    r.frame(25, 0.05)
    const spec = house.destruction.spec!
    const structural = new Set(spec.parts.filter((part) => part.structure && part.structure.role !== 'none').map((part) => part.id))
    const fallen = events.filter((event) => event.type === 'collapse').flatMap((event) => (event as { parts?: string[] }).parts ?? []).filter((part) => structural.has(part))
    expect(fallen).toEqual([])
    const state = r.world.state(id)!
    for (const part of state.parts) if (structural.has(part.id)) expect(part.stress ?? 0, part.id).toBeLessThanOrEqual(1)
    expect(state.parts.filter((part) => /^slab_ceiling/.test(part.id)).every((part) => part.status !== 'broken' && part.status !== 'collapsed')).toBe(true)
    // the panes of the kitchen walls (u 0 to 3.4, v 5 to 11)
    const kitchen = spec.parts.filter((part) => /^window:w/.test(part.id) && part.position[0] > -0.3 && part.position[0] < 3.7 && part.position[2] > 4.7 && part.position[2] < 11.3).map((part) => part.id)
    expect(kitchen.length).toBeGreaterThan(0)
    const panes = state.parts.filter((part) => kitchen.includes(part.id))
    expect(panes.some((part) => part.status === 'broken')).toBe(true)
    expect(panes.every((part) => part.status === 'broken' || part.cracks.length + part.holes.length > 0)).toBe(true)
  }, 600000)

  it('keeps every window, door and jamb of the house and of its outbuilding in its wall: none comes loose as a free piece', () => {
    const { r, house, id } = kitchenHouse()
    const at = house.group.localToWorld(IN_KITCHEN.clone())
    r.world.explode([at.x, at.y, at.z], M67_ENERGY, M67_RADIUS, 'player', { charge: M67 })
    r.frame(2, 0.05)
    const fitted = house.destruction.spec!.parts.filter((part) => /^(window|window_frame|door|jamb):/.test(part.id)).map((part) => part.id)
    expect(fitted.some((part) => /outbuilding/.test(part))).toBe(true)
    const inHouse = new Set(r.world.state(id)!.parts.map((part) => part.id))
    expect(fitted.filter((part) => !inHouse.has(part))).toEqual([])
  }, 600000)
})
