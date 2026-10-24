import { GROUND } from '../types'
import type { StructurePart } from '../types'
import type { BuildContext, BuildWall } from './context'
import { guardHeightOf, OPEN_ROOM_TYPES } from './context'

/** Highest ceiling among the rooms the wall touches (a double-height room lifts its outer wall to the eave). */
export function wallCeiling(context: BuildContext, wall: BuildWall): number {
  const rooms = wall.sides.map((id) => context.source.rooms.find((room) => room.id === id && room.floor === wall.floor)).filter((room) => room !== undefined)
  return Math.max(context.ceilingOf(wall.floor), ...rooms.map((room) => room.ceiling || 0))
}

function wallTop(context: BuildContext, wall: BuildWall, floor: number): number {
  const y0 = context.level(floor)
  if (wall.type === 'railing') return y0 + guardHeightOf(wall)
  const ceiling = wallCeiling(context, wall)
  const height = wall.structureHeight || wall.h || context.ceilingOf(floor)
  if (wall.exterior && floor < context.floorCount - 1 && !context.isUnit && ceiling > context.ceilingOf(floor) + 0.01) return y0 + ceiling
  if (floor === context.floorCount - 1 || context.isUnit) return y0 + Math.max(height, ceiling)
  const top = context.topOf(floor)
  return Math.max(y0 + height, y0 + ceiling > top ? top : y0 + ceiling)
}

/** What a railing rests on: the slab of its own balcony or the floor of its porch. */
function railingBase(context: BuildContext, wall: BuildWall, floor: number): StructurePart | string | undefined {
  const open = wall.sides
    .map((id) => context.source.rooms.find((room) => room.id === id && room.floor === floor))
    .find((room) => room && (room.type === 'balcony' || room.type === 'porch'))
  if (!open) return context.baseOf(floor)
  return open.type === 'porch' ? `porch_floor_${open.id}` : `slab_${floor}_${open.id}`
}

const assemblyOf = (context: BuildContext): string | undefined => context.construction.walls.assembly ?? (context.system.walls || undefined)

function addWallPart(context: BuildContext, wall: BuildWall, floor: number): void {
  const { system, builder } = context
  const isRailing = wall.type === 'railing'
  const y0 = context.level(floor)
  const top = wallTop(context, wall, floor)
  const y1 = isRailing ? top : wall.exterior && !wall.gable ? top - system.plateThickness : top
  const framed = system.studs !== undefined && !isRailing
  const part = builder.add(
    { id: wall.id, role: wall.role, material: wall.material, aabb: wall.box, y0, y1: Math.max(y1, y0 + 0.2) },
    { floor, fill: context.isTimber && wall.role === 'wall' ? system.wallFill : 1, ...(framed ? { studs: system.studs } : {}), ...(isRailing ? {} : { assembly: assemblyOf(context) }) },
  )
  context.wallParts.set(wall.id, part)
  const base = isRailing ? railingBase(context, wall, floor) : context.baseOf(floor)
  const joint = isRailing ? 'nail' : system.joints.wall
  if (base === GROUND || (floor === 0 && !base)) builder.rest(part, GROUND, joint)
  else if (base) builder.rest(part, base, joint)
}

/** One part per wall of the storey, resting on the floor below it (or the ground). */
export function addWalls(context: BuildContext, floor: number): void {
  for (const wall of context.walls.filter((w) => w.floor === floor)) addWallPart(context, wall, floor)
}

export const isOpenRoomType = (type: string): boolean => OPEN_ROOM_TYPES.includes(type)
