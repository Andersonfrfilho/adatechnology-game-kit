import type { PlumbingPoint } from '@adatechnology/game-floorplan-structure'

import { DRAIN_BORE } from './installations-stage.js'
import { SLAB_MIDDLE, wallDrop } from './installation-routes.js'
import type { RoutingPlan } from './installation-routes.js'

type Vec3 = [number, number, number]

/** The ground floor's drains cross under the floor at this height to the buried branch's riser under the fixture, metres: under the floor's layers and the lot's paving, over the branch's turn. */
const SUBFLOOR_Y = -0.15
/** How far a drain coming across the subfloor stops off the riser's side, metres: it enters the riser, its end never inside it. */
const RISER_CLEAR = 0.002

/** Height over its storey's floor of the drain's outlet in the wall (ponto de esgoto) of a basin, a tub or a machine: where the fixture's trap meets it, metres. */
const WALL_OUTLET_HEIGHT: Readonly<Record<string, number>> = { tap: 0.5, tub: 0.45, machine: 0.5 }
/** A toilet's and a shower's drain leaves the fixture through the floor (NBR 8160): its capped top just under the floor's face, metres. */
const FLOOR_OUTLET_DROP = 0.003
/** A level run from a to b at height y in two square legs (along u, then along v) after the start: pipes are laid square, never on the slant. */
function square(a: readonly [number, number], b: readonly [number, number], y: number): Vec3[] {
  const corner: Vec3 = [b[0], y, a[1]]
  const out: Vec3[] = []
  if (Math.abs(b[0] - a[0]) > 1e-4 && Math.abs(b[1] - a[1]) > 1e-4) out.push(corner)
  out.push([b[0], y, b[1]])
  return out
}

/** A drop's point by the wall's centre line (the stack runs in the middle of the wall). */
const onCentre = (at: { u: number; v: number; wall: { axis: 'u' | 'v'; u0: number; v0: number } }): [number, number] => {
  // a hair off the centre toward the room it serves: its caps never on the plane of the wall's middle (where storeys' faces meet)
  if (at.wall.axis === 'u') return [at.u, at.wall.v0 + Math.sign(at.v - at.wall.v0) * STACK_OFF_CENTRE]
  return [at.wall.u0 + Math.sign(at.u - at.wall.u0) * STACK_OFF_CENTRE, at.v]
}
/** How far off the wall's centre line the stack runs, metres. */
const STACK_OFF_CENTRE = 0.013

/**
 * The run of one fixture's drain as a plumber lays it (NBR 8160), never across a room: a basin, a tub or a machine from its outlet in the wall behind it, down
 * inside the wall; a toilet or a shower straight down through the floor (on the ground floor, that is the buried branch's riser: no run of the house's). On an upper storey it crosses inside the slab to the wall of the storey below and goes
 * down inside it. Under the ground floor it reaches the riser of the buried branch, which rises under the fixture (`installations-stage`).
 */
export function drainRoute(plan: RoutingPlan, point: PlumbingPoint): Vec3[] | null {
  const floor = point.floor
  if (floor < 0) return null
  const y0 = plan.floors[floor]?.y0 ?? 0
  const outlet = WALL_OUTLET_HEIGHT[point.kind]
  const points: Vec3[] = []
  let at: [number, number] = [point.u, point.v]
  let storey = floor
  if (outlet !== undefined) {
    const drop = wallDrop(plan, floor, point.u, point.v)
    if (!drop) return null
    at = onCentre(drop)
    points.push([at[0], y0 + outlet, at[1]])
  } else {
    points.push([point.u, y0 - FLOOR_OUTLET_DROP, point.v])
    // on an upper storey the floor drain goes into the slab and across it to the stack of the storey below
    if (floor > 0) {
      const slabY = y0 - SLAB_MIDDLE
      points.push([point.u, slabY, point.v])
      const below = wallDrop(plan, floor - 1, point.u, point.v)
      if (!below) return null
      at = onCentre(below)
      points.push(...square([point.u, point.v], at, slabY))
      storey = floor - 1
    }
  }
  for (; storey > 0; storey--) {
    const slabY = (plan.floors[storey]?.y0 ?? 0) - SLAB_MIDDLE
    points.push([at[0], slabY, at[1]])
    const below = wallDrop(plan, storey - 1, at[0], at[1])
    if (!below) continue
    const from = at
    at = onCentre(below)
    points.push(...square(from, at, slabY))
  }
  // a toilet or a shower of the ground floor drains straight into the riser of the buried branch under it: the house lays nothing of its own there
  if (Math.hypot(at[0] - point.u, at[1] - point.v) < 1e-3) return null
  {
    // the foot of the stack, then under the floor over to the riser of the buried branch under the fixture, stopping at its side (never along it)
    points.push([at[0], SUBFLOOR_Y, at[1]])
    const legs = square(at, [point.u, point.v], SUBFLOOR_Y)
    const last = legs.length > 1 ? legs[legs.length - 2]! : ([at[0], SUBFLOOR_Y, at[1]] as Vec3)
    const run = Math.hypot(point.u - last[0], point.v - last[2]), stop = run > 0 ? Math.max(0, run - ((DRAIN_BORE[point.kind] ?? 0.05) / 2 + RISER_CLEAR)) / run : 0
    legs[legs.length - 1] = [last[0] + (point.u - last[0]) * stop, SUBFLOOR_Y, last[2] + (point.v - last[2]) * stop]
    points.push(...legs)
  }
  return points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1]![0], p[1] - points[i - 1]![1], p[2] - points[i - 1]![2]) > 1e-4)
}

