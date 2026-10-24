import * as props3d from '@adatechnology/game-props3d'

import type { Kernel, Shared } from './kernel-types.js'
import { createTranslator } from './locale.js'
import * as statics from './statics.js'
import { installKernelGeometry } from './kernel/geometry.js'
import { installKernelNoise } from './kernel/noise.js'
import { installMaterialsTextures } from './materials/textures.js'
import { installMaterialsMaterials } from './materials/materials.js'
import { installKernelCloseScene } from './kernel/close-scene.js'
import { installHouseHelpers } from './house/helpers.js'
import { installHouseWalls } from './house/walls.js'
import { installHouseDoors } from './house/doors.js'
import { installHouseWindows } from './house/windows.js'
import { installHouseFloors } from './house/floors.js'
import { installHouseStairs } from './house/stairs.js'
import { installLightsFixtures } from './lights/fixtures.js'
import { installLightsDecor } from './lights/decor.js'
import { installLotTerrain } from './lot/terrain.js'
import { installLotPerimeter } from './lot/perimeter.js'
import { installLotGates } from './lot/gates.js'
import { installRoofRoofs } from './roof/roofs.js'
import { installRoofGutters } from './roof/gutters.js'
import { installRoofSlabs } from './roof/slabs.js'
import { installRoofTiles } from './roof/tiles.js'
import { installRoofRect } from './roof/rect.js'
import { installMirrors } from './mirrors.js'
import { installCars } from './cars.js'
import { installHouseBuilding } from './house/building.js'
import { installUtilitiesWater } from './utilities/water.js'
import { installUtilitiesElectrical } from './utilities/electrical.js'
import { installHouseBaseboard } from './house/baseboard.js'
import { installUtilitiesSolar } from './utilities/solar.js'
import { installHouseOutbuildings } from './house/outbuildings.js'
import { installFurnitureApi } from './furniture/api.js'
import { installFurnitureBuilders } from './furniture/builders.js'
import { installFurnitureTypeTable } from './furniture/type-table.js'
import { installFurnitureTaps } from './furniture/taps.js'
import { installFurnitureFixtures } from './furniture/fixtures.js'
import { installFurniturePlants } from './furniture/plants.js'
import { installFurnitureYard } from './furniture/yard.js'
import { installFurnitureExtraTypes } from './furniture/extra-types.js'
import { installFurniturePlaceItems } from './furniture/place-items.js'
import { installVegetationBridge } from './vegetation/bridge.js'
import { installInteractionState } from './interaction/state.js'
import { installInteractionCollision } from './interaction/collision.js'
import { installInteractionItems } from './interaction/items.js'
import { installInteractionFittings } from './interaction/fittings.js'
import { installInteractionDoors } from './interaction/doors.js'
import { installInteractionTarget } from './interaction/target.js'
import { installInteractablesBridge } from './interactables/bridge.js'
import { installAnimationClotheslines } from './animation/clotheslines.js'
import { installBuildInstance } from './build/instance.js'
import { installInteractablesKit } from './interactables/kit.js'
import { installLightsRoomLight } from './lights/room-light.js'
import { installDestructionPieces } from './destruction/pieces.js'
import { installDestructionBreach } from './destruction/breach.js'
import { installDestructionWorld } from './destruction/world.js'
import { installBuildBuild } from './build/build.js'
import { buildApi } from './build/api.js'

import type { HouseRenderer, HouseRendererOptions } from './types.js'

export const VERSION = '1.0.0'
/** Same as `create`: the house renderer of the SDK. */
export { create as createHouseRenderer }
export { planLod, rectsOf, isOpenArea, OPEN_ROOM_TYPES } from './statics.js'

/**
 * Creates a house renderer: `create(THREE, options).build(result, { quality, night })` turns the result of `@adatechnology/game-floorplan`
 * (plus the structure of `@adatechnology/game-floorplan-structure`) into a three.js group. Port of the team's Casa3DSDK.
 */
export function create(THREE: any, options: HouseRendererOptions = {}): HouseRenderer {
  const cfg = Object.assign({}, options || {})
  const DOC = cfg.document || (typeof document !== 'undefined' ? document : null)
  const PROPS = cfg.props || props3d
  const Reflector = cfg.reflector || null // THREE.Reflector (three/examples/jsm/objects/Reflector.js); without it the mirrors use only the environment map
  const FLEET = cfg.fleet || null // fleet of cars: build(kind, { quality, seed }) -> { group, damageable, release() }; without it there are no cars
  const HP = Object.assign({ glass: 20, wood: 60, water: 80, metal: 200, masonry: 500, rubber: 40, fuel: 60, gas: 40 }, cfg.hp)
  const invalidate = () => { if (cfg.onChange) cfg.onChange({ shadow: false }) }
  const invalidateShadow = () => { if (cfg.onChange) cfg.onChange({ shadow: true }) }
  const colliderChanged = (c: any) => { if (c && cfg.onCollider) cfg.onCollider(c) }
  const shared: Shared = { mats: null, quality: cfg.quality === 'game' ? 'game' : 'high' }
  const seedKey = (id: any) => { if (cfg.seedKey && id != null) { const k = cfg.seedKey(String(id)); return k == null ? id : k } return id }
  const K: Kernel = { t: createTranslator(cfg.locale), seedKey, THREE, cfg, DOC, PROPS, Reflector, FLEET, HP, invalidate, invalidateShadow, colliderChanged, VERSION, rectsOf: statics.rectsOf, isOpenArea: statics.isOpenArea, OPEN_ROOM_TYPES: statics.OPEN_ROOM_TYPES }
  installKernelGeometry(K, shared)
  installKernelNoise(K, shared)
  installMaterialsTextures(K, shared)
  installMaterialsMaterials(K, shared)
  installKernelCloseScene(K, shared)
  installHouseHelpers(K, shared)
  installHouseWalls(K, shared)
  installHouseDoors(K, shared)
  installHouseWindows(K, shared)
  installHouseFloors(K, shared)
  installHouseStairs(K, shared)
  installLightsFixtures(K, shared)
  installLightsDecor(K, shared)
  installLotTerrain(K, shared)
  installLotPerimeter(K, shared)
  installLotGates(K, shared)
  installRoofRoofs(K, shared)
  installRoofGutters(K, shared)
  installRoofSlabs(K, shared)
  installRoofTiles(K, shared)
  installRoofRect(K, shared)
  installMirrors(K, shared)
  installCars(K, shared)
  installHouseBuilding(K, shared)
  installUtilitiesWater(K, shared)
  installUtilitiesElectrical(K, shared)
  installHouseBaseboard(K, shared)
  installUtilitiesSolar(K, shared)
  installHouseOutbuildings(K, shared)
  installFurnitureApi(K, shared)
  installFurnitureBuilders(K, shared)
  installFurnitureTypeTable(K, shared)
  installFurnitureTaps(K, shared)
  installFurnitureFixtures(K, shared)
  installFurniturePlants(K, shared)
  installFurnitureYard(K, shared)
  installFurnitureExtraTypes(K, shared)
  installFurniturePlaceItems(K, shared)
  installVegetationBridge(K, shared)
  installInteractionState(K, shared)
  installInteractionCollision(K, shared)
  installInteractionItems(K, shared)
  installInteractionFittings(K, shared)
  installInteractionDoors(K, shared)
  installInteractionTarget(K, shared)
  installInteractablesBridge(K, shared)
  installAnimationClotheslines(K, shared)
  installBuildInstance(K, shared)
  installInteractablesKit(K, shared)
  installLightsRoomLight(K, shared)
  installDestructionPieces(K, shared)
  installDestructionBreach(K, shared)
  installDestructionWorld(K, shared)
  installBuildBuild(K, shared)
  return buildApi(K, shared) as HouseRenderer
}
