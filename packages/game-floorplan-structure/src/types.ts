import type { JointKind, MaterialId, StructureRole } from '@adatechnology/game-contracts'

/** Axis-aligned rectangle `[u0, v0, u1, v1]` in the plan (metres). */
export type Rect = [number, number, number, number]

export type ConstructionSystem = 'masonry' | 'wood_frame' | 'log' | 'improvised' | 'canvas'
export type WallDetail = 'coarse' | 'panels' | 'units'
/** What a structural part is called in a plan: a column is a pillar, `wall` is a bearing wall, `partition` a wall that only closes. */
export type PartRole = Exclude<StructureRole, 'foundation'>

export const GROUND = 'ground'

/** A piece of the structure with its box in the plan, its height range and the mass it weighs. `y` is absolute: the ground floor sits at `foundation.elevation`. */
export interface StructurePart {
  id: string
  role: PartRole
  material: MaterialId
  aabb: Rect
  y0: number
  y1: number
  floor: number
  mass: number
  /** Part this one is cut out of (a pier of a wall in `panels` detail). */
  host?: string
  /** Wall assembly of `game-destruction` the part is built from in the destructible spec (layers, units, rebar, breach). */
  assembly?: string
  /** A brick, block or log: the unit of a wall (`units` detail, log courses), not a piece of it. */
  unit?: true
  /** Distance between repeated members (joists, ceiling joists). */
  spacing?: number
  /** `plate` (timber top plate) or `bond_beam` (masonry bond beam). */
  beamKind?: 'plate' | 'bond_beam'
  steps?: number
  door?: string
  /** Slab that is the roof (flat roof). */
  cover?: boolean
  /** Litres a tank holds. */
  liters?: number
  studs?: { spacing: number; section: string }
  pitch?: number
  tent?: string
  form?: string
  /** Rooms a concrete slab covers (the rectangles of the storey it carries); the slab itself is their bounding box. `toDestructibleSpec` cuts the slab into panels over it. */
  footprint?: Rect[]
  /** Slab the panel, beam or column was made for (`toDestructibleSpec` with `slabPanels`; a `StructurePart` of `buildStructure` never has it). */
  slab?: string
}

/** `part` rests on `on` (`GROUND` or another part) through `joint`. `bears: false` ties the two without carrying load. */
export interface Support {
  part: string
  on: string
  joint: JointKind
  bears?: false
}

export interface RoofPane {
  id: string
  aabb: Rect
  y0: number
  y1: number
  flat?: true
}

export type RoofShape = 'gable' | 'slab' | 'tent'

export interface Roof {
  shape: RoofShape
  covering: string
  material: MaterialId
  pitch: number
  /** Floor the roof rests on. */
  bearingFloor: number
  panes: (RoofPane | string)[]
  trusses: number
  axis?: 'u' | 'v'
  ridge?: number
  eave?: number
  y0?: number
  aabb?: Rect
}

/** A window in a wall (the doors are gaps between walls: a lintel part bridges them). Heights are absolute. */
export interface Opening {
  id: string
  kind: 'window' | 'door'
  wall: string
  /** Along the wall (u for a wall along u, v for one along v). */
  from: number
  to: number
  y0: number
  y1: number
}

export interface Structure {
  parts: StructurePart[]
  supports: Support[]
  openings: Opening[]
  /** Absolute height of the floor level of each storey. */
  levels: number[]
  elevation: number
  roof: Roof
  construction: Construction
  /** A reinforced concrete frame carries the building (apartments, commercial buildings, three storeys or more); the walls are infill. */
  framed: boolean
}

export interface WallMaterials {
  material: MaterialId
  interior?: MaterialId
  cladding?: MaterialId | null
  finish?: string
  /** Wall assembly of `game-destruction` (default by system, and by finish in masonry). */
  assembly?: string
  thickness: number
  studs?: string
  /** Materials drawn per wall by a hash of its legacy key (the improvised shack). */
  mixed?: MaterialId[]
  [extra: string]: unknown
}

export interface Construction {
  system: ConstructionSystem
  walls: WallMaterials
  floor: { material: MaterialId; finish: string }
  roof: {
    material: MaterialId
    covering: string
    shape: RoofShape
    pitch: number
    timber: MaterialId
    eave?: number
    axis?: 'u' | 'v'
    bearingFloor?: number
    profile?: string
    gables?: string[]
    fastening?: string
  }
  frame: { material: MaterialId; pillars: MaterialId; beams: MaterialId; slabs: MaterialId; timber: MaterialId; rebar: MaterialId | null }
  foundation: { type: FoundationType; material: MaterialId; elevation: number; depth?: number }
  guard?: MaterialId
  stairs?: MaterialId
}

export type FoundationType = 'strip_footing' | 'building' | 'raft' | 'crawl_space' | 'piles' | 'basement' | 'ground'

export interface Chimney {
  kind: 'fireplace' | 'flue'
  material: MaterialId
  aabb: Rect
  flue?: boolean
  top?: number
  height?: number
}

export interface Tent {
  id: string
  kind: string
  height: number
  aabb: Rect
}

/** What a construction needs besides walls and roof, from the template: a chimney, a well, an attic floor, tents. */
export interface StructureExtras {
  chimney?: Chimney
  well?: { aabb: Rect; height?: number }
  attic?: boolean
  tents?: Tent[]
  [extra: string]: unknown
}

export interface TankPlatform {
  aabb: Rect
  baseY: number
  height: number
  thickness: number
  topY: number
  pillars: { u: number; v: number; side: number }[]
  ladder: boolean
}

export interface WaterTank {
  id: 'water_tank'
  kind: 'water_tank'
  itemType: string
  place: 'slab' | 'attic' | 'raised_slab' | 'trestle' | string
  floor: number
  room: string
  u: number
  v: number
  y: number
  w: number
  d: number
  h: number
  capacity: number
  material?: MaterialId
  aabb: Rect
  platform?: TankPlatform
  /** Trestle tank (a stand of its own: rural water). */
  stand?: { pillars: { u: number; v: number; side: number }[]; material: MaterialId; height: number; baseJoint?: JointKind; joint?: JointKind; tie?: JointKind; braces?: boolean }
}

/** The fields of a generated plan the structure reads. */
export interface StructureSource {
  floors: { y0: number; ceiling: number }[]
  rooms: { id: string; type: string; floor: number; parts: Rect[]; ceiling?: number | null }[]
  walls: SourceWall[]
  doors: SourceDoor[]
  windows?: SourceWindow[]
  items: { id?: string; type: string; category?: string; floor: number; aabb?: Rect; link?: { from: number; to: number } | null }[]
  facade: { roof?: string; finish?: string; [extra: string]: unknown }
  style?: string
  template?: string
  lot?: unknown
  w: number
  d: number
  floorNumber?: number
  waterTank?: WaterTank | null
  construction?: Construction
  structureExtras?: StructureExtras
  [extra: string]: unknown
}

export interface SourceWall {
  floor: number
  axis: 'u' | 'v'
  u0: number
  v0: number
  u1: number
  v1: number
  thickness?: number
  sides: string[]
  exterior: boolean
  type: string
  h?: number
  /** Gable wall: the plate does not sit on top of it. */
  gable?: boolean
  structureHeight?: number
}

export interface SourceWindow {
  id: string
  floor: number
  axis: 'u' | 'v'
  /** Coordinate of the wall line across its axis. */
  pos: number
  /** Centre along the wall. */
  at: number
  width: number
  y0: number
  y1: number
}

export interface SourceDoor {
  id: string
  floor: number
  a: string
  b: string
  exterior?: boolean
  model?: string
  type?: string
  u: number
  v: number
  width: number
  side?: string
  axis: 'u' | 'v'
  steps?: number
}

export interface StructureOptions {
  construction?: Construction
  extras?: StructureExtras
  tank?: WaterTank | null
  /** The porch roof is carried by its posts alone (the tie to the house wall carries nothing). Default: when the detail is not `coarse`. */
  porchRoofOnPostsOnly?: boolean
  /** Gable roofs as rafters of each side and a ridge beam (a side falls with the wall it rests on) instead of whole trusses. Default: when the detail is not `coarse`. */
  rafterRoof?: boolean
  wallDetail?: WallDetail
  /** `false`: no roof (a free-standing wall, a garden wall). Default `true`. */
  roof?: boolean
}

/** What a construction builder and the tank get to see: the generated plan, its seed and the template. */
export interface PlanContext {
  result: StructureSource
  seed: number | string
  /** The template definition (`TemplateDef`) when known: it may carry `tank` and `tankLocation` hooks. */
  template?: Record<string, unknown>
  options?: { floors?: number; [extra: string]: unknown }
}
