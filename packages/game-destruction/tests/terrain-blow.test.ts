import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec } from '../src'

/** A brick wall on mortar over an anchored concrete slab; `tags` is what the slab is told it is. */
const wallOn = (tags?: string[]): DestructibleSpec => ({
  name: 'wall on the ground',
  parts: [
    { id: 'ground', material: 'concrete', shape: { kind: 'box', size: [10, 0.5, 10] }, position: [0, -0.25, 0], hp: 1e12, structure: { role: 'foundation' }, anchored: true, ...(tags ? { tags } : {}) },
    { id: 'wall', material: 'brick', shape: { kind: 'box', size: [3, 2.5, 0.2] }, position: [0, 1.25, 0], structure: { role: 'wall' } },
  ],
  joints: [{ id: 'wall~ground', a: 'wall', b: 'ground', kind: 'mortar', bears: 'a_on_b' }],
})

describe('a blow on the terrain', () => {
  it('a piece that lands on the terrain does not loosen the wall that stands on it', () => {
    const w = createDestruction()
    const id = w.add(wallOn(['terrain']))
    w.hitPart(id, 'ground', { type: 'blunt', point: [4, 0, 4], energy: 5000, radius: 0.08, source: 'thrown' })
    const joint = w.state(id)!.joints.find((j) => j.id === 'wall~ground')!
    expect(joint.open).toBe(false)
    expect(joint.hp).toBe(joint.maxHp)
    expect(w.part(id, 'wall')!.status).not.toBe('broken')
  })

  it('the same blow on a slab that is not the terrain wears the joints of the wall on it', () => {
    const w = createDestruction()
    const id = w.add(wallOn())
    w.hitPart(id, 'ground', { type: 'blunt', point: [4, 0, 4], energy: 5000, radius: 0.08, source: 'thrown' })
    const joint = w.state(id)!.joints.find((j) => j.id === 'wall~ground')!
    expect(joint.hp).toBeLessThan(joint.maxHp)
  })
})
