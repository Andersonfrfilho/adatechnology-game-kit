import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleSpec, RayBroadPhase, Vec3 } from '../src'

const can = (material = 'aluminium'): DestructibleSpec => ({ name: 'can', parts: [{ id: 'body', material, shape: { kind: 'box', size: [0.5, 0.5, 0.5] }, position: [0, 0, 0] }] })

/** A broad phase that knows the objects in `known` and says the ray meets `met` of them (the rest it proves out of the way). */
const fakeBroadPhase = (known: ReadonlySet<string>, met: readonly string[]): RayBroadPhase => ({
  begin: () => true,
  mayMeet: (id) => !known.has(id) || met.includes(id),
  candidates: { met: () => met, covers: (id) => known.has(id), revision: () => 0 },
})

describe('the ray broad phase that names the objects to visit', () => {
  it('a tie between objects goes to the one the world holds first, whatever order the engine names them in, and an unknown object keeps its place', () => {
    const world = createDestruction()
    // all five on the same place: every ray meets each at the same distance
    for (const id of ['a', 'b', 'c', 'd', 'e']) world.add(can(), { id, position: [0, 0, 0] })
    const origin: Vec3 = [0, 0, -3]
    const direction: Vec3 = [0, 0, 1]
    const plain = world.raycast(origin, direction, 10)
    expect(plain?.object).toBe('a')
    world.setRayBroadPhase(fakeBroadPhase(new Set(['a', 'c', 'e']), ['e', 'c']))
    // `a` is proved out of the way, `b` and `d` are unknown to the engine: `b` is the first of what is left
    expect(world.raycast(origin, direction, 10)?.object).toBe('b')
    world.setRayBroadPhase(fakeBroadPhase(new Set(['a', 'b', 'c', 'd', 'e']), ['e', 'c']))
    expect(world.raycast(origin, direction, 10)?.object).toBe('c')
    // an object removed and added again goes last, as in the world's own order
    world.remove('a')
    world.add(can(), { id: 'a', position: [0, 0, 0] })
    world.setRayBroadPhase(fakeBroadPhase(new Set(['a', 'b', 'c', 'd', 'e']), ['a', 'e']))
    expect(world.raycast(origin, direction, 10)?.object).toBe('e')
    world.setRayBroadPhase(null)
    expect(world.raycast(origin, direction, 10)?.object).toBe('b')
  })
  it('after `reset` or `loadObject` of an id that already exists the ray tests the new object, not the one that was replaced', () => {
    const world = createDestruction()
    world.add(can('glass'), { id: 'a', position: [0, 0, 0] })
    world.add(can(), { id: 'b', position: [5, 0, 0] })
    world.add(can(), { id: 'c', position: [9, 0, 0] })
    const origin: Vec3 = [0, 0, -3]
    const direction: Vec3 = [0, 0, 1]
    // `a` is the only object the engine does not hold: the world keeps it in its list of uncovered objects
    world.setRayBroadPhase(fakeBroadPhase(new Set(['b', 'c']), []))
    expect(world.raycast(origin, direction, 10)?.object).toBe('a')
    const saved = world.serializeObject('a')!
    world.hit('a', { type: 'blunt', point: [0, 0, 0], direction: [0, 0, 1], energy: 3e6, radius: 0.5 })
    expect(world.raycast(origin, direction, 10)?.object).not.toBe('a')
    world.reset('a')
    expect(world.raycast(origin, direction, 10)?.object).toBe('a')
    world.hit('a', { type: 'blunt', point: [0, 0, 0], direction: [0, 0, 1], energy: 3e6, radius: 0.5 })
    expect(world.raycast(origin, direction, 10)?.object).not.toBe('a')
    world.loadObject(saved, 'a')
    expect(world.raycast(origin, direction, 10)?.object).toBe('a')
    world.setRayBroadPhase(null)
    expect(world.raycast(origin, direction, 10)?.object).toBe('a')
  })
})
