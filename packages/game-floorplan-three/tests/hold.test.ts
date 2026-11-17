import { describe, expect, it } from 'vitest'

import { buriedBase, groundJointStrength, standsOnGround, terrainUnder } from '../src/destruction/hold'

/** A 20 cm post, its foot at `y0` (below 0 is buried in the terrain). */
const post = (y0: number) => ({ aabb: [0, 0, 0.2, 0.2], y0 })

describe('what the ground holds', () => {
  it('an embedded post stands on the ground: a buried foot is anchored, never floating', () => {
    expect(standsOnGround(post(-0.8))).toBe(true)
    expect(standsOnGround(post(0))).toBe(true)
    expect(standsOnGround(post(0.03))).toBe(true)
    expect(standsOnGround(post(0.3))).toBe(false)
    expect(buriedBase(post(-0.8))).toEqual({ depth: 0.8, width: 0.2 })
  })

  it('reads the terrain at the lowest corner of the footprint (a lot may slope)', () => {
    const slope = (u: number): number => 0.5 * u
    expect(terrainUnder({ aabb: [1, 0, 2, 1], y0: 0 }, slope)).toBe(0.5)
    expect(standsOnGround({ aabb: [1, 0, 2, 1], y0: 0.52 }, terrainUnder({ aabb: [1, 0, 2, 1], y0: 0.52 }, slope))).toBe(true)
  })

  it('a deeply buried post is set harder than one that barely touches the ground; one drawn at the surface keeps its declared base', () => {
    const shallow = groundJointStrength(post(-0.05), 'mortar')!
    const deep = groundJointStrength(post(-1.2), 'mortar')!
    expect(deep).toBeGreaterThan(10 * shallow)
    expect(groundJointStrength(post(0), 'mortar')).toBeUndefined()
    expect(groundJointStrength({ ...post(0), embedment: { depth: 1.35, width: 0.22 } }, 'mortar')).toBeGreaterThan(deep)
  })
})
