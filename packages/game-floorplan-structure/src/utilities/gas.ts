import type { Rect } from '../types'
import type { Json, Rng } from './shared'
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

export interface Gas {
  type: 'piped' | 'cylinder'
  meter: GasMeter | null
}

interface Spot {
  mode: 'beside' | 'niche' | 'under'
  x: number
  z: number
  rect: Rect
  outdoor?: boolean
  cabinet?: string
}

/** Gas meter on the front wall of the ground floor, 1.2 m up. */
function placeMeter(plan: Json): GasMeter | null {
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
  plan: Json
  items: Json[]
  stateItems: Json[]
  rng: Rng
}

function besideStove(context: Context, stove: Json, room: Json, solids: Rect[], doorZones: Rect[]): Spot | undefined {
  const t: [number, number] = [-stove.frontV, stove.frontU]
  const parts = room.parts.map(inner)
  for (const s of context.rng() < 0.5 ? [1, -1] : [-1, 1]) {
    const cx = stove.x + t[0] * s * (stove.w / 2 + CYLINDER.w / 2 + 0.03) - (stove.frontU * (stove.d - CYLINDER.d)) / 2
    const cz = stove.z + t[1] * s * (stove.w / 2 + CYLINDER.w / 2 + 0.03) - (stove.frontV * (stove.d - CYLINDER.d)) / 2
    const rect = [cx - CYLINDER.w / 2, cz - CYLINDER.d / 2, cx + CYLINDER.w / 2, cz + CYLINDER.d / 2].map(round2) as Rect
    const inside = parts.some((q: Rect) => rect[0] >= q[0] - 0.011 && rect[2] <= q[2] + 0.011 && rect[1] >= q[1] - 0.011 && rect[3] <= q[3] + 0.011)
    if (inside && !solids.some((o) => overlaps(rect, o, 0.011)) && !doorZones.some((z) => overlaps(rect, z, 0.011))) return { mode: 'beside', x: cx, z: cz, rect }
  }
  return undefined
}

function inNiche(context: Context, stove: Json, room: Json, doorZones: Rect[]): Spot | undefined {
  const { plan, items, stateItems } = context
  const wall = plan.walls.find(
    (p: Json) =>
      p.exterior && p.floor === stove.floor && p.type === 'wall' && p.sides.includes(room.id) &&
      (p.axis === 'u'
        ? Math.abs(stove.x - clamp(stove.x, p.u0, p.u1)) < 1.6 && Math.abs(stove.z - p.v0) < 1.6
        : Math.abs(stove.z - clamp(stove.z, p.v0, p.v1)) < 1.6 && Math.abs(stove.x - p.u0) < 1.6),
  )
  if (!wall || stove.floor !== 0) return undefined
  const vector = outwardOf(wall)
  const cx = wall.axis === 'u' ? clamp(stove.x, wall.u0 + 0.4, wall.u1 - 0.4) : wall.u0 + vector[0] * (HALF_WALL + CYLINDER.w / 2 + 0.05)
  const cz = wall.axis === 'u' ? wall.v0 + vector[1] * (HALF_WALL + CYLINDER.d / 2 + 0.05) : clamp(stove.z, wall.v0 + 0.4, wall.v1 - 0.4)
  const rect = [cx - CYLINDER.w / 2, cz - CYLINDER.d / 2, cx + CYLINDER.w / 2, cz + CYLINDER.d / 2].map(round2) as Rect
  const blockedByItem = items.some((o) => o.outdoor && isSolid(o) && overlaps(rect, o.aabb, 0.011))
  const blockedByState = stateItems.some((o) => o.outdoor && o.aabb && !o.flat && o.mount !== 'ground' && overlaps(rect, o.aabb, 0.011))
  const blockedByPath = plan.paths.some((c: Json) => c.rects.some((z: Rect) => overlaps(rect, z, 0.011)))
  const blockedByGate = plan.gates.some((g: Json) => g.zones.some((z: Rect) => overlaps(rect, z, 0.011)))
  const blockedByFence = !plan.lot || plan.lot.perimeter.some((q: Json) => overlaps(rect, [Math.min(q.u0, q.u1) - HALF_WALL, Math.min(q.v0, q.v1) - HALF_WALL, Math.max(q.u0, q.u1) + HALF_WALL, Math.max(q.v0, q.v1) + HALF_WALL], 0.011))
  if (blockedByItem || blockedByState || blockedByPath || doorZones.some((z) => overlaps(rect, z, 0.011)) || blockedByGate || blockedByFence) return undefined
  return { mode: 'niche', x: cx, z: cz, rect, outdoor: true }
}

function underCounter(context: Context, stove: Json): Spot | undefined {
  const distance = (m: Json): number => Math.hypot(m.x - stove.x, m.z - stove.z)
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

function cylinderItem(stove: Json, spot: Spot): Json {
  const item: Json = {
    id: `${stove.room}.${CYLINDER_TYPE}`, type: CYLINDER_TYPE, category: CYLINDER_TYPE, x: round2(spot.x), z: round2(spot.z), ry: 0, w: CYLINDER.w, d: CYLINDER.d, h: CYLINDER.h, y: 0,
    frontU: -stove.frontU, frontV: -stove.frontV, room: stove.room, floor: stove.floor, outdoor: !!spot.outdoor, slot: 'cylinder', on: null, mode: null, clearance: 0, flat: false, low: false,
    aabb: spot.rect, link: stove.id, placement: PLACEMENT[spot.mode], hose: [[round2(spot.x), round2(spot.z), 0.3], [stove.x, stove.z, 0.5]], capacityKg: CYLINDER_KG,
  }
  if (spot.cabinet) {
    item.on = spot.cabinet
    item.hidden = true
  }
  if (spot.outdoor) item.floor = -1
  item.color = stove.color
  return item
}

/**
 * Gas for the stoves of the house: a cylinder beside the stove, in an outside niche with a hose or under the counter, or (high-end houses, or when
 * nothing fits) piped gas with a meter on the facade. The cylinders are added to `items`; the stoves are annotated (`gas`, `cylinder`, `gasMeter`).
 */
export function planGas(context: Context): Gas | null {
  const { plan, items, stateItems, rng } = context
  const stoves = items.filter((m) => m.category === 'stove' && !m.outdoor)
  if (!stoves.length) return null
  const high = plan.style === 'high'
  const piped = plan.style !== 'commercial' && (high ? rng() < 0.8 : plan.style === 'mid' ? rng() < 0.1 : false)
  const out: Gas = { type: piped ? 'piped' : 'cylinder', meter: null }
  const ensureMeter = (): void => {
    if (!out.meter) out.meter = placeMeter(plan)
  }
  for (const stove of stoves) {
    const room = plan.rooms.find((c: Json) => c.id === stove.room && c.floor === stove.floor)
    if (!room) continue
    stove.gas = piped ? 'piped' : 'cylinder'
    if (piped) {
      ensureMeter()
      stove.gasMeter = 'gas.meter'
      continue
    }
    const solids = items.filter((m) => m.floor === stove.floor && m.room === stove.room && isSolid(m) && m.id !== stove.id).map((m) => m.aabb as Rect)
      .concat(stateItems.filter((m) => m.aabb && m.room === stove.room && m.floor === stove.floor && !m.flat && !m.on && m.mount !== 'window' && m.mount !== 'ground').map((m) => m.aabb as Rect))
    const doorZones = plan.doors.filter((p: Json) => p.floor === stove.floor).flatMap((p: Json) => p.zones as Rect[])
    const order: Spot['mode'][] = rng() < 0.7 ? ['beside', 'niche', 'under'] : ['niche', 'beside', 'under']
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
