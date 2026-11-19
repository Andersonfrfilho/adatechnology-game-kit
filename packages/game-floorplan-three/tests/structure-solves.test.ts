import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

// solved once per lost part or opened joint it was 174; once per operation it is 39: the rest are the reads in the middle of the blast (a beam or a slab the wave
// bends, a part that fails, bars that show) that need the loads of that moment
const MAX_SOLVES = 39

const sobrado = () => {
  const world = createDestruction({ seed: 5 })
  const { house } = houseOf(planOf('sobrado', 3), { destruction: world })
  house.destruction.activate()
  const wall = house.structure.byId.get('wall_0_0')!
  const point: [number, number, number] = [(wall.aabb[0] + wall.aabb[2]) / 2, (wall.y0 + wall.y1) / 2, (wall.aabb[1] + wall.aabb[3]) / 2 + 0.4]
  return { world, point }
}

describe('the structure of a house in a blast (C7)', () => {
  it('is solved once per operation, not once per part lost or joint opened', () => {
    const { world, point } = sobrado()
    const before = world.structureProbe().solves
    const results = world.explode(point, 4e6, 6)
    const solves = world.structureProbe().solves - before
    const lost = results.flatMap((r) => r.events).filter((e) => e.type === 'detach').length
    expect(lost).toBeGreaterThan(100)
    expect(solves).toBeGreaterThan(0)
    expect(solves).toBeLessThanOrEqual(MAX_SOLVES)
  })

  it('gives every detach of the operation with the groups the operation left (the contract of `detach.groups`)', () => {
    const { world, point } = sobrado()
    const events: DestructionEvent[] = []
    world.on('*', (event) => events.push(event))
    world.explode(point, 4e6, 6)
    const detaches = events.filter((e): e is Extract<DestructionEvent, { type: 'detach' }> => e.type === 'detach')
    expect(detaches.length).toBeGreaterThan(100)
    for (const e of detaches) expect(e.groups).toEqual(world.state(e.object)!.groups)
    // they close the operation: nothing of it comes after the first of them
    const first = events.indexOf(detaches[0]!)
    expect(events.slice(first).every((e) => e.type === 'detach')).toBe(true)
  })
})
