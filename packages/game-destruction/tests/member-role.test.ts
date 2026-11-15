import { describe, expect, it } from 'vitest'

import { isMember, memberStirrups } from '../src/rebar'

describe('long members by role', () => {
  it('a deep beam (22 x 80 cm, 16 m) is a beam, not a slab: it bends along its length and has stirrups', () => {
    expect(isMember([0.22, 0.8, 16], 'beam')).toBe(true)
    expect(memberStirrups([0.22, 0.8, 16], undefined, 'beam').length).toBeGreaterThan(0)
  })

  it('without a role the section has to be compact: a strip of slab or a low wall stays a plate', () => {
    expect(isMember([0.22, 0.8, 16])).toBe(false)
    expect(isMember([0.12, 1, 10], 'slab')).toBe(false)
    expect(isMember([0.2, 0.19, 3])).toBe(true)
  })

  it('a declared beam is one from twice its depth (NBR 6118), under that it is a wall-beam', () => {
    expect(isMember([0.14, 0.8, 2.2], 'beam')).toBe(true)
    expect(isMember([0.22, 0.8, 1.5], 'beam')).toBe(false)
  })
})
