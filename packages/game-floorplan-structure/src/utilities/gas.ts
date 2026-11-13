import type { Plan, PlanWall, ResultItem, Room } from '@adatechnology/game-floorplan'
import type { Rect } from '../types'
import type { Rng } from './shared'
import { HALF_WALL, clamp, groundExteriorWalls, inner, isSolid, outwardOf, overlaps, round2, sideNameOf } from './shared'

export const CYLINDER_TYPE = 'cooking_gas_cylinder'
const CYLINDER = { w: 0.36, d: 0.36, h: 0.48 }
const CYLINDER_KG = 13

export interface GasMeter {
  id: 'gas.meter'
  u: number
  v: number
  y: number
  side: string
  w: number
  d: number
  h: number
}

/** Where the cylinder of a house stands. */
export const GAS_LAYOUT = { OUTDOOR_SHELTER: 'outdoor_shelter', INDOOR_BESIDE_STOVE: 'indoor_beside_stove' } as const
export type GasLayout = (typeof GAS_LAYOUT)[keyof typeof GAS_LAYOUT]

/** The variants of the cylinder's position and how often each comes up: the ventilated outdoor shelter is the default, the cylinder in the kitchen the variant. */
export const GAS_LAYOUTS: readonly { readonly id: GasLayout; readonly weight: number }[] = [
  { id: GAS_LAYOUT.OUTDOOR_SHELTER, weight: 0.75 },
  { id: GAS_LAYOUT.INDOOR_BESIDE_STOVE, weight: 0.25 },
]

/** The standard of the external shelter of a cooking gas cylinder. */
export const SHELTER_STANDARD = 'NBR 13523'
/** Rigid copper tube of the line from the shelter to the stove's valve, millimetres. */
const PIPE_DIAMETER_MM = 15
/** The shelter: the cylinder with 10 cm round it, ventilated high and low (the gas is heavier than air), backed on the wall. */
const SHELTER = { side: 0.56, h: 0.7 }
const VALVE_HEIGHT = 0.55
const PIPE_WALL_HEIGHT = 0.6
/** How far the line stands off the wall it runs along, metres. */
const PIPE_CLEARANCE = 0.03

export interface Gas {
  type: 'piped' | 'cylinder'
  meter: GasMeter | null
  /** The variant of the cylinder's position (a house with cylinders; none in the Visor's golden). */
  layout?: GasLayout
}

export type GasValve = { readonly id: string; readonly x: number; readonly z: number; readonly y: number }

interface Spot {
  mode: 'beside' | 'niche' | 'under'
  x: number
  z: number
  rect: Rect
  outdoor?: boolean
  cabinet?: string
  /** The shelter's box (outdoor shelter) and the wall it is backed on. */
  shelter?: Rect
  wall?: PlanWall
}

/** Gas meter on the front wall of the ground floor, 1.2 m up. */
function placeMeter(plan: Plan): GasMeter | null {
  const segments = groundExteriorWalls(plan).sort((a, b) => (b.sides.includes('outside') ? 1 : 0) - (a.sides.includes('outside') ? 1 : 0) || (a.axis === 'u' && a.v0 === 0 ? -1 : 1))
  const wall = segments.find((w) => w.axis === 'u' && w.v0 === 0) || segments[0]
  if (!wall) return null
  const centre = wall.axis === 'u' ? (wall.u0 + wall.u1) / 2 : (wall.v0 + wall.v1) / 2
  const vector = outwardOf(wall)
  const offset = HALF_WALL + 0.1
  return {
    id: 'gas.meter', u: round2(wall.axis === 'u' ? centre : wall.u0 + vector[0] * offset), v: round2(wall.axis === 'u' ? wall.v0 + vector[1] * offset : centre), y: 1.2, side: sideNameOf(vector), w: 0.3, d: 0.15, h: 0.4,
  }
}

interface Context {
  plan: Plan
  items: ResultItem[]
  stateItems: ResultItem[]
  rng: Rng
  /** The Visor de casas 3D's gas as it was: a niche at the wall with a hose, no shelter nor copper line (its golden). */
  visor?: boolean
}

function besideStove(context: Context, stove: ResultItem, room: Room, solids: Rect[], doorZones: Rect[]): Spot | undefined {
  const t: [number, number] = [-(stove.frontV ?? 1), (stove.frontU ?? 0)]
  const parts = room.parts.map(inner)
  for (const s of context.rng() < 0.5 ? [1, -1] : [-1, 1]) {
    const cx = stove.x + t[0] * s * (stove.w / 2 + CYLINDER.w / 2 + 0.03) - ((stove.frontU ?? 0) * (stove.d - CYLINDER.d)) / 2
    const cz = stove.z + t[1] * s * (stove.w / 2 + CYLINDER.w / 2 + 0.03) - ((stove.frontV ?? 1) * (stove.d - CYLINDER.d)) / 2
    const rect = [cx - CYLINDER.w / 2, cz - CYLINDER.d / 2, cx + CYLINDER.w / 2, cz + CYLINDER.d / 2].map(round2) as Rect
    const inside = parts.some((q: Rect) => rect[0] >= q[0] - 0.011 && rect[2] <= q[2] + 0.011 && rect[1] >= q[1] - 0.011 && rect[3] <= q[3] + 0.011)
    if (inside && !solids.some((o) => overlaps(rect, o, 0.011)) && !doorZones.some((z) => overlaps(rect, z, 0.011))) return { mode: 'beside', x: cx, z: cz, rect }
  }
  return undefined
}

/** The shelter's line may run this far from the stove to the exterior wall of its kitchen, metres. */
const MAX_PIPE_RUN = 4

const distanceToWall = (stove: ResultItem, wall: PlanWall): number =>
  wall.axis === 'u' ? Math.hypot(stove.x - clamp(stove.x, wall.u0, wall.u1), stove.z - wall.v0) : Math.hypot(stove.x - wall.u0, stove.z - clamp(stove.z, wall.v0, wall.v1))

function inNiche(context: Context, stove: ResultItem, room: Room, doorZones: Rect[]): Spot | undefined {
  const { plan } = context
  if (stove.floor !== 0) return undefined
  const walls = plan.walls.filter((p) => p.exterior && p.floor === stove.floor && p.type === 'wall' && p.sides.includes(room.id))
  if (context.visor) {
    // the Visor's niche: the first wall of the room within 1.6 m of the stove on both axes
    const wall = walls.find((p) => (p.axis === 'u' ? Math.abs(stove.x - clamp(stove.x, p.u0, p.u1)) < 1.6 && Math.abs(stove.z - p.v0) < 1.6 : Math.abs(stove.z - clamp(stove.z, p.v0, p.v1)) < 1.6 && Math.abs(stove.x - p.u0) < 1.6))
    return wall ? nicheAt(context, stove, wall, doorZones) : undefined
  }
  // the shelter: the nearest exterior wall of the kitchen with room for it, the copper line runs as far as it needs
  for (const wall of walls.filter((p) => distanceToWall(stove, p) <= MAX_PIPE_RUN).sort((x, y) => distanceToWall(stove, x) - distanceToWall(stove, y))) {
    const spot = nicheAt(context, stove, wall, doorZones)
    if (spot) return spot
  }
  return undefined
}

function nicheAt(context: Context, stove: ResultItem, wall: PlanWall, doorZones: Rect[]): Spot | undefined {
  const { plan, items, stateItems } = context
  const shelter = !context.visor
  const vector = outwardOf(wall)
  const reachU = shelter ? SHELTER.side / 2 : CYLINDER.w / 2 + 0.05
  const reachV = shelter ? SHELTER.side / 2 : CYLINDER.d / 2 + 0.05
  const cx = wall.axis === 'u' ? clamp(stove.x, wall.u0 + 0.4, wall.u1 - 0.4) : wall.u0 + vector[0] * (HALF_WALL + reachU)
  const cz = wall.axis === 'u' ? wall.v0 + vector[1] * (HALF_WALL + reachV) : clamp(stove.z, wall.v0 + 0.4, wall.v1 - 0.4)
  const cylinder = [cx - CYLINDER.w / 2, cz - CYLINDER.d / 2, cx + CYLINDER.w / 2, cz + CYLINDER.d / 2].map(round2) as Rect
  const box = shelter ? ([cx - SHELTER.side / 2, cz - SHELTER.side / 2, cx + SHELTER.side / 2, cz + SHELTER.side / 2].map(round2) as Rect) : cylinder
  const rect = box
  const blockedByItem = items.some((o) => o.outdoor && isSolid(o) && overlaps(rect, o.aabb, 0.011))
  const blockedByState = stateItems.some((o) => o.outdoor && o.aabb && !o.flat && o.mount !== 'ground' && overlaps(rect, o.aabb, 0.011))
  const blockedByPath = plan.paths.some((c) => c.rects.some((z: Rect) => overlaps(rect, z, 0.011)))
  const blockedByGate = plan.gates.some((g) => g.zones.some((z: Rect) => overlaps(rect, z, 0.011)))
  const blockedByFence = !plan.lot || plan.lot.perimeter.some((q) => overlaps(rect, [Math.min(q.u0, q.u1) - HALF_WALL, Math.min(q.v0, q.v1) - HALF_WALL, Math.max(q.u0, q.u1) + HALF_WALL, Math.max(q.v0, q.v1) + HALF_WALL], 0.011))
  if (blockedByItem || blockedByState || blockedByPath || doorZones.some((z) => overlaps(rect, z, 0.011)) || blockedByGate || blockedByFence) return undefined
  return { mode: 'niche', x: cx, z: cz, rect: cylinder, outdoor: true, ...(shelter ? { shelter: box, wall } : {}) }
}

function underCounter(context: Context, stove: ResultItem): Spot | undefined {
  const distance = (m: ResultItem): number => Math.hypot(m.x - stove.x, m.z - stove.z)
  const cabinets = context.items
    .filter(
      (m) => m.floor === stove.floor && m.room === stove.room && !m.outdoor && !m.on && !m.flat && ['kitchen_cabinet', 'workbench'].includes(m.category) && m.aabb && m.id !== stove.id &&
        Math.min(m.aabb[2] - m.aabb[0], m.aabb[3] - m.aabb[1]) >= CYLINDER.d - 0.011 && Math.max(m.aabb[2] - m.aabb[0], m.aabb[3] - m.aabb[1]) >= CYLINDER.w + 0.02,
    )
    .sort((a, b) => (a.category === 'kitchen_cabinet' ? 0 : 1) - (b.category === 'kitchen_cabinet' ? 0 : 1) || distance(a) - distance(b))
  for (const cabinet of cabinets) {
    if (distance(cabinet) > 3) continue
    const box = cabinet.aabb as Rect
    const hw = CYLINDER.w / 2
    const hd = CYLINDER.d / 2
    const cx = clamp(stove.x, box[0] + hw + 0.01, box[2] - hw - 0.01)
    const cz = clamp(stove.z, box[1] + hd + 0.01, box[3] - hd - 0.01)
    const rect = [cx - hw, cz - hd, cx + hw, cz + hd].map(round2) as Rect
    if (rect[0] < box[0] || rect[2] > box[2] || rect[1] < box[1] || rect[3] > box[3] || overlaps(rect, stove.aabb, 0.011)) continue
    return { mode: 'under', x: cx, z: cz, rect, cabinet: cabinet.id }
  }
  return undefined
}

const PLACEMENT = { beside: 'beside', niche: 'external_niche', under: 'under_counter' } as const
const OUTDOOR_SHELTER_PLACEMENT = 'outdoor_shelter'

/** The valve (registro) at the stove, on the wall side of its back: where the copper line ends and the flexible hose to the stove starts. */
function valveOf(stove: ResultItem): GasValve {
  const back = stove.d / 2 + 0.04
  return { id: `${stove.id}.gas_valve`, x: round2(stove.x - (stove.frontU ?? 0) * back), z: round2(stove.z - (stove.frontV ?? 1) * back), y: VALVE_HEIGHT }
}

/** The copper line from the shelter's outlet, through the wall and along its inner face at the height of the valve, to the stove's valve: points of plan (x, z) and height. */
function copperLine(spot: Spot, valve: GasValve): [number, number, number][] {
  const wall = spot.wall!
  const inward = outwardOf(wall).map((component) => -component)
  const face = HALF_WALL + PIPE_CLEARANCE
  const outlet: [number, number, number] = [round2(spot.x), round2(spot.z), CYLINDER.h]
  if (wall.axis === 'u') {
    const faceZ = round2(wall.v0 + inward[1]! * face)
    return [outlet, [round2(spot.x), wall.v0, PIPE_WALL_HEIGHT], [round2(spot.x), faceZ, PIPE_WALL_HEIGHT], [valve.x, faceZ, PIPE_WALL_HEIGHT], [valve.x, valve.z, valve.y]]
  }
  const faceX = round2(wall.u0 + inward[0]! * face)
  return [outlet, [wall.u0, round2(spot.z), PIPE_WALL_HEIGHT], [faceX, round2(spot.z), PIPE_WALL_HEIGHT], [faceX, valve.z, PIPE_WALL_HEIGHT], [valve.x, valve.z, valve.y]]
}

function cylinderItem(stove: ResultItem, spot: Spot): ResultItem {
  const item: ResultItem = {
    id: `${stove.room}.${CYLINDER_TYPE}`, type: CYLINDER_TYPE, category: CYLINDER_TYPE, x: round2(spot.x), z: round2(spot.z), ry: 0, w: CYLINDER.w, d: CYLINDER.d, h: CYLINDER.h, y: 0,
    frontU: -(stove.frontU ?? 0), frontV: -(stove.frontV ?? 1), room: stove.room, floor: stove.floor, outdoor: !!spot.outdoor, slot: 'cylinder', on: null, mode: null, clearance: 0, flat: false, low: false,
    aabb: spot.rect, link: stove.id, placement: PLACEMENT[spot.mode], hose: [[round2(spot.x), round2(spot.z), 0.3], [stove.x, stove.z, 0.5]], capacityKg: CYLINDER_KG,
  }
  if (spot.cabinet) {
    item.on = spot.cabinet
    item.hidden = true
  }
  if (spot.shelter) {
    const valve = valveOf(stove)
    item.placement = OUTDOOR_SHELTER_PLACEMENT
    item.shelter = { standard: SHELTER_STANDARD, ventilated: true, ventilation: { low: true, high: true }, aabb: spot.shelter, h: SHELTER.h }
    item.pipe = { material: 'copper', diameterMm: PIPE_DIAMETER_MM, route: copperLine(spot, valve), valve: valve.id }
    item.valve = valve
    item.hose = [[valve.x, valve.z, valve.y], [stove.x, stove.z, 0.5]]
    stove.gasValve = valve
  }
  if (spot.outdoor) item.floor = -1
  item.color = stove.color
  return item
}

function pickLayout(rng: Rng): GasLayout {
  const roll = rng() * GAS_LAYOUTS.reduce((sum, layout) => sum + layout.weight, 0)
  let acc = 0
  for (const layout of GAS_LAYOUTS) {
    acc += layout.weight
    if (roll < acc) return layout.id
  }
  return GAS_LAYOUTS[0]!.id
}

/**
 * Gas for the stoves of the house. By default the cylinder stands in a ventilated outdoor shelter (NBR 13523) backed on the kitchen wall, with a copper line
 * through the wall to the valve at the stove; the variant is the cylinder in the kitchen beside the stove (`GAS_LAYOUTS`). Under the counter is the last
 * resort, and (high-end houses, or when nothing fits) piped gas with a meter on the facade. The cylinders are added to `items`; the stoves are annotated
 * (`gas`, `cylinder`, `gasMeter`, `gasValve`). The Visor's golden (`visor`) keeps its niche with a hose and its order of draws.
 */
export function planGas(context: Context): Gas | null {
  const { plan, items, stateItems, rng } = context
  const stoves = items.filter((m) => m.category === 'stove' && !m.outdoor)
  if (!stoves.length) return null
  const high = plan.style === 'high'
  const piped = plan.style !== 'commercial' && (high ? rng() < 0.8 : plan.style === 'mid' ? rng() < 0.1 : false)
  const out: Gas = { type: piped ? 'piped' : 'cylinder', meter: null }
  const layout = context.visor || piped ? undefined : pickLayout(rng)
  if (layout) out.layout = layout
  const ensureMeter = (): void => {
    if (!out.meter) out.meter = placeMeter(plan)
  }
  for (const stove of stoves) {
    const room = plan.rooms.find((c) => c.id === stove.room && c.floor === stove.floor)
    if (!room) continue
    stove.gas = piped ? 'piped' : 'cylinder'
    if (piped) {
      ensureMeter()
      stove.gasMeter = 'gas.meter'
      continue
    }
    const solids = items.filter((m) => m.floor === stove.floor && m.room === stove.room && isSolid(m) && m.id !== stove.id).map((m) => m.aabb as Rect)
      .concat(stateItems.filter((m) => m.aabb && m.room === stove.room && m.floor === stove.floor && !m.flat && !m.on && m.mount !== 'window' && m.mount !== 'ground').map((m) => m.aabb as Rect))
    const doorZones = plan.doors.filter((p) => p.floor === stove.floor).flatMap((p) => p.zones as Rect[])
    const indoorFirst = layout ? layout === GAS_LAYOUT.INDOOR_BESIDE_STOVE : rng() < 0.7
    const order: Spot['mode'][] = indoorFirst ? ['beside', 'niche', 'under'] : ['niche', 'beside', 'under']
    let spot: Spot | undefined
    for (const mode of order) {
      if (spot) break
      spot = mode === 'beside' ? besideStove(context, stove, room, solids, doorZones) : mode === 'niche' ? inNiche(context, stove, room, doorZones) : underCounter(context, stove)
    }
    if (!spot) {
      stove.gas = 'piped'
      out.type = 'piped'
      ensureMeter()
      stove.gasMeter = 'gas.meter'
      continue
    }
    const cylinder = cylinderItem(stove, spot)
    items.push(cylinder)
    stove.cylinder = cylinder.id
  }
  return out
}
