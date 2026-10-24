import { round2 } from './geometry'
import type { Rect, StructureSource, WaterTank } from './types'

type Rng = () => number

const TANK_SIDE = 1.1
const NOT_UNDER_TANK = ['void', 'elevator', 'stairs', 'balcony', 'porch']
const WET_ROOMS = ['bathroom', 'kitchen', 'laundry']
const ATTIC_CHANCE = 0.12
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value))

export interface TankPlanOptions {
  /** Litres by template id or style id (default: budget 500, mid 1000, mansion 3000, any other 2000). */
  capacities?: Record<string, number>
  /** Where the tank goes; default: on the slab of a flat roof, else on a raised platform (the attic one time in eight). */
  location?: (source: StructureSource, rng: Rng) => WaterTank['place']
  /** A template with its own tank (a trestle for the rural water) answers here instead. */
  custom?: (source: StructureSource, rng: Rng) => WaterTank | null
}

const DEFAULT_CAPACITIES: Record<string, number> = { budget: 500, mid: 1000, mansion: 3000 }

function capacityOf(source: StructureSource, capacities: Record<string, number>): number {
  return capacities[source.style ?? ''] ?? capacities[source.template ?? ''] ?? 2000
}

/** Candidate spot: the room part with the least weight (wet rooms first, terraces last, near the reference point or the middle). */
function bestSpot(source: StructureSource, floor: number, reference: { u: number; v: number } | undefined): { roomType: string; roomId: string; rect: Rect } | undefined {
  const centre: [number, number] = reference ? [reference.u, reference.v] : [source.w / 2, source.d / 2]
  let best: { roomType: string; roomId: string; rect: Rect; weight: number } | undefined
  for (const room of source.rooms.filter((r) => r.floor === floor && !NOT_UNDER_TANK.includes(r.type))) {
    for (const part of room.parts) {
      const rect: Rect = [part[0] + 0.4, part[1] + 0.4, part[2] - 0.4, part[3] - 0.4]
      if (rect[2] - rect[0] < TANK_SIDE || rect[3] - rect[1] < TANK_SIDE) continue
      const base = WET_ROOMS.includes(room.type) ? 0 : room.type === 'terrace' ? 500 : 100
      const weight = base + Math.hypot((rect[0] + rect[2]) / 2 - centre[0], (rect[1] + rect[3]) / 2 - centre[1])
      if (!best || weight < best.weight) best = { roomType: room.type, roomId: room.id, rect, weight }
    }
  }
  return best
}

function raisedPlatform(source: StructureSource, u: number, v: number, baseY: number): NonNullable<WaterTank['platform']> {
  const margin = 0.12
  const edge = Math.max(0, Math.min(u, source.w - u, v, source.d - v))
  const rise = round2(clamp(edge * 0.35 + 0.7, 1.1, 2.4))
  const thickness = 0.12
  const reach = TANK_SIDE / 2 + margin - 0.06
  const pillars = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([a, b]) => ({ u: round2(u + a * reach), v: round2(v + b * reach), side: 0.12 }))
  const half = TANK_SIDE / 2 + margin
  return { aabb: [u - half, v - half, u + half, v + half].map(round2) as Rect, baseY, height: rise, thickness, topY: round2(baseY + rise + thickness), pillars, ladder: true }
}

/**
 * The water tank of a house: on the roof slab, in the attic, or on a platform that rises out of the roof, never in the yard. Null for a plan without
 * a lot (an apartment) or a commercial building, and when no room has space.
 */
export function planWaterTank(source: StructureSource, rng: Rng, options: TankPlanOptions = {}): WaterTank | null {
  if (!source.lot || source.style === 'commercial') return null
  if (options.custom) return options.custom(source, rng)
  const floor = source.floors.length - 1
  const level = source.floors[floor]!
  const capacity = capacityOf(source, { ...DEFAULT_CAPACITIES, ...options.capacities })
  const height = capacity >= 2000 ? 1.4 : capacity === 1000 ? 1.0 : 0.85
  const place = options.location ? options.location(source, rng) : source.facade.roof === 'slab' ? 'slab' : rng() < ATTIC_CHANCE ? 'attic' : 'raised_slab'
  const reference = (source.facade.slab as { waterTank?: { u: number; v: number } } | undefined)?.waterTank
  const spot = bestSpot(source, floor, reference)
  if (!spot) return null
  const target = reference ? [reference.u, reference.v] : [(spot.rect[0] + spot.rect[2]) / 2, (spot.rect[1] + spot.rect[3]) / 2]
  const u = clamp(target[0]!, spot.rect[0] + TANK_SIDE / 2, spot.rect[2] - TANK_SIDE / 2)
  const v = clamp(target[1]!, spot.rect[1] + TANK_SIDE / 2, spot.rect[3] - TANK_SIDE / 2)
  const where = spot.roomType === 'terrace' ? 'slab' : place
  const slabY = round2(spot.roomType === 'terrace' ? level.y0 : level.y0 + level.ceiling)
  const tank: WaterTank = {
    id: 'water_tank', kind: 'water_tank', itemType: 'water_tank', place: where, floor, room: spot.roomId, u: round2(u), v: round2(v), y: slabY, w: TANK_SIDE, d: TANK_SIDE, h: height,
    capacity, aabb: [u - TANK_SIDE / 2, v - TANK_SIDE / 2, u + TANK_SIDE / 2, v + TANK_SIDE / 2].map(round2) as Rect,
  }
  if (where === 'raised_slab') {
    tank.platform = raisedPlatform(source, u, v, slabY)
    tank.y = tank.platform.topY
  }
  return tank
}
