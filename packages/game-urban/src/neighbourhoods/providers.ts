import { cars, pickups, suvs, vans } from '@adatechnology/game-vehicles-fleet'
import { pickForContext, regions } from '@adatechnology/game-vegetation-species'
import type { Region } from '@adatechnology/game-vegetation-species'

import type { PlantProvider, PlantRequest, VehicleProvider, VehicleRequest } from './types'

/**
 * The vehicles of the fleet that park on a street: cars, SUVs, pickups and vans.
 * @deprecated the fleet is content: pass `ids` to `createVehicleProvider` (`PARKED_VEHICLE_IDS` of `@adatechnology/game-kit-defaults` is the same list). The default is removed in the next major.
 */
export const PARKED_VEHICLE_IDS: readonly string[] = [...cars, ...suvs, ...pickups.filter((id) => id !== 'monster_truck'), ...vans]

export type VehicleProviderOptions = {
  /** Ids of the fleet to choose from. Default `PARKED_VEHICLE_IDS`, which is deprecated: pass the ids (`game-kit-defaults` has the same list). */
  ids?: readonly string[]
  /** Replaces the choice: the id for a request. The default picks by the spot, so the same pattern parks the same cars every time. */
  pick?: (request: VehicleRequest, ids: readonly string[]) => string
  /** Paint of the car. Default the colour the pattern asks for. */
  paint?: (request: VehicleRequest) => number | undefined
}

const hashSpot = (x: number, z: number, ry: number): number => {
  let h = 2166136261
  for (const value of [Math.round(x * 100), Math.round(z * 100), Math.round(ry * 100)]) {
    h ^= value & 0xffff
    h = Math.imul(h, 16777619)
    h ^= (value >> 16) & 0xffff
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * A vehicle provider that asks the drawer for a vehicle of the fleet where the pattern parks one. It chooses by the spot and not
 * by the scene's random, so the scene's draw order (and the golden of the Galeria, which parks nothing) does not move.
 */
export function createVehicleProvider(options: VehicleProviderOptions = {}): VehicleProvider {
  const ids = options.ids ?? PARKED_VEHICLE_IDS
  if (ids.length === 0) throw new Error('The vehicle provider needs at least one vehicle id')
  return (request, b) => {
    const id = options.pick ? options.pick(request, ids) : (ids[hashSpot(request.x, request.z, request.ry) % ids.length] as string)
    const color = options.paint ? options.paint(request) : request.color
    b.place('vehicle', id, request.x, request.z, { ry: request.ry, ...(color === undefined ? {} : { color }), seed: `${id}:${request.x}:${request.z}` })
  }
}

export type PlantProviderOptions = {
  /** Chooses the species id for a context of the planting table and a key (`defaultPlantPicker` of `game-kit-defaults`, or the game's own). Without it the species come from the `region` table (deprecated default). */
  pickSpecies?: (context: string, key: string) => string
  /**
   * Planting table of a region, used only when `pickSpecies` is absent. Default Brazil's.
   * @deprecated pass `pickSpecies`; the default is removed in the next major.
   */
  region?: Region
  /** Context of the table for each kind the patterns plant. */
  contexts?: Partial<Record<PlantRequest['kind'], string>>
  /** Seed of the choice; the spot is added so each place gets its own species. */
  seed?: number | string
  /** Replaces the choice: the species id for a request. */
  pick?: (request: PlantRequest, context: string, seed: string) => string
}

export const DEFAULT_PLANT_CONTEXTS: Readonly<Record<PlantRequest['kind'], string>> = { tree: 'sidewalk_tree', pine: 'square' }

/** A plant provider that asks the drawer for a species chosen by `pickSpecies`, from the table of the context for the kind (a tree on the sidewalk, a pine in the square). */
export function createPlantProvider(options: PlantProviderOptions = {}): PlantProvider {
  const region = options.region ?? regions.br
  const contexts = { ...DEFAULT_PLANT_CONTEXTS, ...options.contexts }
  const seed = options.seed ?? 1
  return (request, b) => {
    const context = contexts[request.kind]
    const key = `${seed}:${request.kind}:${request.x}:${request.z}`
    const id = options.pick ? options.pick(request, context, key) : (options.pickSpecies ?? ((table: string, spot: string) => pickForContext(region, table, spot)))(context, key)
    b.place('plant', id, request.x, request.z, { scale: request.scale, seed: key })
  }
}
