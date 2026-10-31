import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructibleSpec, Vec3 } from '../src'

const boxOf = (min: Vec3, max: Vec3): { min: Vec3; max: Vec3 } => ({ min, max })

const block = (id: string): DestructibleSpec => ({ id, parts: [{ id: 'body', material: 'concrete', mass: 100, position: [0, 0, 0], rotation: [0, 0, 0, 1], shape: { kind: 'box', size: [1, 1, 1] } }], joints: [] }) as unknown as DestructibleSpec

describe('world.sweepBox', () => {
  const world = createDestruction()
  world.add(block('wall'), { id: 'wall', position: [0, 0.5, -5], rotation: [0, 0, 0, 1] })
  world.add(block('moving'), { id: 'moving', position: [0, 0.5, 0], rotation: [0, 0, 0, 1] })
  const box = boxOf([-0.5, 0, -0.5], [0.5, 1, 0.5])

  it('finds what is in the way, at the distance the box still has', () => {
    const hit = world.sweepBox(box, [0, 0, -1], 5, { ignore: 'moving' })
    expect(hit?.object).toBe('wall')
    expect(hit?.distance).toBeCloseTo(4, 1)
  })

  it('does not reach what is farther than the distance, nor what is behind', () => {
    expect(world.sweepBox(box, [0, 0, -1], 3, { ignore: 'moving' })).toBeNull()
    expect(world.sweepBox(box, [0, 0, 1], 5, { ignore: 'moving' })).toBeNull()
  })

  it('sees a thing narrower than the box, that one ray from the middle would miss', () => {
    const side = boxOf([-0.5, 0, -0.5], [1.45, 1, 0.5])
    world.add(block('post'), { id: 'post', position: [1.4, 0.5, -1.5], rotation: [0, 0, 0, 1] })
    expect(world.sweepBox(side, [0, 0, -1], 1, { ignore: 'moving' })?.object).toBe('post')
    world.remove('post')
  })

  it('counts the moving object only without ignore, and lets a box touching a wall back away', () => {
    const touching = boxOf([-0.5, 0, -4.49], [0.5, 1, -3.5])
    expect(world.sweepBox(touching, [0, 0, -1], 0.05, { ignore: 'moving' })?.object).toBe('wall')
    expect(world.sweepBox(touching, [0, 0, 1], 0.05, { ignore: 'moving' })).toBeNull()
  })
})
