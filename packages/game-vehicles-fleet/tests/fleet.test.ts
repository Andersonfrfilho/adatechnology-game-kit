import { describe, expect, it } from 'vitest'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import * as THREE from 'three'
import {
  agricultural,
  air,
  cars,
  createFleetPack,
  fleetGroupIds,
  fleetGroups,
  fleetPack,
  fleetVehicleIds,
  heavy,
  installFleet,
  legacyScenarioSeeds,
  legacyVehicleSeeds,
  military,
  motorcycles,
  pickups,
  scenarioIds,
  suvs,
  vans,
  water,
} from '../src'
import { fakeDocument } from './helpers/fake-dom'
import { makeFleetKit } from './helpers/kit'
import { digest } from './helpers/digest'

const GROUP_COUNTS = { motorcycles: 12, cars: 15, suvs: 4, pickups: 4, vans: 2, heavy: 5, agricultural: 1, military: 8, water: 7, air: 11 }

describe('installing the whole fleet', () => {
  const kit = makeFleetKit('en')

  it('registers the 69 vehicles without throwing, in install order', () => {
    expect(fleetVehicleIds).toHaveLength(69)
    expect(new Set(fleetVehicleIds).size).toBe(69)
    expect(kit.fleet.map((v) => v.key)).toEqual([...fleetVehicleIds])
  })

  it('has the expected number of vehicles per group', () => {
    for (const [group, count] of Object.entries(GROUP_COUNTS)) {
      expect(fleetGroups[group as keyof typeof fleetGroups], group).toHaveLength(count)
      expect(
        kit.fleet.filter((v) => v.group === group).map((v) => v.key),
        group,
      ).toEqual([...fleetGroups[group as keyof typeof fleetGroups]])
    }
    expect(Object.values(GROUP_COUNTS).reduce((a, b) => a + b, 0)).toBe(69)
  })

  it('exports one array per group', () => {
    const named = { motorcycles, cars, suvs, pickups, vans, heavy, agricultural, military, water, air }
    expect(Object.keys(named)).toEqual([...fleetGroupIds])
    for (const id of fleetGroupIds) expect(named[id]).toBe(fleetGroups[id])
  })

  it('gives every vehicle a name, a group, a fuel and a seed of the original id', () => {
    for (const v of kit.fleet) {
      expect(v.name, v.key).toBeTruthy()
      expect(v.name, v.key).not.toContain('fleet.')
      expect(fleetGroupIds as readonly string[], v.key).toContain(v.group)
      expect(kit.fuels[v.fuel as string] || ['electric', 'none'].includes(v.fuel as string), `${v.key} fuel ${v.fuel}`).toBeTruthy()
      expect(legacyVehicleSeeds[v.key], v.key).toBeTruthy()
      expect(v.seedKey, v.key).toBe(legacyVehicleSeeds[v.key])
    }
    expect(Object.keys(legacyVehicleSeeds).sort()).toEqual([...fleetVehicleIds].sort())
  })

  it('registers the groups, the water group, the fuels and the default group', () => {
    expect(kit.groups).toEqual([...fleetGroupIds])
    expect(kit.waterGroups).toEqual({ water: true })
    expect(kit.config.defaultGroup).toBe('cars')
    expect(Object.keys(kit.fuels).sort()).toEqual([
      'avgas',
      'diesel',
      'electric',
      'ethanol',
      'flex',
      'gasoline',
      'hybrid',
      'jet_fuel',
      'none',
    ])
    expect(kit.fuels.gasoline).toMatchObject({ id: 'gasoline', name: 'Gasoline', yield: '100%', shelfLife: '6 months' })
  })

  it('registers the generic scenarios and uses the front crash as the default damage', () => {
    expect(kit.scenarios.map((s) => s.id)).toEqual([...scenarioIds])
    expect(kit.config.damagedScenario).toBe('front_crash')
    for (const id of scenarioIds) expect(kit.scenarios.find((s) => s.id === id)?.seedId).toBe(legacyScenarioSeeds[id])
  })

  it('keeps the story out: no horde scenario, blood fluid or stain, no zone effects of the game', () => {
    expect(kit.scenarios.some((s) => /horde|horda/i.test(s.id))).toBe(false)
    expect(Object.keys(kit.fluidTypes)).not.toContain('blood')
    expect(kit.config.impactStain).toBeNull()
    expect(kit.config.plate).not.toMatch(/ZMB/)
    for (const key of [
      'panel',
      'door',
      'fender',
      'side_panel',
      'roof',
      'lid',
      'bumper',
      'glass',
      'windshield',
      'underbody',
      'deck',
      'aircraft_cabin',
      'exhaust',
      'cab',
    ]) {
      expect(kit.zoneEffects[key], key).toBeUndefined()
    }
    expect(kit.partEffects.glass).toBeUndefined()
    expect(kit.zoneEffects.hood).toHaveLength(5)
    expect(kit.partEffects.headlight).toBeTruthy()
  })

  it('builds a vehicle of each group in the three states', () => {
    for (const key of [
      'bicycle',
      'compact_hatch',
      'large_suv',
      'midsize_pickup',
      'cargo_van',
      'box_truck',
      'tractor',
      'battle_tank',
      'sailboat',
      'police_helicopter',
    ]) {
      for (const state of ['intact', 'damaged', 'modified'] as const) {
        const c = kit.build(key, state)
        expect(c.zones.length, `${key} ${state}`).toBeGreaterThan(0)
        expect(c.zoneErrors || [], `${key} ${state}`).toEqual([])
      }
    }
  })
})

describe('options', () => {
  it('installs only the chosen groups', () => {
    const kit = makeFleetKit('en', { groups: ['water', 'air'] })
    expect(kit.fleet.map((v) => v.key)).toEqual([...water, ...air].sort((a, b) => fleetVehicleIds.indexOf(a) - fleetVehicleIds.indexOf(b)))
    expect(kit.groups).toEqual(['water', 'air'])
    // the helpers of the water file are still available to the helicopters
    expect(digest(kit.build('police_helicopter', 'intact')).objects).toBeGreaterThan(100)
  })

  it('installs only the chosen vehicles and leaves out the excluded ones', () => {
    const kit = makeFleetKit('en', { vehicles: ['bicycle', 'taxi', 'tractor', 'sailboat'], exclude: ['taxi'] })
    expect(kit.fleet.map((v) => v.key)).toEqual(['bicycle', 'tractor', 'sailboat'])
  })

  it('skips the scenarios on request', () => {
    const kit = makeFleetKit('en', { groups: ['cars'], scenarios: false })
    expect(kit.scenarios).toHaveLength(0)
    expect(kit.config.damagedScenario).toBeNull()
  })

  it('looks the same whichever vehicles are installed', () => {
    const full = makeFleetKit('en')
    const part = makeFleetKit('en', { vehicles: ['tractor'] })
    expect(digest(part.build('tractor', 'damaged'))).toEqual(digest(full.build('tractor', 'damaged')))
  })

  it('works as a plugin and through installFleet', () => {
    const a = createVehicleKit({ THREE, document: fakeDocument, locale: 'en' })
    a.plugin(fleetPack)
    const b = createVehicleKit({ THREE, document: fakeDocument, locale: 'en' })
    installFleet(b, { groups: ['agricultural'] })
    const c = createVehicleKit({ THREE, document: fakeDocument, locale: 'en' })
    c.plugin(createFleetPack({ groups: ['vans'] }))
    expect(a.plugins).toEqual(['game-vehicles-fleet'])
    expect(a.fleet).toHaveLength(69)
    expect(b.fleet.map((v) => v.key)).toEqual(['tractor'])
    expect(c.fleet.map((v) => v.key)).toEqual(['cargo_van', 'ambulance'])
  })
})
