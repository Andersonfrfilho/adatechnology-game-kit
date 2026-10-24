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
import { installHouseBaseboard } from './house/baseboard.js'
import { installFurnitureApi } from './furniture/api.js'
import { installInteractionState } from './interaction/state.js'
import { installInteractionDoors } from './interaction/doors.js'
import { installBuildInstance } from './build/instance.js'
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
  const Reflector = null
  const FLEET = null
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
  installHouseBaseboard(K, shared)
  installFurnitureApi(K, shared)
  installInteractionState(K, shared)
  installInteractionDoors(K, shared)
  installBuildInstance(K, shared)
  installBuildBuild(K, shared)
  return buildApi(K, shared) as HouseRenderer
}
