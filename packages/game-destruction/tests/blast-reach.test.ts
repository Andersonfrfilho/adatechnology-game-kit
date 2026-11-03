import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleImpl, DestructibleSpec } from '../src'

const slab = (material: string, size: [number, number, number], at: [number, number, number]): DestructibleSpec => ({
  parts: [{ id: 'slab', material, shape: { kind: 'box', size }, position: at }],
})

const centre: [number, number, number] = [0, 1, 0]
const behind: [number, number, number] = [0, 1, 4]

describe('blastReach: the cover between a blast and a point', () => {
  it('is whole in the open, and whatever BlastOptions.shelter says', () => {
    const world = createDestruction({ seed: 1 })
    expect(world.blastReach(centre, behind)).toBe(1)
  })

  it('a brick wall takes almost all of it; a board of soft wood a little; the open side of the wall nothing', () => {
    const brick = createDestruction({ seed: 1 })
    brick.add(slab('brick', [4, 3, 0.15], [0, 1.5, 2]), { id: 'wall' })
    const wood = createDestruction({ seed: 1 })
    wood.add(slab('wood_soft', [4, 3, 0.02], [0, 1.5, 2]), { id: 'board' })
    const throughBrick = brick.blastReach(centre, behind)
    const throughWood = wood.blastReach(centre, behind)
    expect(throughBrick).toBeLessThan(0.3)
    expect(throughWood).toBeGreaterThan(throughBrick)
    expect(throughWood).toBeLessThan(1)
    // beside the wall, past its end, the line does not cross it
    expect(brick.blastReach(centre, [5, 1, 4])).toBe(1)
  })

  it('ignores the objects it is told to (the explosive, the body being shoved)', () => {
    const world = createDestruction({ seed: 1 })
    world.add(slab('brick', [4, 3, 0.15], [0, 1.5, 2]), { id: 'wall' })
    expect(world.blastReach(centre, behind, { ignore: ['wall'] })).toBe(1)
  })

  it('a hosted body (a car) is cover too: its shell, crossed through both walls, not through the cabin air', () => {
    const world = createDestruction({ seed: 1 })
    const spec: DestructibleSpec = { parts: [{ id: 'body', material: 'steel', thickness: 0.0009, shape: { kind: 'box', size: [4, 1.4, 1.8] }, position: [0, 0.9, 2] }] }
    const car: DestructibleImpl = { id: 'car', describe: () => spec, hit: () => [], state: () => ({ id: 'car', parts: [], joints: [], groups: [], destroyed: false }) as never }
    world.register(car)
    const reach = world.blastReach(centre, behind)
    expect(reach).toBeLessThan(1)
    expect(reach).toBeGreaterThan(0)
    expect(world.blastReach(centre, behind, { ignore: ['car'] })).toBe(1)
  })
})
