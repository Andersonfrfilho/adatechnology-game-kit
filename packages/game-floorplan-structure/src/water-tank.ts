import { round2 } from './geometry'
import type { Rect, StructureSource, WaterTank } from './types'

type Rng = () => number

const TANK_SIDE = 1.1
/** Side of the concrete pillars of a raised tank slab, metres: NBR 6118 asks at least 19 cm. */
export const TANK_PILLAR_SIDE = 0.2
/** The 0.12 m pillars of the Visor de casas 3D, below the NBR 6118 minimum (`visorSections`, for the team's golden only). */
export const VISOR_TANK_PILLAR_SIDE = 0.12
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
  /** Side of the platform's concrete pillars (default `TANK_PILLAR_SIDE`; the Visor de casas 3D drew 0.12 m). */
  pillarSide?: number
  /**
   * The raised platform keeps the tank under the pitched roof (default true): it stands where the roof is high enough and rises no more than the roof lets it.
   * False puts it as the Visor de casas 3D did, a platform that rises out of the roof (the team's golden only).
   */
  underRoof?: boolean
}

const DEFAULT_CAPACITIES: Record<string, number> = { budget: 500, mid: 1000, mansion: 3000 }

function capacityOf(source: StructureSource, capacities: Record<string, number>): number {
  return capacities[source.style ?? ''] ?? capacities[source.template ?? ''] ?? 2000
}

type Spot = { roomType: string; roomId: string; rect: Rect }

/** Candidate spots, best first: the room parts by weight (wet rooms first, terraces last, near the reference point or the middle). */
function spotsByWeight(source: StructureSource, floor: number, reference: { u: number; v: number } | undefined): Spot[] {
  const centre: [number, number] = reference ? [reference.u, reference.v] : [source.w / 2, source.d / 2]
  const spots: (Spot & { weight: number })[] = []
  for (const room of source.rooms.filter((r) => r.floor === floor && !NOT_UNDER_TANK.includes(r.type))) {
    for (const part of room.parts) {
      const rect: Rect = [part[0] + 0.4, part[1] + 0.4, part[2] - 0.4, part[3] - 0.4]
      if (rect[2] - rect[0] < TANK_SIDE || rect[3] - rect[1] < TANK_SIDE) continue
      const base = WET_ROOMS.includes(room.type) ? 0 : room.type === 'terrace' ? 500 : 100
      const weight = base + Math.hypot((rect[0] + rect[2]) / 2 - centre[0], (rect[1] + rect[3]) / 2 - centre[1])
      spots.push({ roomType: room.type, roomId: room.id, rect, weight })
    }
  }
  return spots.sort((a, b) => a.weight - b.weight)
}

/** Rise of the tiled roof the renderer draws per metre of run (0.5 for clay and concrete tiles, 0.2 for fibre cement) and its eave overhang. */
const ROOF_SLOPE = { tile: 0.5, fiberCement: 0.2 } as const
/** The roof's eave sits this much over the top ceiling (the masonry band that closes the eave). */
const EAVE_OVER_CEILING = 0.2
/** Room left between the top of the tank (its lid) and the underside of the tiles: battens, rafters and a hand to open the lid. */
const TANK_ROOF_CLEARANCE = 0.35
const PLATFORM_THICKNESS = 0.12
const MIN_PLATFORM_RISE = 0.3
/** An attic tank stands on the ceiling, which the renderer draws 0.2 m thick over the slab's height. */
const ATTIC_TANK_BASE = 0.2
/** The renderer draws a 12 cm lid over the tank's body. */
const TANK_LID = 0.12
/** How far the castle's wall lines stand out of the tank's sides, and the depth of its roof's timber under the tiles. */
const CASTLE_REACH = 0.3
const CASTLE_FRAME = 0.12

const OPEN_ROOMS = ['void', 'balcony', 'terrace', 'porch', 'veranda']
const ROOF_OVERHANG = { tile: 0.45, fiberCement: 0.3 } as const

/** The maximal rectangles of the closed rooms of a storey: each one is a hipped cover of its own (the renderer's roof), and the planes meet at the valleys. */
function roofRects(source: StructureSource, floor: number): Rect[] {
  const parts = source.rooms.filter((r) => r.floor === floor && !OPEN_ROOMS.includes(r.type) && !(r as { outbuilding?: boolean }).outbuilding).flatMap((r) => r.parts as Rect[])
  const xs = [...new Set(parts.flatMap((r) => [r[0], r[2]]))].sort((a, b) => a - b)
  const zs = [...new Set(parts.flatMap((r) => [r[1], r[3]]))].sort((a, b) => a - b)
  const inside = (x: number, z: number): boolean => parts.some((r) => x > r[0] && x < r[2] && z > r[1] && z < r[3])
  const full = (i0: number, i1: number, j0: number, j1: number): boolean => {
    if (i0 < 0 || j0 < 0 || i1 >= xs.length - 1 || j1 >= zs.length - 1) return false
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!inside((xs[i]! + xs[i + 1]!) / 2, (zs[j]! + zs[j + 1]!) / 2)) return false
    return true
  }
  const out: Rect[] = []
  for (let i0 = 0; i0 < xs.length - 1; i0++) for (let i1 = i0; i1 < xs.length - 1; i1++) for (let j0 = 0; j0 < zs.length - 1; j0++) for (let j1 = j0; j1 < zs.length - 1; j1++) {
    if (!full(i0, i1, j0, j1) || full(i0 - 1, i1, j0, j1) || full(i0, i1 + 1, j0, j1) || full(i0, i1, j0 - 1, j1) || full(i0, i1, j0, j1 + 1)) continue
    out.push([xs[i0]!, zs[j0]!, xs[i1 + 1]!, zs[j1 + 1]!])
  }
  return out
}

/** Height of the tiled roof over (u, v): the highest of the hipped covers over the point (a gable over the same rectangle is never lower). */
function roofHeightAt(source: StructureSource, covers: readonly Rect[], eaveY: number, u: number, v: number): number {
  const fiber = source.facade.roof === 'fiber_cement'
  const slope = fiber ? ROOF_SLOPE.fiberCement : ROOF_SLOPE.tile
  const overhang = fiber ? ROOF_OVERHANG.fiberCement : ROOF_OVERHANG.tile
  let run = 0
  for (const r of covers) {
    if (u < r[0] || u > r[2] || v < r[1] || v > r[3]) continue
    run = Math.max(run, Math.min(u - r[0], r[2] - u, v - r[1], r[3] - v) + overhang)
  }
  return eaveY + run * slope
}

/** The highest the platform may rise at (u, v) so that the tank's lid stays under the roof at every corner of the tank. */
function riseUnderRoof(source: StructureSource, covers: readonly Rect[], spot: { u: number; v: number; baseY: number }, tankHeight: number): number {
  const eaveY = spot.baseY + EAVE_OVER_CEILING
  const half = TANK_SIDE / 2
  const lowest = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => roofHeightAt(source, covers, eaveY, spot.u + a! * half, spot.v + b! * half)))
  return lowest - TANK_ROOF_CLEARANCE - tankHeight - PLATFORM_THICKNESS - spot.baseY
}

/** Where in the room part the platform fits under the roof best: the target if it fits, else the point of the part with the most room under the roof. */
function underRoofSpot(source: StructureSource, covers: readonly Rect[], rect: Rect, target: readonly [number, number], baseY: number, tankHeight: number, need: number): { u: number; v: number; maxRise: number } {
  const lowU = rect[0] + TANK_SIDE / 2, highU = rect[2] - TANK_SIDE / 2, lowV = rect[1] + TANK_SIDE / 2, highV = rect[3] - TANK_SIDE / 2
  const at = (u: number, v: number): { u: number; v: number; maxRise: number } => ({ u, v, maxRise: riseUnderRoof(source, covers, { u, v, baseY }, tankHeight) })
  const first = at(clamp(target[0], lowU, highU), clamp(target[1], lowV, highV))
  if (first.maxRise >= need) return first
  let best = first
  const steps = 16
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const candidate = at(lowU + ((highU - lowU) * i) / steps, lowV + ((highV - lowV) * j) / steps)
      if (candidate.maxRise > best.maxRise + 1e-6) best = candidate
    }
  }
  return best
}

function raisedPlatform(source: StructureSource, spot: { u: number; v: number; baseY: number; maxRise?: number }, side: number, castleReach?: number): NonNullable<WaterTank['platform']> {
  const { u, v, baseY } = spot
  // under a castle the platform spans between the castle's corner pillars
  const margin = castleReach === undefined ? 0.12 : castleReach + side / 2 - 0.02
  const edge = Math.max(0, Math.min(u, source.w - u, v, source.d - v))
  const wanted = clamp(edge * 0.35 + 0.7, 1.1, 2.4)
  const rise = round2(spot.maxRise === undefined ? wanted : clamp(Math.min(wanted, spot.maxRise), MIN_PLATFORM_RISE, 2.4))
  const thickness = PLATFORM_THICKNESS
  const reach = TANK_SIDE / 2 + margin - side / 2
  const pillars = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([a, b]) => ({ u: round2(u + a * reach), v: round2(v + b * reach), side }))
  const half = TANK_SIDE / 2 + margin
  return { aabb: [u - half, v - half, u + half, v + half].map(round2) as Rect, baseY, height: rise, thickness, topY: round2(baseY + rise + thickness), pillars, ladder: true }
}

/** The tank on a timber trestle 1 m out of the house's nearest side to the room it serves, its body over the eave so the water reaches every tap. */
function trestleBeside(source: StructureSource, tank: WaterTank, room: Rect, eaveY: number): WaterTank {
  const cu = (room[0] + room[2]) / 2, cv = (room[1] + room[3]) / 2
  const sides: readonly [number, number, number][] = [[cu, -1 - TANK_SIDE / 2, cv], [cu, source.d + 1 + TANK_SIDE / 2, source.d - cv], [-1 - TANK_SIDE / 2, cv, cu], [source.w + 1 + TANK_SIDE / 2, cv, source.w - cu]]
  const [u, v] = sides.reduce((best, s) => (s[2] < best[2] ? s : best))
  const height = round2(eaveY + 0.6)
  const reach = TANK_SIDE / 2 - 0.05
  const pillars = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([a, b]) => ({ u: round2(u + a * reach), v: round2(v + b * reach), side: 0.1 }))
  return { ...tank, place: 'trestle', floor: 0, room: 'yard', u: round2(u), v: round2(v), y: height, aabb: [u - TANK_SIDE / 2, v - TANK_SIDE / 2, u + TANK_SIDE / 2, v + TANK_SIDE / 2].map(round2) as Rect, stand: { pillars, material: 'wood_hard', height, braces: true } }
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
  // the body of a polyethylene tank (the renderer adds its 12 cm lid): 500 L stands 0.73 m in all, 1000 L 0.91 m; the Visor drew them taller
  const height = options.underRoof === false ? (capacity >= 2000 ? 1.4 : capacity === 1000 ? 1.0 : 0.85) : capacity >= 2000 ? 1.2 : capacity === 1000 ? 0.79 : 0.61
  const place = options.location ? options.location(source, rng) : source.facade.roof === 'slab' ? 'slab' : rng() < ATTIC_CHANCE ? 'attic' : 'raised_slab'
  const reference = (source.facade.slab as { waterTank?: { u: number; v: number } } | undefined)?.waterTank
  const spots = spotsByWeight(source, floor, reference)
  if (!spots.length) return null
  const targetOf = (s: Spot): [number, number] => (reference ? [reference.u, reference.v] : [(s.rect[0] + s.rect[2]) / 2, (s.rect[1] + s.rect[3]) / 2])
  const ceilingY = round2(level.y0 + level.ceiling)
  // under a pitched roof the platform goes to the first spot where it fits under the tiles (else where there is most room); elsewhere to the best spot
  // what the spot must leave over the slab: a platform's least rise, or the ceiling an attic tank stands on (0.2 m, less the platform it does not have)
  const need = place === 'attic' ? ATTIC_TANK_BASE - PLATFORM_THICKNESS : MIN_PLATFORM_RISE
  const covers = (place === 'raised_slab' || place === 'attic') && options.underRoof !== false ? roofRects(source, floor) : []
  const fitted = covers.length
    ? spots.map((s) => ({ s, at: underRoofSpot(source, covers, s.rect, targetOf(s), ceilingY, height, need) })).reduce<{ s: Spot; at: { u: number; v: number; maxRise: number } } | null>((chosen, c) => (chosen && chosen.at.maxRise >= need ? chosen : !chosen || c.at.maxRise > chosen.at.maxRise ? c : chosen), null)
    : null
  const spot = fitted ? fitted.s : spots[0]!
  const target = targetOf(spot)
  const u = fitted ? fitted.at.u : clamp(target[0]!, spot.rect[0] + TANK_SIDE / 2, spot.rect[2] - TANK_SIDE / 2)
  const v = fitted ? fitted.at.v : clamp(target[1]!, spot.rect[1] + TANK_SIDE / 2, spot.rect[3] - TANK_SIDE / 2)
  // a roof too low for any platform (a low fibre-cement roof) keeps the tank on the ceiling slab, in the attic
  // too low for a platform: the attic if the tank fits there, else a castle (a raised roof of its own) over a platform of the least rise
  // a castle is confined masonry: only a house of reinforced concrete and masonry raises one (a timber or improvised house keeps the tank in its attic)
  const masonry = source.construction ? !!source.construction.frame.rebar : true
  const castle = masonry && !!fitted && fitted.at.maxRise < ATTIC_TANK_BASE - PLATFORM_THICKNESS
  const where = spot.roomType === 'terrace' ? 'slab' : castle ? 'raised_slab' : fitted && place === 'raised_slab' && fitted.at.maxRise < MIN_PLATFORM_RISE ? 'attic' : place
  const slabY = round2(spot.roomType === 'terrace' ? level.y0 : level.y0 + level.ceiling)
  const tank: WaterTank = {
    id: 'water_tank', kind: 'water_tank', itemType: 'water_tank', place: where, floor, room: spot.roomId, u: round2(u), v: round2(v), y: slabY, w: TANK_SIDE, d: TANK_SIDE, h: height,
    capacity, aabb: [u - TANK_SIDE / 2, v - TANK_SIDE / 2, u + TANK_SIDE / 2, v + TANK_SIDE / 2].map(round2) as Rect,
  }
  // a timber, improvised or canvas house whose roof cannot hold the tank stands it on a timber trestle in the yard, beside the room it serves
  if (!masonry && fitted && fitted.at.maxRise < ATTIC_TANK_BASE - PLATFORM_THICKNESS) return trestleBeside(source, tank, spot.rect, level.y0 + level.ceiling)
  if (where === 'raised_slab') {
    tank.platform = raisedPlatform(source, { u, v, baseY: slabY, ...(fitted ? { maxRise: castle ? MIN_PLATFORM_RISE : fitted.at.maxRise } : {}) }, options.pillarSide ?? TANK_PILLAR_SIDE, castle ? CASTLE_REACH : undefined)
    tank.y = tank.platform.topY
    if (castle) {
      const side = options.pillarSide ?? TANK_PILLAR_SIDE
      const reach = TANK_SIDE / 2 + CASTLE_REACH
      tank.castle = { aabb: [u - reach, v - reach, u + reach, v + reach].map(round2) as Rect, baseY: slabY, eaveY: round2(tank.y + height + TANK_LID + TANK_ROOF_CLEARANCE + CASTLE_FRAME), thickness: Math.min(side, 0.15) }
    }
  }
  return tank
}
