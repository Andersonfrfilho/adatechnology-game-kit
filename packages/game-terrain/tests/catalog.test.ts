import { MATERIALS } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'
import { TERRAIN_MATERIALS, TERRAIN_PROFILES } from '../src'

describe('the ground catalogue', () => {
  it('every ground material is a material of the destruction catalogue', () => {
    const known = new Set(MATERIALS.map((material) => material.id))
    for (const material of TERRAIN_MATERIALS) expect(known.has(material.id), material.id).toBe(true)
    for (const profile of TERRAIN_PROFILES) for (const stratum of profile.strata) if (stratum.reinforcement) expect(known.has(stratum.reinforcement.material)).toBe(true)
  })
})
