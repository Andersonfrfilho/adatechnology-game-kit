import { describe, expect, it } from 'vitest'
import type { SurfaceRay, SurfaceRayHit } from '@adatechnology/game-contracts'

import { createDestruction } from '../src'
import type { DestructibleImpl, DestructibleSpec, DestructionEvent, ObjectState, Vec3 } from '../src'

const slab = (name: string): DestructibleSpec => ({ name, parts: [{ id: 'slab', material: 'brick', shape: { kind: 'box', size: [2, 2, 0.1] }, position: [0, 0, 0] }] })
const AHEAD: Vec3 = [0, 0, 1]

/** A hosted body whose surface answers a hit at distance 0 from inside it, as the ground does, and honours `ignored`. */
function solidImpl(id: string): DestructibleImpl {
  const spec: DestructibleSpec = { name: 'solid', parts: [{ id: 'block', material: 'dirt', shape: { kind: 'box', size: [10, 10, 10] }, position: [0, 0, 0] }] }
  return {
    id,
    describe: () => spec,
    hit: () => [] as DestructionEvent[],
    update: () => [] as DestructionEvent[],
    state: (): ObjectState => ({ id, position: [0, 0, 0], rotation: [0, 0, 0, 1], groups: [['block']], destroyed: false, joints: [], parts: [] }),
    surfaceRay(ray: SurfaceRay): SurfaceRayHit | null {
      if (ray.ignored?.('block')) return null
      const z = ray.origin[2]
      const distance = z >= -5 && z <= 5 ? 0 : (-5 - z) / ray.direction[2]
      if (!(distance >= 0) || distance > ray.maxDistance) return null
      return { part: 'block', point: [ray.origin[0], ray.origin[1], z + ray.direction[2] * distance], normal: [0, 0, -1], distance, pathLen: 10 }
    },
  }
}

describe('world.raycast ignoreParts', () => {
  it('passes through an ordinary part and answers the one behind it', () => {
    const world = createDestruction()
    const front = world.add(slab('front'), { position: [0, 0, 1] })
    const back = world.add(slab('back'), { position: [0, 0, 3] })
    expect(world.raycast([0, 0, 0], AHEAD)?.object).toBe(front)
    const through = world.raycast([0, 0, 0], AHEAD, undefined, { ignoreParts: [{ object: front, part: 'slab' }] })
    expect(through?.object).toBe(back)
    expect(through?.distance).toBeCloseTo(2.95, 6)
  })

  it('passes through an impl part: from inside it answers what is past it', () => {
    const world = createDestruction()
    world.register(solidImpl('ground'))
    const wall = world.add(slab('wall'), { position: [0, 0, 2] })
    expect(world.raycast([0, 0, 0], AHEAD)?.object).toBe('ground')
    const through = world.raycast([0, 0, 0], AHEAD, undefined, { ignoreParts: [{ object: 'ground', part: 'block' }] })
    expect(through?.object).toBe(wall)
    expect(through?.distance).toBeCloseTo(1.95, 6)
    expect(world.raycast([0, 0, 0], AHEAD, undefined, { ignoreParts: [{ object: 'ground', part: 'block' }, { object: wall, part: 'slab' }] })).toBeNull()
  })

  it('an absent or empty list changes nothing', () => {
    const world = createDestruction()
    const front = world.add(slab('front'), { position: [0, 0, 1] })
    const plain = world.raycast([0, 0, 0], AHEAD)
    expect(world.raycast([0, 0, 0], AHEAD, undefined, {})).toEqual(plain)
    expect(world.raycast([0, 0, 0], AHEAD, undefined, { ignoreParts: [] })).toEqual(plain)
    expect(world.raycast([0, 0, 0], AHEAD, undefined, { ignoreParts: [{ object: 'nobody', part: 'slab' }] })?.object).toBe(front)
  })
})
