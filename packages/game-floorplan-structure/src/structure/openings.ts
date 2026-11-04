import { GROUND } from '../types'
import type { Opening, Rect, SourceDoor, StructurePart } from '../types'
import type { BuildContext, BuildWall } from './context'
import { WALL_PILLAR_SIDE } from './wall-pillars'

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
    // h = L/10 of reinforced concrete: a wide door (a garage) needs a deeper lintel
    const depth = Math.max(LINTEL_DEPTH, (door.width + LINTEL_BEARING) / 10)
    const lintel = builder.add({ id: `lintel_${door.id}`, role: 'beam', material: system.timber ? construction.frame.timber : 'concrete', aabb: box, y0, y1: y0 + depth }, { floor: door.floor, ...(system.timber ? {} : { assembly: 'reinforced_concrete' }) })
    for (const wall of beside) builder.rest(lintel, context.wallParts.get(wall.id) as StructurePart, system.joints.beam)
    // the pillars at the jambs carry the lintel too (confined masonry: a wide door rests on the frame, not on the bricks alone)
    const jambs = (context.pillars.get(door.floor) ?? []).filter((pillar) => pillar.material === 'concrete' && overlapsInPlan(pillar.aabb, box) && pillar.y1 >= y0)
    if (construction.system === 'masonry' && hi - lo > WIDE_DOOR) jambs.push(...addJambPillars(context, { door, beside, from, to, cross }, jambs))
    for (const pillar of jambs) builder.rest(lintel, pillar, 'rebar')
    for (const plate of context.plates.get(door.floor) ?? []) if (overlapsInPlan(plate.aabb, box)) builder.rest(plate, lintel, system.joints.beam)
  }
}

/** A lintel longer than this (metres) does not rest on masonry alone: it gets a concrete pillar at each jamb that has none (`MAX_LINTEL_ON_MASONRY` of the validator). */
const WIDE_DOOR = 3
const HALF_PILLAR = WALL_PILLAR_SIDE / 2

interface DoorGap {
  door: SourceDoor
  beside: BuildWall[]
  from: number
  to: number
  cross: number
}

/** Concrete pillars in the walls at the jambs of a wide door (an inner door has none of the exterior walls' pillars), from the floor to the top of the wall. */
function addJambPillars(context: BuildContext, gap: DoorGap, standing: readonly StructurePart[]): StructurePart[] {
  const { builder, construction } = context
  const top = Math.max(...gap.beside.map((w) => context.wallParts.get(w.id)!.y1))
  const base = context.baseOf(gap.door.floor)
  const out: StructurePart[] = []
  for (const [k, along] of ([[0, gap.from - HALF_PILLAR], [1, gap.to + HALF_PILLAR]] as const)) {
    const [u, v] = gap.door.axis === 'u' ? [along, gap.cross] : [gap.cross, along]
    const box: Rect = [u - HALF_PILLAR, v - HALF_PILLAR, u + HALF_PILLAR, v + HALF_PILLAR]
    if (standing.some((p) => overlapsInPlan(p.aabb, box))) continue
    const pillar = builder.add({ id: `jamb_column_${gap.door.id}_${k}`, role: 'column', material: construction.frame.pillars, aabb: box, y0: context.level(gap.door.floor), y1: top }, { floor: gap.door.floor })
    builder.rest(pillar, base === GROUND || !base ? GROUND : base, 'rebar')
    out.push(pillar)
  }
  return out
}

const overlapsInPlan = (a: Rect, b: Rect): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
