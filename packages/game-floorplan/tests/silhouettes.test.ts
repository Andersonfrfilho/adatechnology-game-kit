import { installPortableMath, snapshotScene } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import goldenFile from './fixtures/team-golden/gallery-silhouettes.json'
import { buildSilhouetteScene } from './silhouette-scene'
import {
  createChalet,
  createCityBuilding,
  createColonialHouse,
  createCompanyHouse,
  createDetachedHouse,
  createFarmhouse,
  createSlabHouse,
  createStiltHouse,
  createTwoStoreyHouse,
} from '../src/silhouettes'
import type { Silhouette } from '../src/silhouettes'

/** The 16 cases of the gallery capture (tools/golden/captures/gallery-silhouettes.js), each drawn from the page's rng(7). */
const CASES: Record<string, () => Silhouette> = {
  sobrado: () => createTwoStoreyHouse({ x: 0, z: 0, width: 8, depth: 9, color: 0xc8bca8, roofColor: 0x5a3a2a, ry: 0 }),
  sobrado_rotated: () => createTwoStoreyHouse({ x: 3, z: -2, width: 7, depth: 8, color: 0xb0a48c, ry: 0.6 }),
  laje_1: () => createSlabHouse({ x: 0, z: 0, width: 7, depth: 8, floors: 1, color: 0xa8a49c }),
  laje_2: () => createSlabHouse({ x: 0, z: 0, width: 7, depth: 8, floors: 2, color: 0xa8a49c }),
  laje_3: () => createSlabHouse({ x: 0, z: 0, width: 7, depth: 8, floors: 3, color: 0xa8a49c }),
  colonial: () => createColonialHouse({ x: 0, z: 0, width: 7, color: 0xd0c4a8, hasDoor: false }),
  colonial_door: () => createColonialHouse({ x: 0, z: 0, width: 9, color: 0xd0c4a8, hasDoor: true }),
  chalet: () => createChalet({ x: 0, z: 0, ry: 0 }),
  chalet_rotated: () => createChalet({ x: 2, z: 5, color: 0x7a5a3a, ry: 1.2 }),
  company_house: () => createCompanyHouse({ x: 0, z: 0 }),
  stilt: () => createStiltHouse({ x: 0, z: 0 }),
  farmhouse: () => createFarmhouse({ x: 0, z: 0 }),
  house: () => createDetachedHouse({ x: 0, z: 0, width: 7, depth: 8, color: 0xc8b898, roofColor: 0x5a3a2a, ry: 0 }),
  house_boarded: () => createDetachedHouse({ x: 0, z: 0, width: 7, depth: 8, color: 0xc8b898, roofColor: 0x5a3a2a, ry: 0, isBoarded: true }),
  building: () => createCityBuilding({ x: 0, z: 0, width: 12, depth: 14, height: 20, color: 0x8a8a86 }),
  building_shop: () => createCityBuilding({ x: 0, z: 0, width: 12, depth: 14, height: 20, color: 0x8a8a86, shopChance: 1, litChance: 0.2 }),
}

const scenes = (goldenFile as unknown as GoldenRecord).scenes

describe('far-away silhouettes against the Galeria do Vale Cinzento', () => {
  let restoreMath: () => void
  beforeAll(() => {
    restoreMath = installPortableMath()
  })
  afterAll(() => restoreMath())

  it('covers every case the capture recorded', () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(scenes).sort())
  })

  for (const [label, build] of Object.entries(CASES)) {
    it(`${label}: the scene has the team's hash`, () => {
      const expected = scenes[label]
      const got = snapshotScene(buildSilhouetteScene(build()))
      expect(got.lines).toEqual(expected?.lines)
      expect(got.hash).toBe(expected?.hash)
    })
  }

  it('is deterministic: the same seed draws the same windows', () => {
    expect(createCityBuilding({ x: 0, z: 0, width: 12, depth: 14, height: 20, color: 0x8a8a86, seed: 3 })).toEqual(createCityBuilding({ x: 0, z: 0, width: 12, depth: 14, height: 20, color: 0x8a8a86, seed: 3 }))
  })

  it('a company-house fence moves with the house (the page leaves it at the origin)', () => {
    const moved = createCompanyHouse({ x: 10, z: 4 })
    const fencePost = moved.parts.find((part) => part.shape === 'cylinder' && part.radiusTop === 0.05)
    expect(fencePost?.parent).toBeGreaterThanOrEqual(0)
  })

  it('a city building lists its window instances, lit ones by the chance given', () => {
    const lit = createCityBuilding({ x: 0, z: 0, width: 12, depth: 14, height: 20, color: 0x8a8a86, litChance: 1 })
    expect(lit.windows.length).toBeGreaterThan(0)
    expect(lit.windows.every((window) => window.isLit)).toBe(true)
  })
})
