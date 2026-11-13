import type { Rect, StructurePart, Support } from '../types'
import { GRAVITY } from './design'

/** A room as the plan carries it: what it is used for, its storey and its rectangles. */
export interface LoadedRoom {
  readonly type: string
  readonly floor: number
  readonly parts: readonly Rect[]
}

/**
 * NBR 6120:2019, table 10 (residential buildings), kN/m²: bedrooms, living and dining rooms, kitchens and bathrooms 1.5; pantries, service areas and
 * laundries 2.0; stairs inside a dwelling 2.5; balconies and terraces 2.5; garages of cars 3.0.
 */
export const LIVE_LOAD_BY_USE: Readonly<Record<string, number>> = {
  bedroom: 1.5, living: 1.5, dining: 1.5, kitchen: 1.5, bathroom: 1.5, office: 1.5, closet: 1.5, cinema: 1.5, gourmet: 1.5, corridor: 1.5, hall: 1.5,
  laundry: 2, pantry: 2, storage: 2, stockroom: 2,
  stairs: 2.5, steps: 2.5, balcony: 2.5, terrace: 2.5, porch: 2.5,
  garage: 3,
}
/** A use the table above does not name: the service-area value, kN/m². */
export const DEFAULT_LIVE_LOAD = 2
/** NBR 6120: a ceiling slab under a roof, with no access but for maintenance, kN/m². */
export const CEILING_SLAB_LIVE_LOAD = 0.5
/** NBR 6120: a flat roof slab reached only for maintenance, kN/m². */
export const ROOF_SLAB_LIVE_LOAD = 1
/** A slab whose top is this close to a storey's floor level is that storey's floor, metres. */
const LEVEL_TOLERANCE = 0.15

export const liveLoadOf = (use: string): number => LIVE_LOAD_BY_USE[use] ?? DEFAULT_LIVE_LOAD

const overlap = (a: readonly number[], b: readonly number[]): number =>
  Math.max(0, Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!)) * Math.max(0, Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!))
const areaOf = (rect: readonly number[]): number => (rect[2]! - rect[0]!) * (rect[3]! - rect[1]!)
/** kN over an area to the mass that weighs as much, kg. */
const kilogramsOf = (kiloNewtons: number): number => (kiloNewtons * 1000) / GRAVITY

/** The variable load on a slab, kN: the rooms of the storey it is the floor of, each by its use, or the roof's maintenance load. */
function slabLiveLoad(slab: StructurePart, rooms: readonly LoadedRoom[], levels: readonly number[]): number {
  const storey = levels.findIndex((level, floor) => floor > 0 && Math.abs(level - slab.y1) <= LEVEL_TOLERANCE)
  if (storey < 0) return (slab.cover ? ROOF_SLAB_LIVE_LOAD : CEILING_SLAB_LIVE_LOAD) * (slab.footprint ?? [slab.aabb]).reduce((sum, rect) => sum + areaOf(rect), 0)
  const over = rooms.filter((room) => room.floor === storey)
  // (a plan given without its rooms: the slab's own footprint at the service-area value, more than any room of a dwelling but the stairs)
  if (!over.length) return DEFAULT_LIVE_LOAD * (slab.footprint ?? [slab.aabb]).reduce((sum, rect) => sum + areaOf(rect), 0)
  return over.reduce((sum, room) => sum + liveLoadOf(room.type) * room.parts.reduce((s, rect) => s + overlap(rect, slab.aabb), 0), 0)
}

/**
 * The variable loads of NBR 6120 as masses on the parts that take them, kg: on each slab, the use of the rooms over it (or the roof's maintenance), and
 * the water of a tank on what it stands on (the tank itself carries none in the load path).
 */
export function liveLoads(parts: readonly StructurePart[], supports: readonly Support[], params: { readonly rooms: readonly LoadedRoom[]; readonly levels: readonly number[] }): Map<string, number> {
  const out = new Map<string, number>()
  const add = (id: string, kg: number): void => {
    if (kg > 0) out.set(id, (out.get(id) ?? 0) + kg)
  }
  for (const slab of parts.filter((part) => part.role === 'slab')) add(slab.id, kilogramsOf(slabLiveLoad(slab, params.rooms, params.levels)))
  for (const tank of parts.filter((part) => part.liters)) {
    const under = supports.filter((support) => support.part === tank.id && support.bears !== false)
    for (const support of under) add(support.on, tank.liters! / under.length)
  }
  return out
}
