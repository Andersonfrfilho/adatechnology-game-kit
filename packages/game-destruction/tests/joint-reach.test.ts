import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec } from '../src'

/** A 30 cm trunk (3 m tall) with a 20 cm square branch growing out of it at 2 m. */
const tree = (): DestructibleSpec => ({
  parts: [
    { id: 'trunk', material: 'green_wood', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [0, 1.5, 0] },
    { id: 'branch', material: 'green_wood', shape: { kind: 'box', size: [1, 0.2, 0.2] }, position: [0.5, 2, 0] },
  ],
  joints: [{ a: 'trunk', b: 'branch', kind: 'stem' }],
})

describe('joint wear reach', () => {
  it('axe blows at the base of a branch wear the stem joint and open it', () => {
    const w = createDestruction()
    const id = w.add(tree(), { id: 't' })
    const j = () => w.state(id)!.joints[0]
    let blows = 0
    for (; blows < 10 && !j().open; blows++) w.hitPart(id, 'branch', { type: 'slash', point: [0.22, 2.1, 0], direction: [0, -1, 0], energy: 250, radius: 0.05 })
    expect(j().open).toBe(true)
    expect(blows).toBeLessThanOrEqual(5)
    expect(w.state(id)!.groups.length).toBe(2)
  })

  it('a blow far from the joint (the branch tip) does not wear it', () => {
    const w = createDestruction()
    const id = w.add(tree(), { id: 't' })
    for (let i = 0; i < 3; i++) w.hitPart(id, 'branch', { type: 'slash', point: [0.95, 2.1, 0], direction: [0, -1, 0], energy: 100, radius: 0.05 })
    expect(w.state(id)!.joints[0].hp).toBe(w.state(id)!.joints[0].maxHp)
  })
})
