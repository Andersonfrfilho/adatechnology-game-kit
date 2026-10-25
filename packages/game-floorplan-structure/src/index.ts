export const version = '0.1.0'

export { register } from './register'
export type { StructurePackOptions } from './register'
export { buildStructure } from './structure'
export { PILE_AREA, RAFT_THICKNESS, REBAR_RATIOS, toDestructibleSpec } from './to-destructible-spec'
export type { DestructibleSpecOptions } from './to-destructible-spec'
export { SLAB_PANEL_DEFAULTS, applySlabPanels, resolveSlabPanels, slabPanelsOf } from './slab-panels'
export type { SlabPanelOptions } from './slab-panels'
export { buildWallSpecimen } from './wall-specimen'
export type { WallSpecimenOptions } from './wall-specimen'
export { planWaterTank } from './water-tank'
export type { TankPlanOptions } from './water-tank'
export {
  CONSTRUCTION_SYSTEMS, CONSTRUCTIONS, ROOF_COVERINGS, registerConstruction, registerConstructionSystem, registerRoofCovering,
} from './registry'
export type { ConstructionBuild, ConstructionBuilder, ConstructionSystemDef, RoofCoveringDef } from './registry'
export { campConstruction, chaletConstruction, constructionOfSystem, logCabinConstruction, masonryConstruction, shackConstruction, woodFrameConstruction } from './presets'
export type { ChaletOptions, ShackOptions, WoodFrameOptions } from './presets'
export { structureLayer } from './viewer-layer'
export { DENSITY } from './density'
export { GROUND } from './types'
export type * from './types'
export {
  CORE_DEFAULTS, CURTAIN_DEFAULTS, FLAT_ROOF_DEFAULTS, MECHANICAL_DEFAULTS, TOWER_DEFAULTS, addCore, addCurtainWall, addFlatRoof, addMechanicalFloor, buildTower,
  coreSize, towerWater,
} from './tower'
export type { CoreOptions, CurtainWallOptions, FlatRoofOptions, MechanicalFloorOptions, TowerGeometry, TowerOptions } from './tower'
