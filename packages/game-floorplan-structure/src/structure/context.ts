import type { MaterialId } from '@adatechnology/game-contracts'

import { unionOf, wallBox, round2 } from '../geometry'
import { CONSTRUCTION_SYSTEMS } from '../registry'
import type { ConstructionSystemDef } from '../registry'
import { GROUND } from '../types'
import type { Construction, PartRole, Rect, Roof, StructureExtras, StructurePart, StructureSource, WaterTank, SourceWall } from '../types'
import { StructureBuilder } from './builder'
import { hashLegacyKey } from './legacy-key'

export const OPEN_ROOM_TYPES: readonly string[] = ['balcony', 'terrace', 'porch']
const GUARD_HEIGHT = 1.1

export interface BuildWall extends SourceWall {
  id: string
  /** The id the Visor de casas 3D gave the wall (`w<floor>_<index>`); seeded choices hash it so old seeds keep their draws. */
  legacyKey: string
  role: PartRole
  material: MaterialId
  box: Rect
}

export interface PorchPosts {
  posts: StructurePart[]
  ceilingY: number
}

type Base = StructurePart | typeof GROUND | undefined

/** Everything the steps that build the structure share: the plan, the construction, the parts so far and what each storey rests on. */
export interface BuildContext {
  source: StructureSource
  construction: Construction
  system: ConstructionSystemDef
  extras: StructureExtras
  tank: WaterTank | null
  builder: StructureBuilder
  porchRoofOnPostsOnly: boolean
  /** Gable roofs are built as rafters of each side plus a ridge beam, so a side falls with the wall it rests on. */
  rafterRoof: boolean
  floorCount: number
  isUnit: boolean
  elevation: number
  isTimber: boolean
  walls: BuildWall[]
  wallParts: Map<string, StructurePart>
  carriers: Map<number, StructurePart[]>
  plates: Map<number, StructurePart[]>
  pillars: Map<number, StructurePart[]>
  porches: Map<string, PorchPosts>
  base0: Base
  houseBox: Rect
  topBox: Rect
  hasBasement: boolean
  topSlab?: StructurePart
  ceilingJoists?: StructurePart[]
  roof: Roof
  level(floor: number): number
  ceilingOf(floor: number): number
  topOf(floor: number): number
  rectsOf(floor: number, exclude?: readonly string[]): Rect[]
  baseOf(floor: number): Base
}

export interface ContextOptions {
  porchRoofOnPostsOnly: boolean
  rafterRoof: boolean
}

export function createContext(source: StructureSource, construction: Construction, extras: StructureExtras, tank: WaterTank | null, options: ContextOptions): BuildContext {
  const system = CONSTRUCTION_SYSTEMS.get(construction.system)
  if (!system) throw new Error(`Unknown construction system "${construction.system}"`)
  const floorCount = source.floors.length
  const isUnit = source.floorNumber !== undefined
  const elevation = construction.foundation.elevation || 0
  const level = (floor: number): number => round2(elevation + (source.floors[floor]?.y0 ?? 0))
  const ceilingOf = (floor: number): number => source.floors[floor]?.ceiling ?? 0
  const topOf = (floor: number): number => (floor < floorCount - 1 && !isUnit ? level(floor + 1) - system.slabThickness : level(floor) + ceilingOf(floor))
  const rectsOf = (floor: number, exclude: readonly string[] = []): Rect[] =>
    source.rooms.filter((room) => room.floor === floor && !exclude.includes(room.type)).flatMap((room) => room.parts)
  const builder = new StructureBuilder()
  const context: BuildContext = {
    source, construction, system, extras, tank, builder, porchRoofOnPostsOnly: options.porchRoofOnPostsOnly, rafterRoof: options.rafterRoof, floorCount, isUnit, elevation, isTimber: system.timber,
    walls: [], wallParts: new Map(), carriers: new Map(), plates: new Map(), pillars: new Map(), porches: new Map(), base0: GROUND,
    houseBox: [0, 0, 0, 0], topBox: [0, 0, 0, 0], hasBasement: false,
    roof: { shape: 'slab', covering: '', material: '', pitch: 0, bearingFloor: 0, panes: [], trusses: 0 },
    level, ceilingOf, topOf, rectsOf,
    baseOf: (floor) => (floor === 0 ? context.base0 : builder.find(`slab_${floor}`)),
  }
  const closed = rectsOf(0, ['balcony', 'porch'])
  context.houseBox = unionOf(closed.length ? closed : rectsOf(0))
  context.walls = classifyWalls(context)
  return context
}

const isBearingOnTop = (wall: BuildWall, walls: readonly BuildWall[]): boolean => {
  const along = (w: SourceWall, pick: (a: number, b: number) => number): number => (w.axis === 'u' ? pick(w.u0, w.u1) : pick(w.v0, w.v1))
  const across = (w: SourceWall): number => (w.axis === 'u' ? w.v0 : w.u0)
  return walls.some(
    (other) =>
      other.floor === wall.floor + 1 && other.type === 'wall' && other.axis === wall.axis && Math.abs(across(other) - across(wall)) < 0.2 &&
      Math.min(along(wall, Math.max), along(other, Math.max)) - Math.max(along(wall, Math.min), along(other, Math.min)) > 0.3,
  )
}

function roleOf(context: BuildContext, wall: BuildWall, walls: readonly BuildWall[], porchIds: ReadonlySet<string>): PartRole {
  if (wall.type === 'railing') return 'partition'
  const { wallRole } = context.system
  if (wallRole === 'bearing') return 'wall'
  if (wallRole === 'partition') return 'partition'
  const bearingFloor = context.construction.roof.bearingFloor ?? context.floorCount - 1
  if (wall.floor > bearingFloor) return 'partition'
  if (wall.exterior || wall.sides.some((id) => porchIds.has(id))) return 'wall'
  return wall.floor < context.floorCount - 1 && isBearingOnTop(wall, walls) ? 'wall' : 'partition'
}

function materialOf(context: BuildContext, wall: BuildWall): MaterialId {
  const { walls, guard } = context.construction
  if (wall.type === 'railing') return guard ?? (context.isTimber ? 'wood_soft' : 'steel')
  if (walls.mixed?.length) return walls.mixed[hashLegacyKey(wall.legacyKey) % walls.mixed.length] as MaterialId
  return wall.exterior ? walls.material : (walls.interior ?? walls.material)
}

function classifyWalls(context: BuildContext): BuildWall[] {
  const countByFloor = new Map<number, number>()
  const all: BuildWall[] = context.source.walls.map((wall) => {
    const index = countByFloor.get(wall.floor) ?? 0
    countByFloor.set(wall.floor, index + 1)
    return { ...wall, id: `wall_${wall.floor}_${index}`, legacyKey: `w${wall.floor}_${index}`, role: 'wall', material: '', box: wallBox(wall) }
  })
  const built = all.filter((wall) => wall.type === 'wall' || wall.type === 'railing')
  const porchIds = new Set(context.source.rooms.filter((room) => room.type === 'porch').map((room) => room.id))
  for (const wall of built) {
    wall.role = roleOf(context, wall, built, porchIds)
    wall.material = materialOf(context, wall)
  }
  return built
}

export const guardHeightOf = (wall: BuildWall): number => wall.h || GUARD_HEIGHT
