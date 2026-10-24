import { describe, expect, it } from 'vitest'

import { UNDEAD_TYPES, undeadCrowdPack } from '../src'

describe('undeadCrowdPack', () => {
  it('lists the 13 types in the catalog order, with the game horde numbers', () => {
    const pack = undeadCrowdPack()
    expect(pack.types.map((type) => type.id)).toEqual(UNDEAD_TYPES.map((type) => type.id))
    expect(pack.types.find((type) => type.id === 'blind')?.speed.chase).toBe(3)
    expect(pack.types.find((type) => type.id === 'drowned')?.weight).toBe(0)
    expect(pack.ages.map((age) => age.p)).toEqual([0.8, 0.15, 0.04, 0.01])
    expect(pack.segments).toEqual({ head: 40, arm: 60, leg: 80 })
  })

  it('hands out a fresh copy each call', () => {
    const a = undeadCrowdPack()
    a.types[0]!.health = 1
    expect(undeadCrowdPack().types[0]!.health).toBe(100)
  })
})
