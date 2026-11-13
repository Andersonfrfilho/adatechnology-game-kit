import { describe, expect, it } from 'vitest'

import { LAID_MASONRY_GPA, bearingModulus, isUpright } from '../src'

describe('how stiff a support is', () => {
  it('cast concrete by its own modulus, laid masonry by its mortar joints (NBR 16868 E = 800 f_pk)', () => {
    expect(bearingModulus('concrete')).toBe(28)
    // a wall of concrete blocks laid in mortar, and one block laid on its own (bedded in mortar): masonry, not concrete
    expect(bearingModulus('concrete', { units: { size: [0.39, 0.19, 0.14], bond: 'running', mortar: 'plaster' } })).toBe(LAID_MASONRY_GPA)
    expect(bearingModulus('concrete', { bedded: true })).toBe(LAID_MASONRY_GPA)
    // a pillar cast with its concrete as blocks (the way it breaks) is still cast
    expect(bearingModulus('concrete', { units: { size: [0.1, 0.1, 0.14], bond: 'stack', mortar: 'concrete' } })).toBe(28)
    expect(bearingModulus('wood_soft')).toBeUndefined()
  })

  it('a pillar, a wall and a partition stand up the storey; a beam, a slab and a foundation lie', () => {
    expect(['column', 'wall', 'partition'].every((role) => isUpright(role as never))).toBe(true)
    expect(['beam', 'slab', 'foundation', 'roof'].some((role) => isUpright(role as never))).toBe(false)
  })
})
