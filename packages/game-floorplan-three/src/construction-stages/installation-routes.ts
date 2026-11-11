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
}

/** How far the water and the conduits lie over the top ceiling slab, metres: on it, the conduits a hand over the water so the two never share a line. */
export const ATTIC_LIFT = { water: 0.03, conduit: 0.07 } as const
/** Depth of the buried runs (sewer, the lines to an outbuilding), metres under the ground. */
export const BURIED_Y = -0.35
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
export function wallDrop(plan: RoutingPlan, floor: number, u: number, v: number, options: { readonly surface?: boolean; readonly diameter?: number } = {}): WallDrop | null {
  let best: { wall: RoutingWall; along: number; distance: number } | null = null
  for (const w of houseWalls(plan, Math.max(0, floor))) {
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
  const across = alongU ? v - line : u - line
  const side = across >= 0 ? 1 : -1
  const half = (wall.thickness ?? DEFAULT_THICKNESS) / 2
  const offset = options.surface ? half + (options.diameter ?? 0.02) / 2 : half - BRICK_FACE_INSET
  const at = line + side * offset
  return { u: alongU ? along : at, v: alongU ? at : along, wall }
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
  // out of the house: down the outer wall nearest the terminal, buried to it, up beside it
  const exit = wallDrop(plan, 0, target.u, target.v, { ...options, surface: false })
  if (!exit) return []
  return [...atticPath(from, [exit.u, exit.v], attic, first), [exit.u, BURIED_Y, exit.v], [target.u, BURIED_Y, exit.v], [target.u, BURIED_Y, target.v], [target.u, y, target.v]]
}

/** The run from the attic straight down through the slab to a ceiling terminal (a ceiling light) at (u, v): across the attic, then plumb through the slab. */
export function routeToCeiling(plan: RoutingPlan, from: readonly [number, number], u: number, v: number, ceilingY: number): Route {
  const attic = atticFloor(plan) + ATTIC_LIFT.conduit
  return [...atticPath(from, [u, v], attic, 'v'), [u, ceilingY, v]]
}

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
  const homes = new Map<string, readonly [number, number]>()
  return electrical.conduits.map((c) => {
    const circuit = electrical.circuits.find((x) => x.id === c.circuit)
    const lamp = circuit?.lamps?.map((id) => lamps.get(id)).find((x) => x !== undefined)
    const last = c.points[c.points.length - 1]
    const home: readonly [number, number] | null = lamp ? [lamp.u, lamp.v] : last ? [last[0]!, last[1]!] : null
    if (c.from === 'panel' && Q && home) {
      const floor = Q.floor ?? 0
      const riser = wallDrop(plan, floor, Q.u + (Q.frontU ?? 0) * 0.2, Q.v + (Q.frontV ?? 0) * 0.2, { surface: c.exposed, diameter: c.diameter })
      if (!riser) return c
      homes.set(c.circuit, home)
      const storey = plan.floors[floor]
      const ceilingY = lamp ? lamp.y : (storey ? storey.y0 + storey.ceiling : 2.8)
      const top = (Q.y ?? 1.5) + (Q.h ?? 0.4) / 2
      return { ...c, points: [[riser.u, riser.v, top], ...toPlan(routeToCeiling(plan, [riser.u, riser.v], home[0], home[1], ceilingY))] }
    }
    const target = terminals.get(c.to)
    const start = homes.get(c.from) ?? home
    if (!target || !start) return c
    return { ...c, points: toPlan(routeToTerminal(plan, start, target, { kind: 'conduit', surface: c.exposed, diameter: c.diameter })) }
  })
}
