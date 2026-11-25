import type { ResultItem } from '@adatechnology/game-floorplan'
import type { StructuredResult } from '@adatechnology/game-floorplan-structure'

/**
 * Plan-level layout checks (no GPU): the boxes of what a generated house holds, read from the plan, must not run into each other, into the walls,
 * nor into the space a door or drawer needs to open; exposed pipes never cross a doorway. Each exemption is listed where it is made.
 */

/** A box in the plan's frame: `u` along the facade, `v` to the back, `y` up from the storey's floor. */
export interface Box {
  readonly u0: number
  readonly v0: number
  readonly y0: number
  readonly u1: number
  readonly v1: number
  readonly y1: number
}

export type DefectKind = 'item_item' | 'item_wall' | 'wall_mounted' | 'opening_blocked' | 'pipe_door' | 'counter_top'

export interface Defect {
  readonly kind: DefectKind
  readonly a: string
  readonly b: string
  /** How far they run into each other, metres (the smallest of the three axes). */
  readonly depth: number
}

/** Overlap the plan's 1 cm rounding can make between two things that only touch. */
export const TOLERANCE = 0.011
/** Thickness of the lot's walls the yard zones are inset by (`WALL_THICKNESS` of game-floorplan). */
const YARD_WALL = 0.15
/** Gap two wall-mounted things keep between them. */
export const WALL_MOUNT_GAP = 0.02

/**
 * Depth in front of an item that its doors or drawers sweep, with the reach to use them (metres): the rule this test holds the plan to. The catalogue
 * declares its own `opening` (what the fill keeps clear), which must be at least this.
 */
export const OPENING_RULE: Readonly<Record<string, number>> = {
  nightstand: 0.45, dresser: 0.5, wardrobe: 0.5, wardrobe_large: 0.5, kitchen_cabinet: 0.5, fridge: 0.6, pantry: 0.5, laundry_cabinet: 0.45, washing_machine: 0.5,
  sideboard: 0.4, buffet: 0.45, china_cabinet: 0.45, tv_unit: 0.4, filing_cabinet: 0.5, stove: 0.5,
}

/** Counters set side by side along a wall: their worktops must be one height (or the two kept apart). */
const COUNTERS = new Set(['kitchen_cabinet', 'stove', 'workbench', 'laundry_tub', 'washing_machine', 'gourmet'])

/** Height of a door opening when the plan does not give one, metres. */
const DOOR_HEIGHT = 2.1
/** How far past the wall's faces a door's frame and its swinging leaf reach: a pipe in this box crosses the doorway. */
const DOOR_FRAME_REACH = 0.15

const overlapDepth = (a: Box, b: Box): number => Math.min(a.u1 - b.u0, b.u1 - a.u0, a.v1 - b.v0, b.v1 - a.v0, a.y1 - b.y0, b.y1 - a.y0)
const inflate = (b: Box, by: number): Box => ({ u0: b.u0 - by, v0: b.v0 - by, y0: b.y0 - by, u1: b.u1 + by, v1: b.v1 + by, y1: b.y1 + by })

interface Thing {
  readonly id: string
  readonly floor: number
  readonly box: Box
  readonly item?: ResultItem
}

type Wall = { readonly floor: number; readonly axis: 'u' | 'v'; readonly u0: number; readonly v0: number; readonly u1: number; readonly v1: number; readonly thickness: number; readonly h: number; readonly id: string }

const wallBox = (w: Wall): Box =>
  w.axis === 'u'
    ? { u0: Math.min(w.u0, w.u1), u1: Math.max(w.u0, w.u1), v0: w.v0 - w.thickness / 2, v1: w.v0 + w.thickness / 2, y0: 0, y1: w.h }
    : { u0: w.u0 - w.thickness / 2, u1: w.u0 + w.thickness / 2, v0: Math.min(w.v0, w.v1), v1: Math.max(w.v0, w.v1), y0: 0, y1: w.h }

const itemBox = (m: ResultItem): Box => {
  const r = m.aabb as [number, number, number, number]
  const y = m.y ?? 0
  return { u0: r[0], v0: r[1], u1: r[2], v1: r[3], y0: y, y1: y + m.h }
}

/** The storey a thing is on: the yard (`-1`) is compared with the ground floor's walls. */
const storeyOf = (floor: number | undefined): number => Math.max(0, floor ?? 0)

const isWallMounted = (m: ResultItem): boolean => m.mount === 'wall' || m.mount === 'window'

/** The id of the item a thing stands on (`supportId`, or the slot it was filled `on`). */
function parentOf(m: ResultItem, ids: ReadonlySet<string>): string | null {
  if (typeof m.supportId === 'string') return m.supportId
  if (!m.on) return null
  return ids.has(m.on) ? m.on : `${m.room}.${m.on}`
}

/** Plate of a socket or switch (`WALL_PLATE` of `game-interactables-household`): 7.5 x 12 cm standing 1.2 cm off the wall's face. */
const PLATE = { halfWidth: 0.0375, halfHeight: 0.06, depth: 0.015 }

interface Fixture {
  readonly u: number
  readonly v: number
  readonly y: number
  readonly c: number
  readonly axis: 'u' | 'v'
  readonly frontU: number
  readonly frontV: number
}

/** A box standing off a wall at a fixture's point: `along` either side of it, `y0`..`y1`, from `back` behind the point to `out` in front. */
function offWall(f: Fixture, along: number, y0: number, y1: number, back: number, out: number): Box {
  if (f.axis === 'u') {
    const a = f.v - f.frontV * back
    const b = f.v + f.frontV * out
    return { u0: f.u - along, u1: f.u + along, v0: Math.min(a, b), v1: Math.max(a, b), y0, y1 }
  }
  const a = f.u - f.frontU * back
  const b = f.u + f.frontU * out
  return { u0: Math.min(a, b), u1: Math.max(a, b), v0: f.v - along, v1: f.v + along, y0, y1 }
}

/** The installation's wall fixtures: sockets, switches and the panel with its open door. */
function fixturesOf(result: StructuredResult, panelEnvelope: PanelEnvelope): Thing[] {
  const electrical = result.utilities.electrical
  const out: Thing[] = []
  for (const f of [...electrical.outlets, ...electrical.switches]) {
    out.push({ id: f.id, floor: storeyOf(f.floor), box: offWall(f, PLATE.halfWidth, f.y - PLATE.halfHeight, f.y + PLATE.halfHeight, 0.012, PLATE.depth - 0.012) })
  }
  const panel = electrical.panel
  if (panel) {
    const e = panelEnvelope
    out.push({ id: 'panel', floor: storeyOf(panel.floor), box: offWall(panel, e.halfWidth, panel.y - e.below, panel.y + e.above, 0.012, e.depth) })
    out.push({ id: 'panel.door_swing', floor: storeyOf(panel.floor), box: offWall(panel, e.halfWidth + e.doorSide, panel.y - e.below, panel.y + e.above, 0.012, e.depth + e.doorReach) })
  }
  return out
}

/** The room the panel and its open door take on the wall (metres), as the structure pack declares it. */
export interface PanelEnvelope {
  readonly halfWidth: number
  readonly below: number
  readonly above: number
  readonly depth: number
  readonly doorReach: number
  readonly doorSide: number
}

/** Items of the plan and of its outbuildings, each with its box. */
function itemsOf(result: StructuredResult): Thing[] {
  const out: Thing[] = result.items.map((m) => ({ id: m.id, floor: storeyOf(m.floor), box: itemBox(m), item: m }))
  for (const building of result.outbuildings) {
    for (const m of building.items) {
      const id = `${building.id}.${m.type}`
      const item = { id, type: m.type, category: m.category, x: m.u, z: m.v, ry: m.ry, w: m.w, d: m.d, h: m.h, y: 0, frontU: m.frontU, frontV: m.frontV, room: building.id, floor: 0, outdoor: false, aabb: m.aabb } as ResultItem
      out.push({ id, floor: 0, box: itemBox(item), item })
    }
  }
  return out
}

function wallsOf(result: StructuredResult): Wall[] {
  const walls: Wall[] = result.walls.filter((w) => w.type === 'wall').map((w, i) => ({ floor: w.floor, axis: w.axis, u0: w.u0, v0: w.v0, u1: w.u1, v1: w.v1, thickness: w.thickness, h: w.h ?? 2.8, id: `wall${i}` }))
  for (const building of result.outbuildings) building.walls.forEach((w, i) => walls.push({ floor: 0, axis: w.axis, u0: w.u0, v0: w.v0, u1: w.u1, v1: w.v1, thickness: w.thickness, h: w.h, id: `${building.id}.wall${i}` }))
  return walls
}

/**
 * Items that are not solid bodies for these checks: flat ground covers (rugs, decks, the pergola's roof), holes in the ground (pools, height 0), the
 * outbuilding's own box (its walls and furniture are checked one by one) and what is hidden inside another (a cylinder under the counter).
 */
const isBody = (m: ResultItem): boolean => !m.flat && m.h > 0 && m.category !== 'outbuilding' && m.mount !== 'roof' && !m.hidden

/** Front of an item: the strip its doors and drawers open into, `depth` deep, as wide as the item less 2 cm a side, from its floor to its top. */
function openingBox(m: ResultItem, depth: number): Box {
  const r = m.aabb as [number, number, number, number]
  const fu = m.frontU ?? 0
  const fv = m.frontV ?? 1
  const y0 = (m.y ?? 0) + 0.02
  const y1 = (m.y ?? 0) + m.h
  if (fv !== 0) {
    const edge = fv > 0 ? r[3] : r[1]
    return { u0: r[0] + 0.02, u1: r[2] - 0.02, v0: Math.min(edge, edge + fv * depth), v1: Math.max(edge, edge + fv * depth), y0, y1 }
  }
  const edge = fu > 0 ? r[2] : r[0]
  return { u0: Math.min(edge, edge + fu * depth), u1: Math.max(edge, edge + fu * depth), v0: r[1] + 0.02, v1: r[3] - 0.02, y0, y1 }
}

/** Where a segment from `p` to `q` runs through a box (slab test), or `null`. */
function segmentHits(p: readonly number[], q: readonly number[], b: Box): boolean {
  let t0 = 0
  let t1 = 1
  const lo = [b.u0, b.y0, b.v0]
  const hi = [b.u1, b.y1, b.v1]
  for (let k = 0; k < 3; k++) {
    const d = q[k]! - p[k]!
    if (Math.abs(d) < 1e-9) {
      if (p[k]! <= lo[k]! || p[k]! >= hi[k]!) return false
      continue
    }
    let a = (lo[k]! - p[k]!) / d
    let c = (hi[k]! - p[k]!) / d
    if (a > c) [a, c] = [c, a]
    t0 = Math.max(t0, a)
    t1 = Math.min(t1, c)
    if (t0 >= t1) return false
  }
  return true
}

/** Doorway boxes of the house and of its outbuildings, `[u, y, v]` ordering of `segmentHits`. */
function doorwaysOf(result: StructuredResult): { id: string; floor: number; box: Box }[] {
  const out: { id: string; floor: number; box: Box }[] = []
  const add = (id: string, floor: number, d: { axis: 'u' | 'v'; pos: number; at: number; width: number; height?: number }): void => {
    const half = 0.17 / 2 + DOOR_FRAME_REACH
    const h = d.height ?? DOOR_HEIGHT
    const box: Box = d.axis === 'u' ? { u0: d.at - d.width / 2, u1: d.at + d.width / 2, v0: d.pos - half, v1: d.pos + half, y0: 0, y1: h } : { u0: d.pos - half, u1: d.pos + half, v0: d.at - d.width / 2, v1: d.at + d.width / 2, y0: 0, y1: h }
    out.push({ id, floor, box })
  }
  for (const d of result.doors) add(d.id, d.floor, d as never)
  for (const building of result.outbuildings) for (const d of building.doors) add(d.id, 0, d as never)
  return out
}

/** Exposed runs: the copper gas line, the exposed conduits and the visible water pipes (the ones in the wall excepted), `[u, v, y]` with `y` from the storey's floor. */
function exposedRunsOf(result: StructuredResult): { id: string; floor: number; points: [number, number, number][] }[] {
  const out: { id: string; floor: number; points: [number, number, number][] }[] = []
  const y0Of = (floor: number): number => result.floors[floor]?.y0 ?? 0
  const storeyAt = (y: number): number => {
    let f = 0
    result.floors.forEach((s, i) => {
      if (y >= s.y0 - 0.05) f = i
    })
    return f
  }
  for (const m of result.items) {
    const route = (m as { pipe?: { route?: [number, number, number][] } }).pipe?.route
    if (route) out.push({ id: `${m.id}.pipe`, floor: storeyOf(m.floor), points: route })
  }
  const absolute = (id: string, points: readonly (readonly number[])[]): void => {
    const floor = storeyAt(Math.min(...points.map((p) => p[2]!)))
    out.push({ id, floor, points: points.map((p) => [p[0]!, p[1]!, p[2]! - y0Of(floor)]) })
  }
  for (const c of result.utilities.electrical.conduits) if (c.exposed) absolute(c.id, c.points)
  for (const r of result.utilities.plumbing.visibleRuns) if (r.exposed !== 'wall') absolute(r.id, r.points)
  return out
}

/** Every layout defect of a generated house. */
export function layoutDefectsOf(result: StructuredResult, panelEnvelope: PanelEnvelope): Defect[] {
  const defects: Defect[] = []
  const things = itemsOf(result)
  const ids = new Set(things.map((t) => t.id))
  const parent = new Map(things.map((t) => [t.id, t.item ? parentOf(t.item, ids) : null]))
  const related = (a: string, b: string): boolean => parent.get(a) === b || parent.get(b) === a || (parent.get(a) != null && parent.get(a) === parent.get(b))
  const bodies = things.filter((t) => t.item && isBody(t.item))
  // (a) no two bodies run into each other; exempt: a thing and what it stands on (or two things on one support)
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!
      const b = bodies[j]!
      if (a.floor !== b.floor || related(a.id, b.id)) continue
      const depth = overlapDepth(a.box, b.box)
      if (depth > TOLERANCE) defects.push({ kind: 'item_item', a: a.id, b: b.id, depth })
    }
  }
  // (b) no body runs into a wall; a wall-mounted thing touching its wall's face is within the tolerance
  const walls = wallsOf(result)
  for (const t of bodies) {
    for (const w of walls) {
      if (w.floor !== t.floor) continue
      const depth = overlapDepth(t.box, wallBox(w))
      // known debt: a yard zone is inset by the lot's 15 cm walls, so an item backed on the house's thicker wall goes the difference into it (widening the
      // margin of the yard dropped the cars from the garages); only that difference is let through
      const yardDebt = t.item?.outdoor ? Math.max(0, (w.thickness - YARD_WALL) / 2) : 0
      if (depth > TOLERANCE + yardDebt) defects.push({ kind: 'item_wall', a: t.id, b: w.id, depth })
    }
  }
  // (c) wall-mounted things keep a small gap: decor on the walls and at the windows, sockets, switches, the panel and its open door
  const mounted: Thing[] = things.filter((t) => t.item && isWallMounted(t.item)).concat(fixturesOf(result, panelEnvelope))
  for (let i = 0; i < mounted.length; i++) {
    for (let j = i + 1; j < mounted.length; j++) {
      const a = mounted[i]!
      const b = mounted[j]!
      if (a.floor !== b.floor || (a.id === 'panel' && b.id === 'panel.door_swing') || (b.id === 'panel' && a.id === 'panel.door_swing')) continue
      const depth = overlapDepth(inflate(a.box, WALL_MOUNT_GAP / 2), inflate(b.box, WALL_MOUNT_GAP / 2))
      if (depth > 0) defects.push({ kind: 'wall_mounted', a: a.id, b: b.id, depth })
    }
  }
  // (d) what a door or drawer opens into is free of walls and bodies; exempt: what stands on the item itself, and things over or under the front's height
  for (const t of things) {
    const m = t.item
    const depth = m && OPENING_RULE[m.category]
    if (!m || !depth || m.decor || parentOf(m, ids)) continue
    const front = openingBox(m, depth)
    for (const w of walls) {
      if (w.floor !== t.floor) continue
      const d = overlapDepth(front, wallBox(w))
      if (d > TOLERANCE) defects.push({ kind: 'opening_blocked', a: t.id, b: w.id, depth: d })
    }
    for (const o of bodies) {
      if (o.id === t.id || o.floor !== t.floor || related(o.id, t.id)) continue
      const d = overlapDepth(front, o.box)
      if (d > TOLERANCE) defects.push({ kind: 'opening_blocked', a: t.id, b: o.id, depth: d })
    }
  }
  // (e) exposed pipes and conduits never cross a doorway (its opening, frame and leaf)
  const doorways = doorwaysOf(result)
  for (const run of exposedRunsOf(result)) {
    for (const door of doorways) {
      if (door.floor !== run.floor) continue
      for (let k = 0; k + 1 < run.points.length; k++) {
        const p = run.points[k]!
        const q = run.points[k + 1]!
        if (segmentHits([p[0], p[2], p[1]], [q[0], q[2], q[1]], door.box)) {
          defects.push({ kind: 'pipe_door', a: run.id, b: door.id, depth: 0 })
          break
        }
      }
    }
  }
  // (f) counters side by side (closer than 5 cm) share their worktop's height
  const counters = bodies.filter((t) => t.item && COUNTERS.has(t.item.category) && !parentOf(t.item, ids))
  for (let i = 0; i < counters.length; i++) {
    for (let j = i + 1; j < counters.length; j++) {
      const a = counters[i]!
      const b = counters[j]!
      if (a.floor !== b.floor || a.item!.room !== b.item!.room) continue
      if (overlapDepth(inflate(a.box, 0.025), inflate(b.box, 0.025)) <= 0) continue
      const step = Math.abs(a.box.y1 - b.box.y1)
      if (step > TOLERANCE) defects.push({ kind: 'counter_top', a: a.id, b: b.id, depth: step })
    }
  }
  return defects
}
