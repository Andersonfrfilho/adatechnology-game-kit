import { createStoryWorld, simulateStories } from '@adatechnology/game-stories'
import { createUrban } from '@adatechnology/game-urban'
import type { PlacementPart } from '@adatechnology/game-urban'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { fleetVehicleIds, installFleet } from '@adatechnology/game-vehicles-fleet'
import { buildItemWeaponModel, buildWeaponModel, itemModelOfWeapon } from '@adatechnology/game-weapons-three'
import { itemModels } from '@adatechnology/game-items-three'
import { createFirstPersonArms } from '@adatechnology/game-characters-three'
import {
  createPlantProvider as presetPlantProvider,
  createVehicleProvider as presetVehicleProvider,
  defaultCharacterClips,
  defaultFurnitureCatalog,
  defaultPlantSpec,
  defaultStoryContent,
  defaultUrbanProviders,
  defaultVegetationSpecies,
  defaultVehicleFleet,
  PARKED_VEHICLE_IDS as PRESET_PARKED_VEHICLE_IDS,
} from '@adatechnology/game-kit-defaults'
import { furnitureSpec } from '@adatechnology/game-floorplan-three'
import { createPlantResolver } from '@adatechnology/game-urban-three'
import { createVehiclesThree as createPresetVehicles } from '@adatechnology/game-vehicles-three'
import { toRoomAvatar, createPlayerAvatar } from '@adatechnology/game-characters-three'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { legacyAdapters, legacyStories, legacyUrban, legacyWeapons } from '../src/legacy-calls'
import { fakeDocument } from './fake-dom'

const placements = (parts: readonly { shape: string }[], kind: PlacementPart['kind']): unknown[] =>
  parts.filter((part) => part.shape === 'placement' && (part as PlacementPart).kind === kind)

describe('game-urban providers, called as before', () => {
  const kit = createUrban()

  it('park the same cars and plant the same species as the preset', () => {
    const old = kit.builder({ seed: 7 })
    kit.neighbourhoods.get('downtown').compose(old, { x: 0, z: 0 }, { providers: { vehicle: legacyUrban.vehicleProvider() } })
    const fresh = kit.builder({ seed: 7 })
    kit.neighbourhoods.get('downtown').compose(fresh, { x: 0, z: 0 }, { providers: { vehicle: presetVehicleProvider() } })
    expect(placements(old.parts, 'vehicle')).toEqual(placements(fresh.parts, 'vehicle'))
    expect(placements(old.parts, 'vehicle').length).toBeGreaterThan(0)

    for (const [name, provider, preset] of [
      ['mountain_resort', legacyUrban.plantProvider(), presetPlantProvider()],
      ['mountain_resort', legacyUrban.plantProviderWithRegion(), presetPlantProvider({ seed: 2 })],
    ] as const) {
      const a = kit.builder({ seed: 7 })
      kit.neighbourhoods.get(name).compose(a, { x: 0, z: 0 }, { providers: { plant: provider } })
      const b = kit.builder({ seed: 7 })
      kit.neighbourhoods.get(name).compose(b, { x: 0, z: 0 }, { providers: { plant: preset } })
      expect(placements(a.parts, 'plant')).toEqual(placements(b.parts, 'plant'))
      expect(placements(a.parts, 'plant').length).toBeGreaterThan(0)
    }
    const both = defaultUrbanProviders()
    expect(both.vehicle).toBeTypeOf('function')
  })

  it('keep PARKED_VEHICLE_IDS and the ids option', () => {
    expect([...legacyUrban.parkedVehicleIds]).toEqual([...PRESET_PARKED_VEHICLE_IDS])
    const b = kit.builder({ seed: 7 })
    kit.neighbourhoods.get('downtown').compose(b, { x: 0, z: 0 }, { providers: { vehicle: legacyUrban.vehicleProviderWithIds() } })
    expect(new Set((placements(b.parts, 'vehicle') as PlacementPart[]).map((car) => car.id))).toEqual(new Set(['taxi']))
  })
})

describe('game-stories, called as before', () => {
  const content = defaultStoryContent('pt-BR')

  it('runs a world with no names and no ruleset, the same as the preset', () => {
    const old = legacyStories.world(3)
    old.runTo(5)
    const fresh = createStoryWorld({ names: content.names, ruleset: content.ruleset, seed: 3 })
    fresh.runTo(5)
    expect(JSON.stringify(old.people())).toBe(JSON.stringify(fresh.people()))
    expect(JSON.stringify(old.chronicle)).toBe(JSON.stringify(fresh.chronicle))
    const sim = legacyStories.simulate(4)
    const simFresh = simulateStories(4, { names: content.names, ruleset: content.ruleset })
    expect(JSON.stringify(sim.people())).toBe(JSON.stringify(simFresh.people()))
  })

  it('makes sheets with no ruleset', () => {
    expect(legacyStories.sheet().pool()).toBe(12)
    expect(legacyStories.emptySheet().valid()).toBe(true)
    let n = 0
    const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280)
    expect(legacyStories.drawn(random).valid()).toBe(true)
  })

  it('builds its test module with no options', () => {
    expect(legacyStories.testModule().id).toBe(legacyStories.testModuleEnglish().id)
  })
})

describe('the adapters, called as before', () => {
  it('furnitureSpec reads the size from the residential catalogue', () => {
    const old = legacyAdapters.furniture(THREE, fakeDocument)
    const fresh = furnitureSpec(THREE, 'bookcase', { document: fakeDocument, catalog: defaultFurnitureCatalog() })
    expect(old.size).toEqual({ w: 1.2, d: 0.35, h: 2 })
    expect(JSON.stringify(old.spec)).toBe(JSON.stringify(fresh.spec))
  })

  it('createVehiclesThree builds with the fleet of the pack', () => {
    const kit = createVehicleKit({ THREE, document: fakeDocument })
    installFleet(kit)
    const old = legacyAdapters.vehicles(THREE, kit)
    const fresh = createPresetVehicles(THREE, { kit, fleet: defaultVehicleFleet() })
    const id = fleetVehicleIds[0] as string
    const a = old.build(id, { quality: 'lite', seed: 3 })
    const b = fresh.build(id, { quality: 'lite', seed: 3 })
    expect([a.color, a.length, a.width, a.height]).toEqual([b.color, b.length, b.width, b.height])
    expect(a.expected).toEqual(b.expected)
    a.dispose()
    b.dispose()
  })

  it('createPlantResolver resolves with the species pack', () => {
    const part = { shape: 'placement', kind: 'plant', id: defaultVegetationSpecies().listIds()[0], x: 0, z: 0, seed: 's' } as never
    const resolverOld = legacyAdapters.plantResolver(THREE)
    const resolverNew = createPlantResolver(THREE, { toSpec: defaultPlantSpec })
    const sizeOf = (object: unknown): number[] => {
      const box = new THREE.Box3().setFromObject(object as THREE.Object3D)
      return box.getSize(new THREE.Vector3()).toArray()
    }
    expect(resolverOld(part)).not.toBeNull()
    expect(sizeOf(resolverOld(part))).toEqual(sizeOf(resolverNew(part)))
  })

  it('the test modules take no options', () => {
    expect(legacyAdapters.vehiclesTestModule().id).toBeTruthy()
    expect(legacyAdapters.urbanTestModule().id).toBeTruthy()
    expect(legacyAdapters.vegetationTestModule().id).toBeTruthy()
  })

  it('toRoomAvatar strikes with the clips of the people pack', () => {
    const old = legacyAdapters.roomAvatar(THREE)
    const fresh = toRoomAvatar(createPlayerAvatar(THREE), { ...defaultCharacterClips() })
    const clip = defaultCharacterClips().strikeClips.find((candidate) => candidate.events?.some((event) => event.type === 'impact'))!
    expect(old.strike(clip.id)).toBe(fresh.strike(clip.id))
    expect(old.strike(clip.id)).not.toBeNull()
    expect(old.arms).toBeNull()
    const withArms = legacyAdapters.roomAvatarWithArms(THREE)
    expect(withArms.arms).not.toBeNull()
    expect(createFirstPersonArms).toBeTypeOf('function')
  })
})

describe('game-weapons-three, called as before', () => {
  it('draws the weapons the gallery did not model with the item models, with no `items`', () => {
    expect(legacyWeapons.itemModelOf('wrench')).toBe(itemModelOfWeapon('wrench', itemModels))
    expect(legacyWeapons.itemModelOf('wrench')).toBe('adjustable_wrench')
    const size = (object: THREE.Object3D | undefined): number[] => new THREE.Box3().setFromObject(object!).getSize(new THREE.Vector3()).toArray()
    expect(size(legacyWeapons.itemWeapon(THREE, 'baseball_bat'))).toEqual(size(buildItemWeaponModel(THREE, { id: 'baseball_bat' }, itemModels)))
    expect(size(legacyWeapons.weapon(THREE, 'axe'))).toEqual(size(buildWeaponModel(THREE, { id: 'axe', category: 'melee_blade', mass: 1 }, itemModels)))
  })
})

