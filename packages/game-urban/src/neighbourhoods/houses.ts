import { createChalet, createColonialHouse, createCompanyHouse, createDetachedHouse, createFarmhouse, createSlabHouse, createStiltHouse, createTwoStoreyHouse } from '@adatechnology/game-floorplan'

import type { HouseProvider, HouseRequest, SilhouetteFactory } from './types'
import type { Silhouette } from '../types'

const DEFAULT_WIDTH = 8
const DEFAULT_DEPTH = 10
const DEFAULT_COLOR = 0xc8b898

/** Turns the group a silhouette starts with (the page turns a colonial or company house after drawing it). */
function turned(silhouette: Silhouette, ry: number | undefined): Silhouette {
  const first = silhouette.parts[0]
  if (ry === undefined || !first || first.shape !== 'group') return silhouette
  return { ...silhouette, parts: [{ ...first, ry }, ...silhouette.parts.slice(1)] }
}

/** The far-away silhouettes of game-floorplan as the typologies of the default house provider. */
export const SILHOUETTE_TYPOLOGIES: Readonly<Record<string, SilhouetteFactory>> = {
  two_storey: (r, random) => createTwoStoreyHouse({ x: r.x, z: r.z, width: r.width ?? DEFAULT_WIDTH, depth: r.depth ?? DEFAULT_DEPTH, color: r.color ?? DEFAULT_COLOR, roofColor: r.roofColor, ry: r.ry, random }),
  detached: (r, random) => createDetachedHouse({ x: r.x, z: r.z, width: r.width ?? DEFAULT_WIDTH, depth: r.depth ?? DEFAULT_DEPTH, color: r.color ?? DEFAULT_COLOR, roofColor: r.roofColor, ry: r.ry, isBoarded: r.isBoarded, random }),
  slab: (r, random) => createSlabHouse({ x: r.x, z: r.z, width: r.width ?? 7, depth: r.depth ?? 8, floors: r.floors ?? 1, color: r.color ?? 0xa8a49c, random }),
  colonial: (r, random) => turned(createColonialHouse({ x: r.x, z: r.z, width: r.width ?? 7, color: r.color ?? 0xd0c4a8, hasDoor: r.hasDoor ?? false, random }), r.ry),
  chalet: (r, random) => createChalet({ x: r.x, z: r.z, color: r.color, ry: r.ry, random }),
  company_house: (r, random) => turned(createCompanyHouse({ x: r.x, z: r.z, color: r.color, random }), r.ry),
  stilt: (r, random) => createStiltHouse({ x: r.x, z: r.z, color: r.color, random }),
  farmhouse: (r, random) => createFarmhouse({ x: r.x, z: r.z, random }),
}

/** The default provider: the silhouette of game-floorplan for the typology, added to the builder with its shared random. */
export function createSilhouetteHouses(typologies: Readonly<Record<string, SilhouetteFactory>> = SILHOUETTE_TYPOLOGIES): HouseProvider {
  return (typology, request: HouseRequest, b) => {
    const factory = typologies[typology]
    if (!factory) throw new Error(`The house provider has no typology "${typology}"`)
    b.add(factory(request, b.random))
  }
}
