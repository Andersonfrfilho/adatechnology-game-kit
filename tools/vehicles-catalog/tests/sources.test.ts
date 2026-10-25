import { fleetVehicleIds, legacyVehicleSeeds } from '@adatechnology/game-vehicles-fleet'
import { describe, expect, it } from 'vitest'

import { buildCatalog } from '../src/build'
import { extractCards, extractLightFleet, extractRegisters, garageArtifactScripts, garageSiteScripts } from '../src/extract'
import { OUTPUT_PATHS } from '../src/paths'

describe('team sources', () => {
  it('has 69 vehicles in the Frota Leve DIMS, the Frota cards and the Garagem registers', () => {
    expect(extractLightFleet().dims).toHaveLength(69)
    expect(extractCards()).toHaveLength(69)
    expect(extractRegisters()).toHaveLength(69)
  })

  it('maps every SDK vehicle to a page key that the Garagem registers and DIMS lists', () => {
    const keys = new Set(extractRegisters().map((entry) => entry.key))
    const dims = new Set(extractLightFleet().dims.map((entry) => entry.k))
    for (const id of fleetVehicleIds) {
      expect(keys.has(legacyVehicleSeeds[id] as string), id).toBe(true)
      expect(dims.has(legacyVehicleSeeds[id] as string), id).toBe(true)
    }
  })

  it('reads the palettes: 13 civil colours and 5 military', () => {
    const light = extractLightFleet()
    expect(light.palette).toHaveLength(13)
    expect(light.militaryPalette).toHaveLength(5)
  })

  it('finds the same scripts, in the same order, in the artifact and in the site page', () => {
    const artifact = garageArtifactScripts()
    const site = garageSiteScripts()
    expect(artifact).toHaveLength(13)
    expect(site).toHaveLength(13)
  })

  it('writes dims, paint, stats and cards for every vehicle', () => {
    const files = buildCatalog()
    for (const path of Object.values(OUTPUT_PATHS)) expect(files[path], path).toBeTruthy()
    const stats = JSON.parse(files[OUTPUT_PATHS.stats] as string) as Record<string, { speed: number }>
    expect(Object.keys(stats)).toEqual([...fleetVehicleIds])
  })
})
