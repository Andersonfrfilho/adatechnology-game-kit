/**
 * Where the pipes and the conduits of a house really run, from the plan's network: the water leaves the tank, crosses the attic over the ceiling slab and
 * goes down inside the wall nearest each tap, shower or toilet; the conduits rise from the breaker panel inside its wall to the attic, cross it and go down
 * inside the wall of each switch and outlet, or through the slab to each ceiling light. Nothing crosses a room in the air, and the same run is drawn in the
 * rough-in stage (cut into the bare masonry) and, embedded, in the finished house: one network, laid once.
 */

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
const BRICK_FACE_INSET = 0.014
const OPENING_CLEARANCE = 0.12

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

/** A wall's along range, moved off any door or window in it (a pipe never goes down through an opening). */
function clearOfOpenings(plan: RoutingPlan, wall: RoutingWall, along: number): number {
  const line = wall.axis === 'u' ? wall.v0 : wall.u0
  const a0 = wall.axis === 'u' ? wall.u0 : wall.v0, a1 = wall.axis === 'u' ? wall.u1 : wall.v1
  let at = along
  for (const o of plan.openings) {
    if (o.floor !== wall.floor || o.axis !== wall.axis || Math.abs(o.pos - line) > 0.05) continue
    const lo = o.at - o.width / 2 - OPENING_CLEARANCE, hi = o.at + o.width / 2 + OPENING_CLEARANCE
    if (at <= lo || at >= hi) continue
    const toLo = at - lo, toHi = hi - at
    at = (toLo <= toHi && lo >= a0 + 0.1) || hi > a1 - 0.1 ? lo : hi
  }
  return Math.max(a0 + 0.1, Math.min(a1 - 0.1, at))
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
  const along = clearOfOpenings(plan, wall, best.along)
  const line = alongU ? wall.v0 : wall.u0
  // the face of the room the run serves: the side the point (or `toward`) is on; a point on the wall's line belongs to the inside of the building
  const [ru, rv] = options.toward ?? [u, v]
  const across = alongU ? rv - line : ru - line
  const box = buildingBox(plan, wall)
  const inward = (alongU ? (box[1] + box[3]) / 2 : (box[0] + box[2]) / 2) - line
  const side = Math.abs(across) > 1e-3 ? Math.sign(across) : inward >= 0 ? 1 : -1
  const half = (wall.thickness ?? DEFAULT_THICKNESS) / 2
  const offset = options.surface ? half + (options.diameter ?? 0.02) / 2 : half - BRICK_FACE_INSET
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
  if (inside(footprint, target.u, target.v, 0.4)) {
    const drop = wallDrop(plan, floor, target.u, target.v, options)
    if (!drop) return []
    return [...atticPath(from, [drop.u, drop.v], attic, first), [drop.u, y, drop.v]]
  }
  // out of the house: down inside its wall nearest the terminal, buried across the yard, up inside the wall the terminal is on
  const feed = feedTo(plan, target, y, options)
  if (!feed) return []
  return [...atticPath(from, [feed.exit.u, feed.exit.v], attic, first), ...feed.route]
}

/**
 * The run from the attic straight down through the slab to a ceiling terminal (a ceiling light) at (u, v): across the attic, then plumb through the slab. A
 * light out of the house (an outbuilding's) is fed under the ground (`feedTo`): up inside its building's wall to the ceiling, then in its slab to the light.
 */
export function routeToCeiling(plan: RoutingPlan, from: readonly [number, number], u: number, v: number, ceilingY: number): Route {
  const attic = atticFloor(plan) + ATTIC_LIFT.conduit
  if (inside(houseFootprint(plan), u, v, 0.4)) return [...atticPath(from, [u, v], attic, 'v'), [u, ceilingY, v]]
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
      return { ...c, points: [[riser.u, riser.v, top], ...toPlan(routeToCeiling(plan, [riser.u, riser.v], home[0], home[1], ceilingY))] }
    }
    const target = terminals.get(c.to)
    const start = homes.get(c.from) ?? (home ? [home[0], home[1], atticFloor(plan)] as const : undefined)
    if (!target || !start) return c
    // a branch from a light out of the house (an outbuilding's) stays in that building: across its ceiling slab, down inside its wall
    if (!inside(houseFootprint(plan), start[0], start[1], 0.4)) return { ...c, points: toPlan(routeInOutbuilding(plan, start, target)) }
    return { ...c, points: toPlan(routeToTerminal(plan, [start[0], start[1]], target, { kind: 'conduit', surface: c.exposed, diameter: c.diameter })) }
  })
}
