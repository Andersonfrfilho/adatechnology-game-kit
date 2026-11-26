/**
 * Where the pipes and the conduits of a house really run, from the plan's network: the water leaves the tank, crosses the attic over the ceiling slab and
 * goes down inside the wall nearest each tap, shower or toilet; the conduits rise from the breaker panel inside its wall to the attic, cross it and go down
 * inside the wall of each switch and outlet, or through the slab to each ceiling light. Nothing crosses a room in the air, and the same run is drawn in the
 * rough-in stage (cut into the bare masonry) and, embedded, in the finished house: one network, laid once.
 */

import { PLASTER_PER_FACE } from '@adatechnology/game-floorplan-structure'

/** A point of a run in the house's frame: [x (u), y, z (v)]. */
export type RoutePoint = readonly [number, number, number]
export type Route = readonly RoutePoint[]

export interface RoutingWall {
  readonly floor: number
  readonly axis: 'u' | 'v'
  readonly u0: number
  readonly v0: number
  readonly u1: number
  readonly v1: number
  readonly thickness?: number
  readonly outbuilding?: string
}

export interface RoutingOpening {
  readonly floor: number
  readonly axis: 'u' | 'v'
  readonly pos: number
  readonly at: number
  readonly width: number
  /** A window's sill and head over its storey's floor, metres (a tall window of a double-height room reaches into the storey over it). */
  readonly y0?: number
  readonly y1?: number
}

export interface RoutingPlan {
  readonly walls: readonly RoutingWall[]
  readonly openings: readonly RoutingOpening[]
  readonly floors: readonly { readonly y0: number; readonly ceiling: number }[]
  /** The pipes already buried in the yard (the sewer), as stretches between points [u, y, v]: a feed keeps its trench and boxes clear of them. */
  readonly buried?: readonly { readonly a: RoutePoint; readonly b: RoutePoint }[]
}

/** How far the water and the conduits lie over the top ceiling slab, metres: on it, the conduits a hand over the water so the two never share a line. */
export const ATTIC_LIFT = { water: 0.03, conduit: 0.07 } as const
/** Depth of the buried sewer runs, metres under the ground. */
export const BURIED_Y = -0.35
/** Depth of an electrical feed buried across the yard, metres: NBR 5410 asks at least 0.6 m under the ground where people walk. */
export const FEED_Y = -0.6
/** Where a feed leaves a wall at its foot, metres: just under the floor, through the wall's base into the ground box beside it. */
export const FEED_EXIT_Y = -0.15
/** How far the centre of the ground box at the foot of a wall stands off the wall's face, metres. */
export const FEED_BOX_OFFSET = 0.25
/**
 * How deep under the wall's finished face the axis of a run cut into the masonry lies, metres: the render over the brick, the run's radius and a clearance, so the
 * run lies wholly in its chase under the render (at 1.4 cm, half in the render, the pipe's face was 1.5 mm under it and showed through; a sleeve came out of it).
 */
export function chaseDepth(diameter = CHASE_DIAMETER): number {
  // (its axis a whole diameter in, so its face half a diameter under the clearance: two runs of different sizes crossing in one wall never show faces on one plane)
  return PLASTER_PER_FACE + CHASE_CLEAR + diameter
}
/** The run a chase is cut for when the caller does not say (m): a 25 mm water pipe, the thicker of the runs in a wall. */
const CHASE_DIAMETER = 0.025
/** Brick left between a run in its chase and the render, metres (the sleeve over a joint is a little wider than the pipe). */
const CHASE_CLEAR = 0.006
/** How far under the top of a slab a run crosses it, metres: through the middle of its thickness. */
export const SLAB_MIDDLE = 0.065
/** A ceiling this close to a storey's floor (under it, or a little over it where a plan's storey is lower than the ceiling under it) hangs from that storey's slab, metres. */
const CEILING_SLAB = 0.5
/** How far from a wall's ends a run passing down a storey (to a lower one) keeps, metres: clear of the pillar there and the masonry's end against it. */
const PASSING_END_CLEAR = { water: 0.335, conduit: 0.485 } as const
/** How far over (+) or under (-) the slab's middle each network crosses inside it, metres: the water and the conduits never share a line. */
export const SLAB_LIFT = { water: -0.02, conduit: 0.015 } as const
const OPENING_CLEARANCE = 0.12
/** How far from a wall's ends a run keeps by default, metres. */
const DEFAULT_END_CLEAR = 0.1

const DEFAULT_THICKNESS = 0.15

/** Height of the attic floor: the top of the top storey's ceiling slab. */
export function atticFloor(plan: RoutingPlan): number {
  const top = plan.floors[plan.floors.length - 1]
  return top ? top.y0 + top.ceiling : 2.8
}

/** The walls of the house proper (not of an outbuilding) of a storey. */
const houseWalls = (plan: RoutingPlan, floor: number): readonly RoutingWall[] => plan.walls.filter((w) => w.floor === floor && !w.outbuilding)

/** The plan box of the house proper's walls on the ground floor. */
export function houseFootprint(plan: RoutingPlan): readonly [number, number, number, number] {
  const walls = houseWalls(plan, 0)
  if (!walls.length) return [0, 0, 0, 0]
  return [Math.min(...walls.map((w) => w.u0)), Math.min(...walls.map((w) => w.v0)), Math.max(...walls.map((w) => w.u1)), Math.max(...walls.map((w) => w.v1))]
}

const inside = (box: readonly number[], u: number, v: number, margin: number): boolean => u >= box[0]! - margin && u <= box[2]! + margin && v >= box[1]! - margin && v <= box[3]! + margin

/** True when an opening stands in a storey's height: its own storey, or one over it a tall window reaches into. */
function reaches(plan: RoutingPlan, opening: RoutingOpening, floor: number): boolean {
  if (opening.floor === floor) return true
  if (opening.floor > floor || opening.y1 === undefined) return false
  return (plan.floors[opening.floor]?.y0 ?? 0) + opening.y1 > (plan.floors[floor]?.y0 ?? 0)
}

/** A wall's along range, moved off any door or window in it (a pipe never goes down through an opening). */
function clearOfOpenings(plan: RoutingPlan, wall: RoutingWall, along: number, endClear = DEFAULT_END_CLEAR): number {
  const line = wall.axis === 'u' ? wall.v0 : wall.u0
  const a0 = wall.axis === 'u' ? wall.u0 : wall.v0, a1 = wall.axis === 'u' ? wall.u1 : wall.v1
  // clear of the ends first, then of the openings (a run moved off a window never goes back into it)
  let at = endClear > DEFAULT_END_CLEAR ? Math.max(a0 + endClear, Math.min(a1 - endClear, along)) : along
  for (const o of plan.openings) {
    if (o.axis !== wall.axis || Math.abs(o.pos - line) > 0.05 || !reaches(plan, o, wall.floor)) continue
    const lo = o.at - o.width / 2 - OPENING_CLEARANCE, hi = o.at + o.width / 2 + OPENING_CLEARANCE
    if (at <= lo || at >= hi) continue
    const toLo = at - lo, toHi = hi - at
    at = (toLo <= toHi && lo >= a0 + 0.1) || hi > a1 - 0.1 ? lo : hi
  }
  return Math.max(a0 + DEFAULT_END_CLEAR, Math.min(a1 - DEFAULT_END_CLEAR, at))
}

export interface WallDrop {
  /** Where the run goes down, in plan: on the wall's line, moved off its openings, then to the face the target is on. */
  readonly u: number
  readonly v: number
  readonly wall: RoutingWall
}

/**
 * The spot of a wall where a run goes down to (u, v): the nearest wall of the storey, off its openings, in a chase on the face the point is on (`surface`: on
 * that face, for a conduit laid over the plaster).
 */
export function wallDrop(plan: RoutingPlan, floor: number, u: number, v: number, options: WallDropOptions = {}): WallDrop | null {
  let best: { wall: RoutingWall; along: number; distance: number } | null = null
  for (const w of options.walls ?? houseWalls(plan, Math.max(0, floor))) {
    const alongU = w.axis === 'u'
    const along = Math.max(alongU ? w.u0 : w.v0, Math.min(alongU ? w.u1 : w.v1, alongU ? u : v))
    const pu = alongU ? along : w.u0, pv = alongU ? w.v0 : along
    const distance = Math.hypot(u - pu, v - pv)
    if (!best || distance < best.distance - 1e-6) best = { wall: w, along, distance }
  }
  if (!best) return null
  const { wall } = best
  const alongU = wall.axis === 'u'
  const along = clearOfOpenings(plan, wall, best.along, options.endClear)
  const line = alongU ? wall.v0 : wall.u0
  // the face of the room the run serves: the side the point (or `toward`) is on; a point on the wall's line belongs to the inside of the building
  const [ru, rv] = options.toward ?? [u, v]
  const across = alongU ? rv - line : ru - line
  const box = buildingBox(plan, wall)
  const inward = (alongU ? (box[1] + box[3]) / 2 : (box[0] + box[2]) / 2) - line
  const side = Math.abs(across) > 1e-3 ? Math.sign(across) : inward >= 0 ? 1 : -1
  const half = (wall.thickness ?? DEFAULT_THICKNESS) / 2
  const offset = options.surface ? half + (options.diameter ?? 0.02) / 2 : half - chaseDepth(options.diameter)
  const at = line + side * offset
  return { u: alongU ? along : at, v: alongU ? at : along, wall }
}

/** Where to look for the wall a run goes down (the house's walls of the storey by default), and which face of it. */
export interface WallDropOptions {
  readonly surface?: boolean
  readonly diameter?: number
  /** The run serves the room on this point's side of the wall (the inside of the house, for a feed leaving it). */
  readonly toward?: readonly [number, number]
  readonly walls?: readonly RoutingWall[]
  /** How far from the wall's ends the run keeps, metres (0.1 by default): a run only passing down a storey keeps clear of the pillars at its ends. */
  readonly endClear?: number
}

/** The plan box of the building a wall belongs to: the house proper, or its outbuilding. */
function buildingBox(plan: RoutingPlan, wall: RoutingWall): readonly [number, number, number, number] {
  if (!wall.outbuilding) return houseFootprint(plan)
  const own = plan.walls.filter((w) => w.outbuilding === wall.outbuilding)
  return [Math.min(...own.map((w) => Math.min(w.u0, w.u1))), Math.min(...own.map((w) => Math.min(w.v0, w.v1))), Math.max(...own.map((w) => Math.max(w.u0, w.u1))), Math.max(...own.map((w) => Math.max(w.v0, w.v1)))]
}

/** The centre of a box. */
const centreOf = (box: readonly [number, number, number, number]): readonly [number, number] => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]

/** The point of a wall's foot outside it, `offset` off its outer face, at `drop`'s place along it: where the ground box of a feed stands. */
function outsideOf(drop: WallDrop, plan: RoutingPlan, offset: number): readonly [number, number] {
  const { wall } = drop
  const alongU = wall.axis === 'u'
  const line = alongU ? wall.v0 : wall.u0
  const box = buildingBox(plan, wall)
  const outward = (alongU ? (box[1] + box[3]) / 2 : (box[0] + box[2]) / 2) - line >= 0 ? -1 : 1
  const at = line + outward * ((wall.thickness ?? DEFAULT_THICKNESS) / 2 + offset)
  return alongU ? [drop.u, at] : [at, drop.v]
}

/**
 * A feed from the house to a building in the yard, as it is laid (NBR 5410): down inside the house's wall nearest it, on the room side; out at the wall's foot
 * into a ground box beside it; buried at `FEED_Y` across the yard; into a ground box at the other building's wall and up inside that wall. Starts at the house's
 * drop at the attic height, ends inside the other wall at `y`.
 */
function feedTo(plan: RoutingPlan, target: { readonly u: number; readonly v: number }, y: number, options: WallDropOptions): { readonly exit: WallDrop; readonly route: Route } | null {
  const first = wallDrop(plan, 0, target.u, target.v, { ...options, surface: false, toward: centreOf(houseFootprint(plan)) })
  if (!first) return null
  // along the house's wall from the spot nearest the target outwards: the first exit whose boxes and trench keep clear of the buried pipes
  const wall = first.wall, alongU = wall.axis === 'u'
  const a0 = alongU ? Math.min(wall.u0, wall.u1) : Math.min(wall.v0, wall.v1), a1 = alongU ? Math.max(wall.u0, wall.u1) : Math.max(wall.v0, wall.v1)
  const start = alongU ? first.u : first.v
  const tries = [start, ...Array.from({ length: Math.ceil((a1 - a0) / FEED_STEP) }, (_, k) => [start - (k + 1) * FEED_STEP, start + (k + 1) * FEED_STEP]).flat().filter((a) => a > a0 + 0.2 && a < a1 - 0.2)]
  let fallback: { exit: WallDrop; route: Route } | null = null
  for (const along of tries) {
    const exit = wallDrop(plan, 0, alongU ? along : first.u, alongU ? first.v : along, { ...options, surface: false, walls: [wall], toward: centreOf(houseFootprint(plan)) })
    if (!exit) continue
    for (const turnFirst of [false, true]) {
      const feed = feedFrom(plan, exit, target, y, { ...options, turnFirst })
      fallback ??= feed
      if (clearOfBuried(plan, feed.route)) return feed
    }
  }
  return fallback
}

/** Step along the house's wall between the exits a feed tries, metres. */
const FEED_STEP = 0.25
/**
 * How far a feed's ground box and trench keep from a buried pipe, metres: in plan for a box; in height where the trench crosses the pipe; and no more than
 * `alongside` of the trench within `beside` of a pipe (a crossing passes, a run along the sewer's trench does not).
 */
const FEED_CLEARANCE = { box: 0.45, crossing: 0.2, beside: 0.3, alongside: 0.6 } as const

/** The feed's run from the house's drop `exit`: out at the wall's foot, buried across, into the other building's wall facing it, up to `y`. */
function feedFrom(plan: RoutingPlan, exit: WallDrop, target: { readonly u: number; readonly v: number }, y: number, options: WallDropOptions & { readonly turnFirst?: boolean }): { readonly exit: WallDrop; readonly route: Route } {
  const [ou, ov] = outsideOf(exit, plan, FEED_BOX_OFFSET)
  // it goes into the other building by the wall that faces the house's box: the shortest trench
  const walls = plan.walls.filter((w) => w.outbuilding && w.floor === 0)
  const entry = walls.length ? wallDrop(plan, 0, ou, ov, { ...options, surface: false, walls, toward: centreOf(buildingBox(plan, walls[0]!)) }) : null
  if (!entry) return { exit, route: [[exit.u, FEED_EXIT_Y, exit.v], [ou, FEED_EXIT_Y, ov], [ou, FEED_Y, ov], [target.u, FEED_Y, ov], [target.u, FEED_Y, target.v], [target.u, y, target.v]] }
  const [iu, iv] = outsideOf(entry, plan, FEED_BOX_OFFSET)
  // the trench's one turn: along the house's wall first, or straight off it first (`turnFirst`), whichever keeps clear of the sewer
  const across: RoutePoint[] = Math.abs(iu - ou) > 1e-3 && Math.abs(iv - ov) > 1e-3 ? [options.turnFirst ? (exit.wall.axis === 'u' ? [ou, FEED_Y, iv] : [iu, FEED_Y, ov]) : (exit.wall.axis === 'u' ? [iu, FEED_Y, ov] : [ou, FEED_Y, iv])] : []
  return {
    exit,
    route: [[exit.u, FEED_EXIT_Y, exit.v], [ou, FEED_EXIT_Y, ov], [ou, FEED_Y, ov], ...across, [iu, FEED_Y, iv], [iu, FEED_EXIT_Y, iv], [entry.u, FEED_EXIT_Y, entry.v], [entry.u, y, entry.v]],
  }
}

/** Distance in plan from (u, v) to a stretch of pipe. */
function planDistance(u: number, v: number, a: RoutePoint, b: RoutePoint): number {
  const du = b[0] - a[0], dv = b[2] - a[2], length = du * du + dv * dv
  const t = length < 1e-9 ? 0 : Math.max(0, Math.min(1, ((u - a[0]) * du + (v - a[2]) * dv) / length))
  return Math.hypot(u - (a[0] + du * t), v - (a[2] + dv * t))
}

/** True when a feed's buried run keeps clear of the yard's buried pipes: its boxes away from them, its trench crossing none at the same height. */
function clearOfBuried(plan: RoutingPlan, route: Route): boolean {
  const pipes = plan.buried ?? []
  for (let i = 0; i + 1 < route.length; i++) {
    const p = route[i]!, q = route[i + 1]!
    const isBox = Math.hypot(p[0] - q[0], p[2] - q[2]) < 1e-3 && Math.min(p[1], q[1]) <= FEED_Y + 1e-6
    if (isBox && pipes.some(({ a, b }) => planDistance(p[0], p[2], a, b) < FEED_CLEARANCE.box)) return false
    if (p[1] > FEED_Y + 1e-6 || q[1] > FEED_Y + 1e-6) continue
    // never alongside a pipe: the feed's trench is its own
    const length = Math.hypot(q[0] - p[0], q[2] - p[2]), steps = Math.max(1, Math.ceil(length / 0.1))
    for (const { a, b } of pipes) {
      let near = 0
      for (let k = 0; k <= steps; k++) if (planDistance(p[0] + ((q[0] - p[0]) * k) / steps, p[2] + ((q[2] - p[2]) * k) / steps, a, b) < FEED_CLEARANCE.beside) near++
      if ((near * length) / steps > FEED_CLEARANCE.alongside) return false
    }
    for (const { a, b } of pipes) {
      const d = (q[0] - p[0]) * (b[2] - a[2]) - (q[2] - p[2]) * (b[0] - a[0])
      if (Math.abs(d) < 1e-9) continue
      const t = ((a[0] - p[0]) * (b[2] - a[2]) - (a[2] - p[2]) * (b[0] - a[0])) / d
      const s = ((a[0] - p[0]) * (q[2] - p[2]) - (a[2] - p[2]) * (q[0] - p[0])) / d
      if (t < 0 || t > 1 || s < 0 || s > 1) continue
      if (Math.abs(FEED_Y - (a[1] + (b[1] - a[1]) * s)) < FEED_CLEARANCE.crossing) return false
    }
  }
  return true
}

/** A door's opening is clear up to this height over its storey's floor, metres. */
const DOOR_HEAD = 2.1

/** True when a level stretch at height y, in plan from a to b, passes through a door or window (the plane of its wall, within its width and height). */
function crossesOpening(plan: RoutingPlan, a: readonly [number, number], b: readonly [number, number], y: number): boolean {
  return plan.openings.some((o) => {
    const base = plan.floors[o.floor]?.y0 ?? 0
    if (y <= base + (o.y0 ?? 0) || y >= base + (o.y1 ?? DOOR_HEAD)) return false
    const [p0, p1, q0, q1] = o.axis === 'u' ? [a[1], b[1], a[0], b[0]] : [a[0], b[0], a[1], b[1]]
    const across = Math.min(p0, p1) <= o.pos + 0.1 && Math.max(p0, p1) >= o.pos - 0.1
    return across && Math.max(Math.min(q0, q1), o.at - o.width / 2) < Math.min(Math.max(q0, q1), o.at + o.width / 2)
  })
}

/** A path inside a slab: the turn that keeps it out of a tall window's opening (a double-height room's glazing reaches the slab's height). */
function slabPath(plan: RoutingPlan, from: readonly [number, number], to: readonly [number, number], y: number, first: 'u' | 'v'): RoutePoint[] {
  const clear = (path: readonly RoutePoint[]): boolean => !path.slice(1).some((p, i) => crossesOpening(plan, [path[i]![0], path[i]![2]], [p[0], p[2]], y))
  for (const order of [first, first === 'u' ? 'v' : 'u'] as const) {
    const path = atticPath(from, to, y, order)
    if (clear(path)) return path
  }
  // both ends in the wall of the window: in from the wall, along the slab past the window, and back out to it
  const [cu, cv] = centreOf(houseFootprint(plan))
  const alongU = Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1])
  const step: readonly [number, number] = alongU ? [0, Math.sign(cv - from[1]) * SLAB_DETOUR] : [Math.sign(cu - from[0]) * SLAB_DETOUR, 0]
  return [[from[0], y, from[1]], [from[0] + step[0], y, from[1] + step[1]], [to[0] + step[0], y, to[1] + step[1]], [to[0], y, to[1]]]
}

/** How far into the slab a run steps from the wall to get round a tall window in it, metres. */
const SLAB_DETOUR = 0.6

/** A drop moved across its wall onto the wall's middle line. */
function toMiddle(drop: WallDrop): WallDrop {
  return drop.wall.axis === 'u' ? { ...drop, v: drop.wall.v0 } : { ...drop, u: drop.wall.u0 }
}

/** An orthogonal path over the attic floor, first along `first`, then the other axis. */
function atticPath(from: readonly [number, number], to: readonly [number, number], y: number, first: 'u' | 'v'): RoutePoint[] {
  const corner: readonly [number, number] = first === 'u' ? [to[0], from[1]] : [from[0], to[1]]
  const out: RoutePoint[] = [[from[0], y, from[1]]]
  if (Math.hypot(corner[0] - from[0], corner[1] - from[1]) > 1e-3 && Math.hypot(corner[0] - to[0], corner[1] - to[1]) > 1e-3) out.push([corner[0], y, corner[1]])
  out.push([to[0], y, to[1]])
  return out
}

export interface PointTarget {
  readonly u: number
  readonly v: number
  /** Height of the terminal (tap, outlet box) over the storey floor. */
  readonly y: number
  /** Storey of the terminal; -1 outdoors. */
  readonly floor: number
}

/**
 * The run from a spot of the attic (`from`, plan) to a terminal on a wall: across the attic, down inside the wall. A terminal outside the house proper (an
 * outbuilding, the yard) is reached under the ground: down the house's outer wall, buried across the yard and up the terminal's wall.
 */
export function routeToTerminal(plan: RoutingPlan, from: readonly [number, number], target: PointTarget, options: { readonly kind: 'water' | 'conduit'; readonly surface?: boolean; readonly diameter?: number }): Route {
  const attic = atticFloor(plan) + ATTIC_LIFT[options.kind]
  const first = options.kind === 'water' ? 'u' : 'v'
  const floor = Math.max(0, target.floor)
  const storey = plan.floors[floor]
  const y = (storey ? storey.y0 : 0) + target.y
  const footprint = houseFootprint(plan)
  if (inside(footprint, target.u, target.v, 0.4)) return descend(plan, from, target, { ...options, attic, first, y })
  // out of the house: down inside its wall nearest the terminal, buried across the yard, up inside the wall the terminal is on
  const feed = feedTo(plan, target, y, options)
  if (!feed) return []
  return [...atticPath(from, [feed.exit.u, feed.exit.v], attic, first), ...feed.route]
}

/**
 * From the attic down to a terminal of a lower storey: down inside the wall of each storey nearest the terminal, and where that wall is not over the wall of the
 * storey below, across inside the slab to it (a run never goes down through a room of an upper storey). The last wall is the terminal's own.
 */
function descend(plan: RoutingPlan, from: readonly [number, number], target: PointTarget, options: { readonly kind: 'water' | 'conduit'; readonly surface?: boolean; readonly diameter?: number; readonly attic: number; readonly first: 'u' | 'v'; readonly y: number; readonly passing?: boolean }): Route {
  const floor = Math.max(0, target.floor)
  const top = Math.max(floor, plan.floors.length - 1)
  const route: RoutePoint[] = []
  let at: readonly [number, number] = from
  let height = options.attic
  for (let storey = top; storey >= floor; storey--) {
    const passing = storey !== floor || options.passing === true
    const found = wallDrop(plan, storey, target.u, target.v, passing ? { ...options, surface: false, endClear: PASSING_END_CLEAR[options.kind] } : options)
    if (!found) return []
    // a conduit passing down goes in the middle of the wall, a water pipe by its face: never one in the other's line
    const drop = passing && options.kind === 'conduit' ? toMiddle(found) : found
    const path = slabPath(plan, at, [drop.u, drop.v], height, options.first)
    route.push(...(route.length ? path.slice(1) : path))
    at = [drop.u, drop.v]
    if (storey === floor) break
    height = (plan.floors[storey]?.y0 ?? 0) - SLAB_MIDDLE + SLAB_LIFT[options.kind]
    route.push([drop.u, height, drop.v])
  }
  route.push([at[0], options.y, at[1]])
  return route.filter((p, i) => i === 0 || Math.hypot(p[0] - route[i - 1]![0], p[1] - route[i - 1]![1], p[2] - route[i - 1]![2]) > 1e-4)
}

/**
 * The run from the attic straight down through the slab to a ceiling terminal (a ceiling light) at (u, v): across the attic, then plumb through the slab. A
 * light out of the house (an outbuilding's) is fed under the ground (`feedTo`): up inside its building's wall to the ceiling, then in its slab to the light.
 */
export function routeToCeiling(plan: RoutingPlan, from: readonly [number, number], u: number, v: number, ceilingY: number): Route {
  const attic = atticFloor(plan) + ATTIC_LIFT.conduit
  if (inside(houseFootprint(plan), u, v, 0.4)) {
    // a ceiling under an upper storey: down the walls of the storeys over it, then across inside its slab to the light (never down through a room)
    const over = plan.floors.findIndex((floor, index) => index > 0 && floor.y0 > ceilingY - CEILING_SLAB)
    if (over < 0) return [...atticPath(from, [u, v], attic, 'v'), [u, ceilingY, v]]
    const slabY = (plan.floors[over]?.y0 ?? 0) - SLAB_MIDDLE + SLAB_LIFT.conduit
    const down = descend(plan, from, { u, v, y: 0, floor: over }, { kind: 'conduit', attic, first: 'v', y: slabY, passing: true })
    const foot = down[down.length - 1]
    if (!foot) return []
    return [...down, ...slabPath(plan, [foot[0], foot[2]], [u, v], slabY, 'v').slice(1), [u, Math.min(ceilingY, slabY), v]]
  }
  // up its building's wall into the slab over the ceiling, across in it, and down to the box in the ceiling
  const feed = feedTo(plan, { u, v }, ceilingY + IN_SLAB, {})
  if (!feed) return []
  const top = feed.route[feed.route.length - 1]!
  return [...atticPath(from, [feed.exit.u, feed.exit.v], attic, 'v'), ...feed.route, ...atticPath([top[0], top[2]], [u, v], ceilingY + IN_SLAB, 'v').slice(1), [u, ceilingY, v]]
}

/** A run inside a building of the yard, from its ceiling at `start` (u, v, ceiling height) to a terminal on its walls: in its ceiling slab, down inside the wall. */
function routeInOutbuilding(plan: RoutingPlan, start: readonly [number, number, number], target: PointTarget): Route {
  const walls = plan.walls.filter((w) => w.outbuilding && w.floor === 0)
  const drop = walls.length ? wallDrop(plan, 0, target.u, target.v, { walls }) : null
  if (!drop) return []
  const storey = plan.floors[Math.max(0, target.floor)]
  return [[start[0], start[2], start[1]], ...atticPath([start[0], start[1]], [drop.u, drop.v], start[2] + IN_SLAB, 'v'), [drop.u, (storey ? storey.y0 : 0) + target.y, drop.v]]
}

/** How far over a ceiling a run goes across inside the slab cast on it (a building of the yard has no attic: its runs are cast in its roof slab), metres. */
const IN_SLAB = 0.08

/** Total length of a route, metres. */
export const routeLength = (route: Route): number => route.reduce((sum, p, i) => (i ? sum + Math.hypot(p[0] - route[i - 1]![0], p[1] - route[i - 1]![1], p[2] - route[i - 1]![2]) : 0), 0)

/** The routing view of a house plan: its walls, its doors and windows, its storeys. */
export function routingPlanOf(plan: { readonly walls: readonly RoutingWall[]; readonly doors: readonly RoutingOpening[]; readonly windows: readonly RoutingOpening[]; readonly floors: readonly { readonly y0: number; readonly ceiling: number }[] }): RoutingPlan {
  return { walls: plan.walls, openings: [...plan.doors, ...plan.windows], floors: plan.floors }
}

export interface RoutableConduit {
  readonly id: string
  readonly circuit: string
  readonly from: string
  readonly to: string
  readonly exposed: boolean
  readonly diameter: number
  readonly points: readonly (readonly number[])[]
}

export interface RoutableElectrical {
  readonly panel: { readonly u: number; readonly v: number; readonly y: number; readonly h?: number; readonly floor?: number; readonly frontU?: number; readonly frontV?: number } | null
  readonly conduits: readonly RoutableConduit[]
  readonly switches: readonly { readonly id: string; readonly u: number; readonly v: number; readonly y: number; readonly floor: number }[]
  readonly outlets: readonly { readonly id: string; readonly u: number; readonly v: number; readonly y: number; readonly floor: number }[]
  readonly circuits: readonly { readonly id: string; readonly room: string; readonly floor: number; readonly lamps?: readonly string[] }[]
}

const toPlan = (route: Route): number[][] => route.map((p) => [p[0], p[2], p[1]])

/**
 * A circuit's home run from the top of the panel to its first ceiling light: up inside the panel's wall into the slab over its storey and across in it, when the
 * light hangs from that slab; otherwise up through the walls of the storeys over it (crossing in each slab to the wall above) to the attic, and on to the light.
 */
function homeRun(plan: RoutingPlan, run: { readonly riser: WallDrop; readonly floor: number; readonly top: number; readonly home: readonly [number, number]; readonly ceilingY: number }): Route {
  const { riser, floor, top, home, ceilingY } = run
  const start: RoutePoint = [riser.u, top, riser.v]
  const above = plan.floors[floor + 1]
  if (above && above.y0 > ceilingY - CEILING_SLAB && inside(houseFootprint(plan), home[0], home[1], 0.4)) {
    const slabY = above.y0 - SLAB_MIDDLE + SLAB_LIFT.conduit
    return [start, [riser.u, slabY, riser.v], ...slabPath(plan, [riser.u, riser.v], home, slabY, 'v').slice(1), [home[0], Math.min(ceilingY, slabY), home[1]]]
  }
  const attic = atticFloor(plan) + ATTIC_LIFT.conduit
  // the way up is the way a run comes down to the panel, walked backwards
  const up = [...descend(plan, [riser.u, riser.v], { u: riser.u, v: riser.v, y: 0, floor }, { kind: 'conduit', attic, first: 'v', y: top })].reverse()
  const route = [start, ...up.slice(1), ...routeToCeiling(plan, [riser.u, riser.v], home[0], home[1], ceilingY)]
  return route.filter((p, i) => i === 0 || Math.hypot(p[0] - route[i - 1]![0], p[1] - route[i - 1]![1], p[2] - route[i - 1]![2]) > 1e-4)
}

/**
 * The plan's conduits laid as an electrician does, in the plan's own terms (points [u, v, y]): the circuit's home run rises from the panel inside its wall to
 * the attic and goes down through the slab to the room's first ceiling light; each switch and outlet branches off over that light, crosses the attic and goes
 * down inside (or, for exposed conduits, on) the wall it is set in. A conduit whose ends the plan does not name keeps its points.
 */
export function routeConduits(plan: RoutingPlan, electrical: RoutableElectrical, lamps: ReadonlyMap<string, { readonly u: number; readonly v: number; readonly y: number }>): RoutableConduit[] {
  const Q = electrical.panel
  const terminals = new Map<string, { u: number; v: number; y: number; floor: number }>()
  for (const t of [...electrical.switches, ...electrical.outlets]) terminals.set(t.id, t)
  // where each circuit's home run ends (its first ceiling light), and the height of that ceiling
  const homes = new Map<string, readonly [number, number, number]>()
  return electrical.conduits.map((c) => {
    const circuit = electrical.circuits.find((x) => x.id === c.circuit)
    const lamp = circuit?.lamps?.map((id) => lamps.get(id)).find((x) => x !== undefined)
    const last = c.points[c.points.length - 1]
    const home: readonly [number, number] | null = lamp ? [lamp.u, lamp.v] : last ? [last[0]!, last[1]!] : null
    if (c.from === 'panel' && Q && home) {
      const floor = Q.floor ?? 0
      const riser = wallDrop(plan, floor, Q.u + (Q.frontU ?? 0) * 0.2, Q.v + (Q.frontV ?? 0) * 0.2, { surface: c.exposed, diameter: c.diameter })
      if (!riser) return c
      const storey = plan.floors[floor]
      const ceilingY = lamp ? lamp.y : (storey ? storey.y0 + storey.ceiling : 2.8)
      homes.set(c.circuit, [home[0], home[1], ceilingY])
      const top = (Q.y ?? 1.5) + (Q.h ?? 0.4) / 2
      return { ...c, points: toPlan(homeRun(plan, { riser, floor, top, home, ceilingY })) }
    }
    const target = terminals.get(c.to)
    const start = homes.get(c.from) ?? (home ? [home[0], home[1], atticFloor(plan)] as const : undefined)
    if (!target || !start) return c
    // a branch from a light out of the house (an outbuilding's) stays in that building: across its ceiling slab, down inside its wall
    if (!inside(houseFootprint(plan), start[0], start[1], 0.4)) return { ...c, points: toPlan(routeInOutbuilding(plan, start, target)) }
    return { ...c, points: toPlan(routeToTerminal(plan, [start[0], start[1]], target, { kind: 'conduit', surface: c.exposed, diameter: c.diameter })) }
  })
}
