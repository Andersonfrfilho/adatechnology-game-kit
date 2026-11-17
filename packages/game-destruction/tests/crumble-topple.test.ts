import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructionEvent } from '../src'

/**
 * A pier of laid bricks that loses what holds it (here the slab it stands on is cut away under it) comes down as bricks. Without the mortar's bond it goes over about its
 * foot, to one side of its face: the bricks leave across the wall, the higher the faster, and do not drop straight down into a column of bricks standing on each other.
 * Here the ground is taken away under it.
 */
const pier = () => {
  const world = createDestruction({ seed: 3 })
  world.add({
    parts: [
      {
        id: 'pier', material: 'brick', shape: { kind: 'box', size: [0.5, 2.4, 0.13] }, position: [0, 1.2, 0], mass: 290, thickness: 0.13,
        units: { size: [0.23, 0.075, 0.11], bond: 'running', mortar: 'plaster' }, breach: { area: 0.25 }, structure: { role: 'wall' },
      },
      { id: 'ground', material: 'concrete', shape: { kind: 'box', size: [6, 0.5, 6] }, position: [0, -0.25, 0], anchored: true, hp: 1e12, structure: { role: 'foundation' }, tags: ['terrain'] },
    ],
    joints: [{ a: 'pier', b: 'ground', kind: 'mortar', strength: 400, bears: 'a_on_b' }],
  }, { id: 'P' })
  const events: DestructionEvent[] = []
  world.on('*', (e) => events.push(e))
  return { world, events }
}

describe('laid masonry that lost its support', () => {
  it('goes over about its foot: the bricks leave across the wall, the top ones fastest', () => {
    const { world, events } = pier()
    world.groundLoss({ x: 0, z: 0, radius: 1.5, depth: 1.5, source: 'crater' })
    for (let t = 0; t < 30; t++) world.update(0.1)
    const crumbled = events.find((e): e is Extract<DestructionEvent, { type: 'fracture' }> => e.type === 'fracture' && e.part === 'pier' && e.style === 'crumble')
    expect(crumbled, events.map((e) => e.type).join(',')).toBeDefined()
    const bricks = crumbled!.fragments.filter((f) => f.unit)
    expect(bricks.length).toBeGreaterThan(20)
    const across = (f: (typeof bricks)[number]) => f.velocity[2]
    const sides = new Set(bricks.filter((f) => f.center[1] > 1).map((f) => Math.sign(across(f))))
    // all to one side
    expect(sides.size).toBe(1)
    const top = bricks.filter((f) => f.center[1] > 2)
    const low = bricks.filter((f) => f.center[1] < 0.6)
    const mean = (list: typeof bricks) => list.reduce((s, f) => s + Math.abs(across(f)), 0) / list.length
    expect(mean(top)).toBeGreaterThan(1.5)
    expect(mean(top)).toBeGreaterThan(3 * mean(low))
  })
})
