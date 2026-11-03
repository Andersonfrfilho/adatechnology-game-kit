import { cars, pickups, suvs, vans } from '@adatechnology/game-vehicles-fleet'
import { pickForContext, regions } from '@adatechnology/game-vegetation-species'
import type { Region } from '@adatechnology/game-vegetation-species'
import { createPlantProvider as createUrbanPlantProvider, createVehicleProvider as createUrbanVehicleProvider } from '@adatechnology/game-urban'
import type { PlantProvider, PlantProviderOptions, VehicleProvider, VehicleProviderOptions } from '@adatechnology/game-urban'

/** The vehicles of the fleet that park on a street: cars, SUVs, pickups and vans. */
export const PARKED_VEHICLE_IDS: readonly string[] = /* @__PURE__ */ (() => [...cars, ...suvs, ...pickups.filter((id) => id !== 'monster_truck'), ...vans])()

export type DefaultVehicleProviderOptions = Partial<VehicleProviderOptions>
export type DefaultPlantProviderOptions = Partial<Omit<PlantProviderOptions, 'pickSpecies'>> & {
  /** Planting table of a region. Default Brazil's. */
  region?: Region
  /** Replaces the choice made with the region's table. */
  pickSpecies?: PlantProviderOptions['pickSpecies']
}

/** A vehicle provider that parks the fleet of `game-vehicles-fleet` (`PARKED_VEHICLE_IDS` by default); the options are those of `createVehicleProvider` of `game-urban`. */
export function createVehicleProvider(options: DefaultVehicleProviderOptions = {}): VehicleProvider {
  return createUrbanVehicleProvider({ ids: PARKED_VEHICLE_IDS, ...options })
}

/** The choice of a species by a context of the region's table, the way `createPlantProvider` of `game-urban` takes it (`pickSpecies`). */
export function defaultPlantPicker(region: Region = regions.br): PlantProviderOptions['pickSpecies'] {
  return (context, key) => pickForContext(region, context, key)
}

/** A plant provider that plants the species of `game-vegetation-species` from the region's table (Brazil's by default). */
export function createPlantProvider(options: DefaultPlantProviderOptions = {}): PlantProvider {
  const { region, pickSpecies, ...rest } = options
  return createUrbanPlantProvider({ ...rest, pickSpecies: pickSpecies ?? defaultPlantPicker(region) })
}

/** The providers a game that wants the kit's own fleet and plants hands to `compose` of the neighbourhoods: `{ vehicle, plant }`. */
export function defaultUrbanProviders(options: { vehicle?: DefaultVehicleProviderOptions; plant?: DefaultPlantProviderOptions } = {}): { vehicle: VehicleProvider; plant: PlantProvider } {
  return { vehicle: createVehicleProvider(options.vehicle), plant: createPlantProvider(options.plant) }
}
