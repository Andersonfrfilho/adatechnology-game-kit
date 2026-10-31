// Every call below is written the way a consumer wrote it at e600f1f6, before the by-option parameters of phases 2 and 3 (spec 005, D2).
// They must keep typechecking and keep their output: `tests/compat.test.ts` compares each with the by-option path the preset takes.
import { createSheet, createStoriesTestModule, createStoryWorld, drawSheet, simulateStories } from '@adatechnology/game-stories'
import { createPlantProvider, createVehicleProvider, PARKED_VEHICLE_IDS } from '@adatechnology/game-urban'
import { createPlantResolver, createUrbanTestModule } from '@adatechnology/game-urban-three'
import { createVegetationTestModule } from '@adatechnology/game-vegetation-three'
import { createVehiclesThree, createVehiclesTestModule } from '@adatechnology/game-vehicles-three'
import { furnitureSpec } from '@adatechnology/game-floorplan-three'
import { createPlayerAvatar, toRoomAvatar } from '@adatechnology/game-characters-three'
import { buildItemWeaponModel, buildWeaponModel, itemModelOfWeapon } from '@adatechnology/game-weapons-three'
import type { VehicleKit } from '@adatechnology/game-vehicles'
import { regions } from '@adatechnology/game-vegetation-species'

type Three = Parameters<typeof createPlayerAvatar>[0]

export const legacyUrban = {
  vehicleProvider: () => createVehicleProvider(),
  vehicleProviderWithIds: () => createVehicleProvider({ ids: ['taxi'] }),
  plantProvider: () => createPlantProvider(),
  plantProviderWithRegion: () => createPlantProvider({ region: regions.br, seed: 2 }),
  parkedVehicleIds: PARKED_VEHICLE_IDS,
}

export const legacyStories = {
  world: (seed: number) => createStoryWorld({ seed }),
  simulate: (days: number) => simulateStories(days),
  sheet: () => createSheet({ profession: 'nurse' }),
  emptySheet: () => createSheet(),
  drawn: (random: () => number) => drawSheet(random),
  testModule: () => createStoriesTestModule(),
  testModuleEnglish: () => createStoriesTestModule({ locale: 'en', seed: 4 }),
}

export const legacyAdapters = {
  furniture: (THREE: Three, document: unknown) => furnitureSpec(THREE, 'bookcase', { document }),
  vehicles: (THREE: Three, kit: VehicleKit) => createVehiclesThree(THREE, { kit }),
  vehiclesTestModule: () => createVehiclesTestModule(),
  plantResolver: (THREE: Three) => createPlantResolver(THREE),
  urbanTestModule: () => createUrbanTestModule(),
  vegetationTestModule: () => createVegetationTestModule(),
  roomAvatar: (THREE: Three) => toRoomAvatar(createPlayerAvatar(THREE)),
  roomAvatarWithArms: (THREE: Three) => toRoomAvatar(createPlayerAvatar(THREE), { firstPerson: {} }),
}

export const legacyWeapons = {
  itemModelOf: (weaponId: string) => itemModelOfWeapon(weaponId),
  itemWeapon: (THREE: Parameters<typeof buildItemWeaponModel>[0], id: string) => buildItemWeaponModel(THREE, { id }),
  weapon: (THREE: Parameters<typeof buildWeaponModel>[0], id: string) => buildWeaponModel(THREE, { id, category: 'melee_blade', mass: 1 }),
}
