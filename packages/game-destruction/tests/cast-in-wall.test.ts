import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructionEvent, PartSpec } from '../src'

const REBAR = { material: 'steel', spacing: 0.15, diameter: 0.01, residualCapacity: 0.15 } as const

/**
 * A brick wall whose box reaches over the end of the 13 x 30 cm pillar that closes its corner (as the houses lay them: the wall runs on to close the corner, the
 * pillar is cast there between the bricks). No brick is laid inside the pillar, and a round that lands on the pillar lands on its concrete.
 */
const wall: PartSpec = {
  id: 'wall', material: 'brick', shape: { kind: 'box', size: [3, 2.4, 0.13] }, position: [0, 1.2, 0], thickness: 0.13, mass: 1400,
  units: { size: [0.23, 0.075, 0.11], bond: 'running', mortar: 'plaster' }, breach: { area: 0.25 },
}
// the same wall plastered over its faces and the pillar (the coat stands 2 cm proud of the pillar)
const coated: PartSpec = { ...wall, shape: { kind: 'box', size: [3, 2.4, 0.17] }, thickness: 0.17, layers: [{ material: 'plaster', thickness: 0.02, faces: 'both' }] }
// the pillar at the wall's right end, inside its box
const pillar: PartSpec = { id: 'pillar', material: 'concrete', shape: { kind: 'box', size: [0.3, 2.4, 0.13] }, position: [1.35, 1.2, 0], structure: { role: 'column' }, reinforcement: REBAR, breach: { area: 0.25 } }

const setup = (parts: PartSpec[]) => {
  const world = createDestruction({ seed: 1 })
  world.add({ parts }, { id: 'w' })
  const chips: Array<Extract<DestructionEvent, { type: 'chip' }>> = []
  world.on('chip', (e) => chips.push(e as Extract<DestructionEvent, { type: 'chip' }>))
  return { world, chips }
}

describe('a member cast in a wall of units', () => {
  it('takes the rounds that land on it: none chips a brick there, and the ray meets the pillar', () => {
    const { world, chips } = setup([wall, pillar])
    expect(world.raycast([1.35, 1.2, 5], [0, 0, -1], 10)?.part).toBe('pillar')
    expect(world.raycast([0.5, 1.2, 5], [0, 0, -1], 10)?.part).toBe('wall')
    const hit: string[] = []
    for (let i = 0; i < 30; i++) for (const r of world.shoot([1.25 + (i % 5) * 0.05, 0.8 + (i % 6) * 0.15, 5], [0, 0, -1], 2100, 7.62, 'test')) if (r.part) hit.push(r.part)
    expect(hit.length).toBeGreaterThan(0)
    expect(hit.every((id) => id === 'pillar')).toBe(true)
    // no brick came out of where the concrete is
    expect(chips.filter((c) => c.part === 'wall' && Math.abs(c.center[0] - 1.35) < 0.14)).toEqual([])
  })

  it('takes the rounds on the plaster over it: no brick under that coat', () => {
    const { world, chips } = setup([coated, pillar])
    expect(world.raycast([1.35, 1.2, 5], [0, 0, -1], 10)?.part).toBe('pillar')
    for (let i = 0; i < 20; i++) world.shoot([1.3 + (i % 3) * 0.05, 0.8 + (i % 5) * 0.2, 5], [0, 0, -1], 2100, 7.62, 'test')
    expect(chips.filter((c) => c.part === 'wall' && Math.abs(c.center[0] - 1.35) < 0.14)).toEqual([])
  })

  it('still chips the bricks beside it, and the wall alone keeps its bricks there', () => {
    const both = setup([wall, pillar])
    for (let i = 0; i < 40 && both.chips.length === 0; i++) both.world.shoot([1.05, 1.2, 5], [0, 0, -1], 2100, 7.62, 'test')
    expect(both.chips.some((c) => c.part === 'wall')).toBe(true)
    const alone = setup([wall])
    for (let i = 0; i < 40 && alone.chips.length === 0; i++) alone.world.shoot([1.35, 1.2, 5], [0, 0, -1], 2100, 7.62, 'test')
    expect(alone.chips.some((c) => c.part === 'wall' && Math.abs(c.center[0] - 1.35) < 0.15)).toBe(true)
  })
})
