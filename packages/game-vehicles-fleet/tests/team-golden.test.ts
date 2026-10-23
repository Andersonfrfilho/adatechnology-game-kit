import { describe, expect, it } from 'vitest'
import { legacyZoneId } from '@adatechnology/game-vehicles'
import { assertMatchesGolden, createEventRecorder, createGoldenRecord, diffGolden, withDeterminism } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { legacyVehicleSeeds } from '../src'
import civicGolden from './fixtures/team-golden/garage-civico.json'
import hatchGolden from './fixtures/team-golden/garage-hatch.json'
import popularGolden from './fixtures/team-golden/garage-popular.json'
import sedaGolden from './fixtures/team-golden/garage-seda.json'
import { makeFleetKit } from './helpers/kit'

const STATES = ['intact', 'damaged', 'modified'] as const
const SCENARIOS = ['front_crash', 'rollover'] as const

/** The SDK side of tools/golden/captures/vehicle-garage.js: same states, same scenarios, same seed. */
function recordSdkVehicle(vehicleKey: string, seed: number): GoldenRecord {
  return withDeterminism({ seed }, () => {
    const kit = makeFleetKit('pt-BR')
    const recorder = createEventRecorder()
    const scenes = Object.fromEntries(STATES.map((state) => [state, kit.build(vehicleKey, state).root]))
    const vehicle = kit.build(vehicleKey, 'intact')
    for (const id of SCENARIOS) {
      const result = kit.zoneScenario(vehicle, id)
      const flags = Object.keys(result.flags).filter((flag) => result.flags[flag]).sort()
      const health: Record<string, number> = {}
      for (const zone of vehicle.zones) if (result.health[zone.id] != null) health[legacyZoneId(zone)] = result.health[zone.id]
      recorder.record('scenario', { id, flags, health })
    }
    return createGoldenRecord({ name: `garage-${legacyVehicleSeeds[vehicleKey]}`, seed, events: recorder.events(), scenes })
  })
}

describe('team golden: Garagem artifact', () => {
  const golden = hatchGolden as unknown as GoldenRecord

  it('builds compact_hatch with the same scene hash as the page, in every state', () => {
    const sdk = recordSdkVehicle('compact_hatch', golden.seed)
    expect(diffGolden({ ...golden, events: [] }, { ...sdk, events: [] })).toEqual([])
  })

  it('breaks compact_hatch with the same events as the page', () => {
    const sdk = recordSdkVehicle('compact_hatch', golden.seed)
    assertMatchesGolden({ ...golden, scenes: {} }, { ...sdk, scenes: {} })
  })

  it('reports a readable diff when the build differs', () => {
    const sdk = recordSdkVehicle('midsize_sedan', golden.seed)
    expect(() => assertMatchesGolden(golden, { ...sdk, name: golden.name })).toThrow(/differs from the golden[\s\S]*node #/)
  })
})

describe('team golden: Garagem artifact, the other cars of V1', () => {
  const cases: Array<[string, GoldenRecord]> = [
    ['midsize_sedan', sedaGolden as unknown as GoldenRecord],
    ['entry_hatch', popularGolden as unknown as GoldenRecord],
    ['fastback_sedan', civicGolden as unknown as GoldenRecord],
  ]
  it.each(cases)('%s matches the page in every state and scenario', (vehicleKey, golden) => {
    assertMatchesGolden(golden, recordSdkVehicle(vehicleKey, golden.seed))
  })
})
