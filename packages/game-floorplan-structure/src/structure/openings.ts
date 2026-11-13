import { GROUND } from '../types'
import type { Opening, Rect, SourceDoor, StructurePart } from '../types'
import { getMasonryUnit, MORTAR_JOINT } from '../masonry-units'
import { pillarBox } from './context'
import type { BuildContext, BuildWall } from './context'

const TOLERANCE = 0.02
/** Height of a door leaf, which the plan does not store (m). */
export const DOOR_HEIGHT = 2.1
const LINTEL_DEPTH = 0.2
const LINTEL_BEARING = 0.2

/**
 * Structural masonry is laid in whole courses: the height of one with its joint (20 cm for a 19 cm block), or nothing for other walls. The door's head and its
 * lintel (a course of channel blocks, or more for a wide door) land on them.
 */
function courseOf(context: BuildContext): number | undefined {
  const unit = context.construction.walls.unit
  return context.structural && unit !== undefined ? Math.round((getMasonryUnit(unit).height + MORTAR_JOINT) * 100) / 100 : undefined
}

/** Height of the head of a door over its floor: `DOOR_HEIGHT`, raised to the next course in structural masonry (2.20 m on 20 cm courses). */
export function doorHeadOf(context: BuildContext): number {
  const course = courseOf(context)
  return course === undefined ? DOOR_HEIGHT : Math.round(Math.ceil(DOOR_HEIGHT / course - 1e-6) * course * 100) / 100
}

/** The masonry gaps of the doors of structural masonry, each as an opening of the wall at its start side: its jambs, its floor and its head. */
function doorOpenings(context: BuildContext): Opening[] {
  if (!context.structural) return []
  const out: Opening[] = []
  for (const door of context.source.doors.filter((d) => d.a !== undefined && d.type !== 'zipper')) {
    const along = door.axis === 'u' ? door.u : door.v
    const cross = door.axis === 'u' ? door.v : door.u
    const [from, to] = [along - door.width / 2, along + door.width / 2]
    const beside = context.walls.filter((w) => w.floor === door.floor && w.axis === door.axis && w.type === 'wall' && Math.abs(crossOf(w) - cross) <= TOLERANCE)
    const wall = beside.find((w) => Math.abs(alongRange(w)[1] - from) <= 0.05) ?? beside.find((w) => Math.abs(alongRange(w)[0] - to) <= 0.05)
    if (!wall) continue
    const base = context.level(door.floor)
    out.push({ id: door.id, kind: 'door', wall: wall.id, from, to, y0: base, y1: base + doorHeadOf(context) })
  }
  return out
}

const crossOf = (wall: BuildWall): number => (wall.axis === 'u' ? wall.v0 : wall.u0)
const alongRange = (wall: BuildWall): [number, number] => (wall.axis === 'u' ? [Math.min(wall.u0, wall.u1), Math.max(wall.u0, wall.u1)] : [Math.min(wall.v0, wall.v1), Math.max(wall.v0, wall.v1)])

/** The windows of the plan, each in the wall it sits in, and (structural masonry) the doors. */
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
  return [...openings, ...doorOpenings(context)]
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
    const y0 = context.level(door.floor) + doorHeadOf(context)
    // h = L/10 of reinforced concrete: a wide door (a garage) needs a deeper lintel; in structural masonry, whole courses of channel blocks
    const course = courseOf(context)
    const needed = Math.max(LINTEL_DEPTH, (door.width + LINTEL_BEARING) / 10)
    const depth = course === undefined ? needed : Math.round(Math.ceil(needed / course - 1e-6) * course * 100) / 100
    const lintel = builder.add({ id: `lintel_${door.id}`, role: 'beam', material: system.timber ? construction.frame.timber : 'concrete', aabb: box, y0, y1: y0 + depth }, { floor: door.floor, ...(system.timber ? {} : { assembly: 'reinforced_concrete' }) })
    for (const wall of beside) builder.rest(lintel, context.wallParts.get(wall.id) as StructurePart, system.joints.beam)
    // the pillars at the jambs carry the lintel too (confined masonry: a wide door rests on the frame, not on the bricks alone)
    const jambs = (context.pillars.get(door.floor) ?? []).filter((pillar) => pillar.material === 'concrete' && overlapsInPlan(pillar.aabb, box) && pillar.y1 >= y0)
    if (construction.system === 'masonry' && !context.structural && hi - lo > WIDE_DOOR) jambs.push(...addJambPillars(context, { door, beside, from, to, cross }, jambs))
    for (const pillar of jambs) builder.rest(lintel, pillar, 'rebar')
    // the masonry over the door, from the lintel to the bond beam (encunhamento), laid as the wall beside it: the bond beam bears on it, it on the lintel
    const host = context.wallParts.get(beside[0]!.id)
    const top = Math.max(...beside.map((w) => context.wallParts.get(w.id)?.y1 ?? 0))
    const header = host && !context.visorSections && top - (y0 + depth) > MIN_HEADER ? addDoorHeader(context, { door, host, lintel, top, box: door.axis === 'u' ? [from, cross - half, to, cross + half] : [cross - half, from, cross + half, to] }) : null
    // a plate rests on the masonry over the door where it lies over it, else on the lintel's bearing in the wall (a plate of the wall across the door's end)
    for (const plate of context.plates.get(door.floor) ?? []) {
      if (!overlapsInPlan(plate.aabb, box)) continue
      const onHeader = header !== null && overlapsInPlan(plate.aabb, header.aabb)
      builder.rest(plate, onHeader ? header : lintel, onHeader ? context.system.joints.wall : system.joints.beam)
    }
  }
}

/** Least height (metres) left between a door's lintel and the bond beam that gets masonry of its own; under it the bond beam takes the lintel. */
const MIN_HEADER = 0.04

/** The masonry over a door, between its lintel and the top of the wall beside it: the same build as that wall, on the lintel. */
function addDoorHeader(context: BuildContext, over: { door: SourceDoor; host: StructurePart; lintel: StructurePart; top: number; box: Rect }): StructurePart {
  const { door, host, lintel, top, box } = over
  const header = context.builder.add(
    { id: `wall_${door.floor}_over_${door.id}`, role: host.role, material: host.material, aabb: box, y0: lintel.y1, y1: top },
    { floor: door.floor, ...(host.assembly ? { assembly: host.assembly } : {}), ...(host.exterior ? { exterior: host.exterior } : {}) },
  )
  context.builder.rest(header, lintel, context.system.joints.wall)
  return header
}

/** A lintel longer than this (metres) does not rest on masonry alone: it gets a concrete pillar at each jamb that has none (`MAX_LINTEL_ON_MASONRY` of the validator). */
const WIDE_DOOR = 3

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
  const HALF_PILLAR = context.pillar.along / 2
  for (const [k, along] of ([[0, gap.from - HALF_PILLAR], [1, gap.to + HALF_PILLAR]] as const)) {
    const [u, v] = gap.door.axis === 'u' ? [along, gap.cross] : [gap.cross, along]
    const box: Rect = pillarBox(context.pillar, u, v, gap.door.axis === 'u')
    if (standing.some((p) => overlapsInPlan(p.aabb, box))) continue
    const pillar = builder.add({ id: `jamb_column_${gap.door.id}_${k}`, role: 'column', material: construction.frame.pillars, aabb: box, y0: context.level(gap.door.floor), y1: top }, { floor: gap.door.floor })
    builder.rest(pillar, base === GROUND || !base ? GROUND : base, 'rebar')
    out.push(pillar)
  }
  return out
}

const overlapsInPlan = (a: Rect, b: Rect): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
