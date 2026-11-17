import { describe, expect, it } from 'vitest'

import { JOINT_DEFAULTS, createDestruction, embedmentResistance, embedmentStrength, postEmbedment } from '../src'
import type { DestructibleSpec } from '../src'

/** A 2 m concrete post set in the ground with a joint as strong as its buried base: `depth` metres of it below the surface. */
function postIn(depth: number): { world: ReturnType<typeof createDestruction>; id: string } {
  const spec: DestructibleSpec = {
    parts: [
      { id: 'ground', material: 'concrete', shape: { kind: 'box', size: [4, 0.4, 4] }, position: [0, -0.2, 0], anchored: true, hp: 1e12, structure: { role: 'foundation' } },
      { id: 'post', material: 'concrete', shape: { kind: 'box', size: [0.2, 2, 0.2] }, position: [0, 1, 0] },
    ],
    joints: [{ a: 'post', b: 'ground', kind: 'mortar', strength: embedmentStrength('mortar', { depth, width: 0.2 }), bears: false }],
  }
  const world = createDestruction({ seed: 1 })
  return { world, id: world.add(spec, { id: 'post' }) }
}

describe('a part set in the ground', () => {
  it('is held by its buried base: deeper, wider and in firmer soil is stronger; nothing buried holds nothing', () => {
    expect(embedmentResistance({ depth: 0, width: 0.2 })).toBe(0)
    expect(embedmentStrength('mortar', { depth: 1.2, width: 0.2 })).toBeGreaterThan(embedmentStrength('mortar', { depth: 0.3, width: 0.2 }))
    expect(embedmentStrength('mortar', { depth: 1, width: 0.4 })).toBeGreaterThan(embedmentStrength('mortar', { depth: 1, width: 0.2 }))
    expect(embedmentStrength('mortar', { depth: 1, width: 0.2, soil: 'gravel_dense' })).toBeGreaterThan(embedmentStrength('mortar', { depth: 1, width: 0.2, soil: 'clay_soft' }))
    // the reference base (20 cm wide, 1 m deep, stiff clay) has the kind's own strength
    expect(embedmentStrength('mortar', { depth: 1, width: 0.2 })).toBeCloseTo(JOINT_DEFAULTS.mortar.strength, 6)
    // a layered ground counts each layer over the depth it covers
    const layered = embedmentResistance({ depth: 1, width: 0.2, soil: { layers: [{ soil: 'clay_soft', thickness: 0.5 }, { soil: 'gravel_dense' }] } })
    expect(layered).toBeCloseTo(embedmentResistance({ depth: 0.5, width: 0.2, soil: 'clay_soft' }) + embedmentResistance({ depth: 0.5, width: 0.2, soil: 'gravel_dense' }), 6)
  })

  it('a pole is buried a tenth of its height and 0.6 m', () => {
    expect(postEmbedment(7.5)).toBeCloseTo(1.35, 6)
  })

  it('the same post: the deep one holds a push the shallow one does not', () => {
    const push = (depth: number): boolean => {
      const { world, id } = postIn(depth)
      world.hitPart(id, 'post', { type: 'blunt', point: [0, 0.3, 0.1], direction: [0, 0, -1], energy: 300, radius: 0.1, source: 'test' })
      world.update(1 / 30)
      return world.state(id)!.joints.find((joint) => joint.a === 'post')!.open
    }
    expect(push(0.05)).toBe(true)
    expect(push(postEmbedment(2))).toBe(false)
  })
})
