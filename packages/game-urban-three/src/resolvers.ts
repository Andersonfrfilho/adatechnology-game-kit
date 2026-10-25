import { generate } from '@adatechnology/game-vegetation'
import type { Condition, Lod, Season } from '@adatechnology/game-vegetation'
import { createPlantObject, createVegetationMaterials } from '@adatechnology/game-vegetation/three'
import { toSpec } from '@adatechnology/game-vegetation-species'
import type { BuildVehicleOptions } from '@adatechnology/game-vehicles-three'
import type { PlacementPart } from '@adatechnology/game-urban'

type Three = any

/** Makes the object of a placement; null when it cannot (an unknown id). The drawer clones it for each spot. */
export type PlacementResolver = ((part: PlacementPart) => any | null) & { dispose?: () => void }

const cssColor = (value: number): string => `#${value.toString(16).padStart(6, '0')}`

export type VehicleResolverOptions = {
  /** `lite` fuses a vehicle into six meshes, the right cost for a street of parked cars. Default `lite`. */
  quality?: BuildVehicleOptions['quality']
}

/** What the vehicle resolver needs of `createVehiclesThree`. */
export type VehicleBuilder = { build(key: string, options?: BuildVehicleOptions): { group: any; dispose(): void } }

/**
 * Resolves vehicle placements with the vehicles of `game-vehicles-three`. A vehicle is built once for each id and paint and cloned
 * (clones share geometry and materials) for each spot.
 */
export function createVehicleResolver(vehicles: VehicleBuilder, options: VehicleResolverOptions = {}): PlacementResolver {
  const quality = options.quality ?? 'lite'
  const built = new Map<string, { group: any; dispose(): void } | null>()
  const resolve: PlacementResolver = (part) => {
    const key = `${part.id}|${part.color ?? ''}|${part.seed}`
    if (!built.has(key)) {
      try {
        built.set(key, vehicles.build(part.id, { quality, ...(part.color === undefined ? { seed: part.seed } : { color: cssColor(part.color) }) }))
      } catch {
        built.set(key, null)
      }
    }
    return built.get(key)?.group.clone() ?? null
  }
  resolve.dispose = () => {
    for (const entry of built.values()) entry?.dispose()
    built.clear()
  }
  return resolve
}

export type PlantResolverOptions = {
  /** Level of detail of the plants of a street. Default 1. */
  lod?: Lod
  condition?: Condition
  season?: Season
  /** Materials of the plants (wind included); default new ones. */
  materials?: ReturnType<typeof createVegetationMaterials>
}

/** Resolves plant placements with the species of `game-vegetation-species`, built with `game-vegetation`. One plant for each species and seed, cloned for each spot. */
export function createPlantResolver(THREE: Three, options: PlantResolverOptions = {}): PlacementResolver {
  const materials = options.materials ?? createVegetationMaterials(THREE)
  const made = new Map<string, any | null>()
  const resolve: PlacementResolver = (part) => {
    const key = `${part.id}|${part.seed}`
    if (!made.has(key)) {
      try {
        const mesh = generate(toSpec(part.id), { seed: part.seed, lod: options.lod ?? 1, condition: options.condition ?? 'healthy', season: options.season ?? 'spring', species: part.id })
        made.set(key, createPlantObject(THREE, mesh, materials))
      } catch {
        made.set(key, null)
      }
    }
    return made.get(key)?.clone() ?? null
  }
  resolve.dispose = () => {
    for (const object of made.values()) {
      object?.traverse((o: any) => o.geometry?.dispose?.())
    }
    made.clear()
  }
  return resolve
}
