import { MATERIALS } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'
import { TERRAIN_MATERIALS, TERRAIN_PROFILES } from '../src'

describe('the ground catalogue', () => {
  it('every ground material is a material of the destruction catalogue', () => {
    const known = new Set(MATERIALS.map((material) => material.id))
    for (const material of TERRAIN_MATERIALS) expect(known.has(material.id), material.id).toBe(true)
    for (const profile of TERRAIN_PROFILES) for (const stratum of profile.strata) if (stratum.reinforcement) expect(known.has(stratum.reinforcement.material)).toBe(true)
  })

  it('a round thing rolls on the top of every outdoor ground by its own rolling resistance: soft ground holds it back far more than a hard one', () => {
    const rolling = (id: string): number => TERRAIN_MATERIALS.find((material) => material.id === id)?.rolling ?? Number.NaN
    // the top of every outdoor profile says it (indoor floors keep the host's default)
    for (const id of ['lawn', 'dirt', 'sand', 'road', 'concrete_slab', 'stone_paving', 'mud', 'gravel_bed', 'dry_clay', 'snow', 'cobblestone']) {
      const top = TERRAIN_PROFILES.find((profile) => profile.id === id)?.strata[0]?.material ?? ''
      expect(rolling(top), id).toBeGreaterThan(0)
    }
    // hard: the 0.015 the kit always had; soft: a tyre table's high end (a small rigid roller sinks deeper)
    expect(rolling('asphalt')).toBe(0.015)
    expect(rolling('concrete')).toBe(0.015)
    for (const soft of ['turf', 'soil', 'gravel', 'clay']) expect(rolling(soft), soft).toBeGreaterThanOrEqual(0.05)
    for (const loose of ['sand', 'mud']) expect(rolling(loose), loose).toBeGreaterThanOrEqual(0.2)
  })
})
