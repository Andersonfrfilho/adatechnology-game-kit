import type { Opening, Rect, StructurePart } from '../types'
import type { BuildContext, BuildWall } from './context'

const TOLERANCE = 0.02
/** Height of a door leaf, which the plan does not store (m). */
export const DOOR_HEIGHT = 2.1
const LINTEL_DEPTH = 0.2
const LINTEL_BEARING = 0.2

const crossOf = (wall: BuildWall): number => (wall.axis === 'u' ? wall.v0 : wall.u0)
const alongRange = (wall: BuildWall): [number, number] => (wall.axis === 'u' ? [Math.min(wall.u0, wall.u1), Math.max(wall.u0, wall.u1)] : [Math.min(wall.v0, wall.v1), Math.max(wall.v0, wall.v1)])

/** The windows of the plan, each in the wall it sits in. */
export function findOpenings(context: BuildContext): Opening[] {
  const openings: Opening[] = []
  for (const window of context.source.windows ?? []) {
    const from = window.at - window.width / 2
    const to = window.at + window.width / 2
    const wall = context.walls.find((w) => {
      if (w.floor !== window.floor || w.axis !== window.axis || w.type !== 'wall' || Math.abs(crossOf(w) - window.pos) > TOLERANCE) return false
      const [low, high] = alongRange(w)
      return from >= low - TOLERANCE && to <= high + TOLERANCE
    })
    if (!wall) continue
    const base = context.level(window.floor)
    openings.push({ id: window.id, kind: 'window', wall: wall.id, from, to, y0: base + window.y0, y1: base + window.y1 })
  }
  return openings
}

/**
 * A lintel over every door gap, 0.2 m deep, bearing 0.2 m on the wall at each side (a concrete beam in masonry, a header in timber houses). The bond beam or
 * plate over the door rests on it as well as on the walls beside it.
 */
export function addDoorLintels(context: BuildContext): void {
  const { builder, construction, system } = context
  for (const door of context.source.doors.filter((d) => d.a !== undefined && d.type !== 'zipper')) {
    const along = door.axis === 'u' ? door.u : door.v
    const cross = door.axis === 'u' ? door.v : door.u
    const from = along - door.width / 2
    const to = along + door.width / 2
    const beside = context.walls.filter((w) => w.floor === door.floor && w.axis === door.axis && w.type === 'wall' && Math.abs(crossOf(w) - cross) <= TOLERANCE && (Math.abs(alongRange(w)[1] - from) <= 0.05 || Math.abs(alongRange(w)[0] - to) <= 0.05))
    if (!beside.length) continue
    const half = (beside[0]!.thickness ?? 0.15) / 2
    const lo = from - LINTEL_BEARING
    const hi = to + LINTEL_BEARING
    const box: Rect = door.axis === 'u' ? [lo, cross - half, hi, cross + half] : [cross - half, lo, cross + half, hi]
    const y0 = context.level(door.floor) + DOOR_HEIGHT
    const lintel = builder.add({ id: `lintel_${door.id}`, role: 'beam', material: system.timber ? construction.frame.timber : 'concrete', aabb: box, y0, y1: y0 + LINTEL_DEPTH }, { floor: door.floor, ...(system.timber ? {} : { assembly: 'reinforced_concrete' }) })
    for (const wall of beside) builder.rest(lintel, context.wallParts.get(wall.id) as StructurePart, system.joints.beam)
    for (const plate of context.plates.get(door.floor) ?? []) if (overlapsInPlan(plate.aabb, box)) builder.rest(plate, lintel, system.joints.beam)
  }
}

const overlapsInPlan = (a: Rect, b: Rect): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
