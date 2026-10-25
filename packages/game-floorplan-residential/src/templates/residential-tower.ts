import type { DoorDef, FloorplanOptions, RoomDef, TemplateDef, WindowDef } from '@adatechnology/game-floorplan'
import { SKYSCRAPER_DEFAULTS, buildSkyscraper, exteriorWindows, skyscraperLayout, stripDoor, towerFloors } from '@adatechnology/game-floorplan-structure'
import type { PlateRect, PlateStrip, SkyscraperLayout, SkyscraperOptions, SkyscraperPreset, StripFiller, TowerPlate } from '@adatechnology/game-floorplan-structure'
import { r2 } from '../util'

/**
 * The residential tower: 30 storeys (20 to 60) of 2.8 m clear height on 9 m bays with a punched masonry facade (brick infill with a window in each bay),
 * a plant floor every 25 storeys and a tuned mass damper above 150 m, standing on piles to the sand under soft clay in a city wind.
 */
export const RESIDENTIAL_TOWER_DEFAULTS: SkyscraperPreset = {
  ...SKYSCRAPER_DEFAULTS,
  storeys: 30,
  range: [20, 60],
  height: 2.8,
  bay: [9, 9],
  bays: [3, 3],
  facade: 'punched',
  mechanicalEvery: 25,
  damperAbove: 150,
}

/** The rooms of the plan, besides the numbers of the structure. */
export interface ResidentialTowerPlan {
  /** Target width of an apartment along the facade (default 9.5 m). */
  apartment?: number
  /** Strips shorter than this (default 8 m: the ends of the plate) hold a shared room (laundry, storage) instead of an apartment. */
  apartmentMin?: number
  /** Width of the entrance door on the ground floor (default 3 m). */
  entrance?: number
  /** Sill and head of the windows (default 0.9 and 2.4 m). */
  window?: { y0: number; y1: number }
}

export const RESIDENTIAL_PLAN_DEFAULTS = { apartment: 9.5, apartmentMin: 8, entrance: 3, window: { y0: 0.9, y1: 2.4 } } as const

export const residentialTowerLayout = (options: SkyscraperOptions = {}, preset: SkyscraperPreset = RESIDENTIAL_TOWER_DEFAULTS): SkyscraperLayout => skyscraperLayout(options, preset)

/** The destructible tower (core, piles, punched facade, plant floors, damper) of the layout; the plan above it comes from the template. */
export const buildResidentialTower = (options: SkyscraperOptions = {}, preset: SkyscraperPreset = RESIDENTIAL_TOWER_DEFAULTS): ReturnType<typeof buildSkyscraper> => buildSkyscraper(options, preset)

/** A box of a strip in its own axes: `a` along the strip from its start, `b` deep from the outer wall to the circulation. */
const boxOf = (strip: PlateStrip, a0: number, a1: number, b0: number, b1: number): PlateRect => {
  const [u0, v0, u1, v1] = strip.rect
  if (strip.alongU) return strip.side === 'front' ? [r2(u0 + a0), r2(v0 + b0), r2(u0 + a1), r2(v0 + b1)] : [r2(u0 + a0), r2(v1 - b1), r2(u0 + a1), r2(v1 - b0)]
  return strip.side === 'left' ? [r2(u0 + b0), r2(v0 + a0), r2(u0 + b1), r2(v0 + a1)] : [r2(u1 - b1), r2(v0 + a0), r2(u1 - b0), r2(v0 + a1)]
}

interface Window {
  y0: number
  y1: number
}

/** One apartment in a box of a strip: living and bedroom on the facade, kitchen, entry hall and bathroom against the corridor. */
function apartment(strip: PlateStrip, floor: number, k: number, from: number, to: number, plate: TowerPlate, ceiling: number, win: Window) {
  const wide = to - from, depth = strip.depth, facade = r2(depth * 0.56)
  const id = (name: string) => `apt_${floor}_${strip.id}_${k}_${name}`
  const at = (f0: number, f1: number, b0: number, b1: number) => boxOf(strip, r2(from + wide * f0), r2(from + wide * f1), b0, b1)
  const rooms: RoomDef[] = [
    { id: id('living'), type: 'living', label: 'living', library: 'living_tower', rect: at(0, 0.58, 0, facade) },
    { id: id('bedroom'), type: 'bedroom', label: 'bedroom', rect: at(0.58, 1, 0, facade) },
    { id: id('kitchen'), type: 'kitchen', label: 'kitchen', library: 'kitchen_integrated', rect: at(0, 0.4, facade, depth) },
    { id: id('hall'), type: 'hall', label: 'hall', rect: at(0.4, 0.78, facade, depth) },
    { id: id('bath'), type: 'bathroom', label: 'bathroom', library: 'bathroom_wc', rect: at(0.78, 1, facade, depth) },
  ]
  const doors: DoorDef[] = [
    stripDoor(id('hall'), strip, floor, 0.95),
    { a: id('hall'), b: id('living'), width: 1.0, opensTo: id('living') },
    { a: id('hall'), b: id('kitchen'), width: 0.9, opensTo: id('kitchen') },
    { a: id('hall'), b: id('bedroom'), width: 0.85, opensTo: id('bedroom') },
    { a: id('hall'), b: id('bath'), width: 0.8, opensTo: id('bath') },
  ]
  const windows: WindowDef[] = rooms.filter((r) => r.type === 'living' || r.type === 'bedroom').flatMap((r) => exteriorWindows(r.id, r.rect as PlateRect, plate, ceiling, { ...win, width: 2.2, spacing: 4.5 }))
  // a balcony off the living room on the back of the building (the plate's edge at `d`, as the veranda of `apartment_modern`): the glass door replaces the window there,
  // and the air conditioner of the apartment hangs its condenser on it
  if (strip.side === 'back') {
    const [u0, , u1, v1] = rooms[0].rect as PlateRect
    rooms.push({ id: id('balcony'), type: 'balcony', label: 'balcony', library: 'balcony', rect: [r2(u0 + 0.6), v1, r2(u1 - 0.6), r2(v1 + 1.6)] })
    doors.push({ a: id('living'), b: id('balcony'), width: 1.6, opensTo: id('balcony') })
    return { rooms, doors, windows: windows.filter((w) => !(w.room === id('living') && w.side === 'back')) }
  }
  return { rooms, doors, windows }
}

/** What the strips too short for an apartment hold: the west end a shared laundry, the east end a storage room. */
const SHARED_ROOMS: Record<string, { type: string; label: string }> = { west: { type: 'laundry', label: 'laundry_room' }, east: { type: 'storage', label: 'storage_room' } }

const apartments = (plan: Required<ResidentialTowerPlan>): StripFiller => (strip, { floor, plate, ceiling }) => {
  if (strip.length < plan.apartmentMin) {
    const shared = SHARED_ROOMS[strip.id] ?? SHARED_ROOMS.east
    const id = `${shared.label}_${floor}_${strip.id}`
    return { rooms: [{ id, type: shared.type, label: shared.label, rect: [...strip.rect] }], doors: [stripDoor(id, strip, floor, 0.9)], windows: exteriorWindows(id, strip.rect, plate, ceiling, { ...plan.window, width: 1.2 }) }
  }
  const count = Math.max(1, Math.round(strip.length / plan.apartment)), wide = strip.length / count
  const parts = Array.from({ length: count }, (_, k) => apartment(strip, floor, k, r2(k * wide), r2((k + 1) * wide), plate, ceiling, plan.window))
  return { rooms: parts.flatMap((p) => p.rooms), doors: parts.flatMap((p) => p.doors), windows: parts.flatMap((p) => p.windows) }
}

/** The ground floor: the entrance lobby in the middle of the front, the concierge on one side, the bicycle room on the other; the rest as a typical storey. */
const groundFiller = (plan: Required<ResidentialTowerPlan>): StripFiller => (strip, context) => {
  if (strip.id !== 'south') return apartments(plan)(strip, context)
  const { floor, plate, ceiling } = context
  const lobby = `lobby_${floor}_entrance`, concierge = `concierge_${floor}`, bikes = `bike_room_${floor}`
  const at = (f0: number, f1: number) => boxOf(strip, r2(strip.length * f0), r2(strip.length * f1), 0, strip.depth)
  const [left, middle, right] = [at(0, 0.3), at(0.3, 0.7), at(0.7, 1)]
  const rooms: RoomDef[] = [
    { id: concierge, type: 'office', label: 'concierge', rect: left },
    { id: lobby, type: 'hall', label: 'lobby_entrance', rect: middle },
    { id: bikes, type: 'storage', label: 'bike_room', rect: right },
  ]
  const doors: DoorDef[] = [
    { a: lobby, b: 'outside', side: 'front', at: r2((middle[0] + middle[2]) / 2), width: plan.entrance },
    stripDoor(lobby, strip, floor, Math.min(plan.entrance, 2)),
    { a: concierge, b: lobby, width: 1.2, opensTo: concierge },
    { a: bikes, b: lobby, width: 1.2, opensTo: bikes },
  ]
  return { rooms, doors, windows: exteriorWindows(concierge, left, plate, ceiling, plan.window) }
}

const summary = (l: SkyscraperLayout) => ({ storeys: l.storeys, height: l.height, slab: l.slab, pitch: l.pitch, total: l.total, bay: l.bay, plate: l.plate, mechanical: l.mechanical, facade: l.facade, damper: l.damper })

/**
 * The residential tower template. `options.floors` is the number of storeys (the zone clamps it through `floorRange`), `options.tower` any
 * `SkyscraperOptions`. A game builds its own with other numbers: `residentialTowerTemplate({ ...RESIDENTIAL_TOWER_DEFAULTS, storeys: 40 })`.
 */
export function residentialTowerTemplate(preset: SkyscraperPreset = RESIDENTIAL_TOWER_DEFAULTS, planOptions: ResidentialTowerPlan = {}): TemplateDef {
  const plan = { ...RESIDENTIAL_PLAN_DEFAULTS, ...planOptions }
  const layoutOf = (o: FloorplanOptions): SkyscraperLayout => skyscraperLayout({ ...(o.tower as SkyscraperOptions | undefined), ...(typeof o.floors === 'number' ? { storeys: o.floors } : {}) }, preset)
  const sizeOf = (o: FloorplanOptions) => { const [w, d] = layoutOf(o).plate; return { w: [w, w], d: [d, d] } }
  return {
    id: 'residential_tower', use: 'residential_multi', style: 'mid', lot: null,
    limits: sizeOf({}), defaults: { w: layoutOf({}).plate[0], d: layoutOf({}).plate[1] },
    limitsFn: sizeOf,
    defaultsFn: (o) => { const [w, d] = layoutOf(o).plate; return { w, d } },
    floorRange: [preset.range[0], preset.range[1]],
    floorsFn: (o) => towerFloors(layoutOf(o), { typical: apartments(plan), ground: groundFiller(plan) }),
    config: (o) => ({ tower: summary(layoutOf(o)) }),
  }
}

export const residentialTower: TemplateDef = residentialTowerTemplate()
