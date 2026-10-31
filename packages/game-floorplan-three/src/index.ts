export * from './create.js'
export { createTranslator, en, ptBR, locales } from './locale.js'
export type { Messages, Translate } from './locale.js'
export { createFloorNavigator } from './navigation/floor-navigator.js'
export type { FloorNavigator, NavFlight, NavFloor, NavHouse, NavHouseDef, NavRect, NavResult, NavShape, NavStair } from './navigation/floor-navigator.js'
export { navigationDefOf } from './navigation/from-house.js'
export type { NavigableHouse, NavigationDefOptions } from './navigation/from-house.js'
export { bindNavigator } from './navigation/bind.js'
export type { DestructibleHouse, NavigatorBinding } from './navigation/bind.js'
export type { BuildOptions, Damageable, House, HouseRenderer, HouseRendererOptions } from './types.js'
/** @deprecated import from '@adatechnology/game-floorplan-three/testing' */
export { createFloorplanTestModule, FLOORPLAN_AREA_ID } from './testing'
/** @deprecated import from '@adatechnology/game-floorplan-three/testing' */
export { createHouseScenarios, SPECIMEN_AT } from './testing'
/** @deprecated import from '@adatechnology/game-floorplan-three/testing' */
export type { AreaContext } from './testing'
/** @deprecated import from '@adatechnology/game-floorplan-three/testing' */
export { DEFAULT_SPECIMENS, buildSpecimenMeshes, specimenSpec } from './testing'
/** @deprecated import from '@adatechnology/game-floorplan-three/testing' */
export type { FloorplanEngineLike, FloorplanTestOptions, SpecimenDef, TemplateGroup } from './testing'
export { furnitureSpec, tapSpec } from './furniture/spec.js'
export { wallPiece, wallPlan } from './wall.js'
export type { WallPiece, WallPieceOptions } from './wall.js'
export type { FurnitureCatalogEntry, FurnitureSpecOptions, FurnitureSpecResult, TapSpecOptions, TapSpecResult } from './furniture/spec.js'
