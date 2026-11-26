import { describe, expect, it } from 'vitest'

import { GUIDE, SEGMENT_TREE, chainOfRig, createRig, ragdollOfRig } from '../src'

const rig = createRig({ body: GUIDE, height: 1.8, build: 1 })

describe('ragdollOfRig and chainOfRig', () => {
  it('R0 has one part per segment, parents first, a joint on every part but the root', () => {
    const { parts } = ragdollOfRig({ rig, body: GUIDE, build: 1 })
    expect(parts).toHaveLength(SEGMENT_TREE.length)
    expect(parts[0]?.parent).toBe(-1)
    parts.forEach((part, index) => {
      if (index === 0) return expect(part.joint).toBeUndefined()
      expect(part.parent).toBeLessThan(index)
      expect(part.joint).toBeDefined()
    })
  })

  it('R0 stands at `at` and tags its parts per segment', () => {
    const origin = ragdollOfRig({ rig, body: GUIDE, build: 1, user: 2 }).parts
    const moved = ragdollOfRig({ rig, body: GUIDE, build: 1, at: [3, 1, -2], user: 2 }).parts
    expect(moved[5]?.body.position[0]).toBeCloseTo((origin[5]?.body.position[0] ?? 0) + 3, 10)
    expect(moved[5]?.body.position[1]).toBeCloseTo((origin[5]?.body.position[1] ?? 0) + 1, 10)
    expect(origin.map((part) => part.body.user)).toEqual(SEGMENT_TREE.map((_, index) => 64 + index))
  })

  it('R1 is three parts on two joints and weighs what the body weighs', () => {
    const { parts } = chainOfRig({ rig, body: GUIDE, build: 1 })
    expect(parts.map((part) => part.parent)).toEqual([-1, 0, 0])
    expect(parts.filter((part) => part.joint)).toHaveLength(2)
    const chainMass = parts.reduce((sum, part) => sum + (part.body.mass ?? 0), 0)
    const bodyMass = ragdollOfRig({ rig, body: GUIDE, build: 1 }).parts.reduce((sum, part) => sum + (part.body.mass ?? 0), 0)
    expect(chainMass).toBeCloseTo(70, 6)
    expect(bodyMass).toBeCloseTo(70, 6)
  })
})
