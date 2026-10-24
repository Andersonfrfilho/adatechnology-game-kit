import type { JointKind } from '@adatechnology/game-contracts'

import type { Construction, ConstructionSystem, PlanContext, StructureExtras } from './types'

/** What a wall system is made of and how its parts are tied. Timber systems sit on joists, carry the roof on timber plates and have wooden porch posts. */
export interface ConstructionSystemDef {
  /** Wall assembly of `game-destruction` (`registerAssembly`) the detailed wall is built from. Empty: no walls (a tent). */
  walls: string
  joints: Record<'wall' | 'slab' | 'beam' | 'column' | 'truss', JointKind>
  /** Thickness of the structural floor under each storey (m). */
  slabThickness: number
  /** Height of the top plate or bond beam (m). */
  plateThickness: number
  timber: boolean
  /** `rules`: bearing when external, under another wall or beside a porch; `bearing`: every wall (logs); `partition`: none (posts carry the roof). */
  wallRole: 'rules' | 'bearing' | 'partition'
  /** Solid fraction of a bearing wall in the structure weight (studs and air). */
  wallFill: number
  studs?: { spacing: number; section: string }
}

const uniform = (joint: JointKind): ConstructionSystemDef['joints'] => ({ wall: joint, slab: joint, beam: joint, column: joint, truss: joint })

export const CONSTRUCTION_SYSTEMS = new Map<string, ConstructionSystemDef>([
  ['masonry', { walls: 'brick_wall_plastered', joints: { wall: 'mortar', slab: 'rebar', beam: 'mortar', column: 'rebar', truss: 'bolt' }, slabThickness: 0.12, plateThickness: 0.2, timber: false, wallRole: 'rules', wallFill: 1 }],
  ['wood_frame', { walls: 'wood_frame_wall', joints: uniform('nail'), slabThickness: 0.28, plateThickness: 0.1, timber: true, wallRole: 'rules', wallFill: 0.35, studs: { spacing: 0.4, section: '38x89' } }],
  ['log', { walls: 'log_wall', joints: { wall: 'bolt', slab: 'nail', beam: 'bolt', column: 'bolt', truss: 'bolt' }, slabThickness: 0.2, plateThickness: 0.1, timber: true, wallRole: 'bearing', wallFill: 1 }],
  ['improvised', { walls: 'sheet_metal_shack', joints: uniform('nail'), slabThickness: 0.2, plateThickness: 0.1, timber: true, wallRole: 'partition', wallFill: 1 }],
  ['canvas', { walls: '', joints: uniform('tie'), slabThickness: 0, plateThickness: 0, timber: false, wallRole: 'partition', wallFill: 1 }],
])

/** Adds or replaces a construction system (`id` is a `ConstructionSystem` or any name a construction refers to). */
export function registerConstructionSystem(id: ConstructionSystem | string, def: ConstructionSystemDef): void {
  CONSTRUCTION_SYSTEMS.set(id, def)
}

export interface RoofCoveringDef {
  material: string
  /** How the covering is fixed to the trusses. */
  joint: JointKind
}

export const ROOF_COVERINGS = new Map<string, RoofCoveringDef>([
  ['colonial', { material: 'ceramic', joint: 'resting' }],
  ['fiber_cement', { material: 'concrete', joint: 'bolt' }],
  ['slab', { material: 'concrete', joint: 'rebar' }],
  ['asphalt', { material: 'plastic', joint: 'nail' }],
  ['zinc', { material: 'steel', joint: 'nail' }],
  ['wood', { material: 'wood_soft', joint: 'nail' }],
  ['canvas', { material: 'fabric', joint: 'tie' }],
  ['thatch', { material: 'foliage', joint: 'tie' }],
])

export function registerRoofCovering(id: string, def: RoofCoveringDef): void {
  ROOF_COVERINGS.set(id, def)
}

export interface ConstructionBuild {
  construction: Construction
  extras?: StructureExtras
}
export type ConstructionBuilder = (context: PlanContext) => ConstructionBuild

export const CONSTRUCTIONS = new Map<string, ConstructionBuilder>()

/** Registers how a template's building is made: `TemplateDef.construction` names it. A template without one gets the masonry default. */
export function registerConstruction(id: string, builder: ConstructionBuilder): void {
  CONSTRUCTIONS.set(id, builder)
}
