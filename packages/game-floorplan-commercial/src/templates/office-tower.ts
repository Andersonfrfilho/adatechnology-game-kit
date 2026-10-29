import type { DoorDef, FloorplanOptions, RoomDef, TemplateDef } from '@adatechnology/game-floorplan'
import { SKYSCRAPER_DEFAULTS, SKYSCRAPER_MAX_STOREYS, buildSkyscraper, exteriorWindows, skyscraperLayout, splitStrip, stripDoor, towerFloors } from '@adatechnology/game-floorplan-structure'
import type { PlateStrip, SkyscraperLayout, SkyscraperOptions, SkyscraperPreset, StripFiller, TowerPlate } from '@adatechnology/game-floorplan-structure'
import { r2 } from '../util'

/**
 * The office tower: the numbers of the typology, all of them options of `skyscraperLayout`. 40 storeys (20 to 60, the default maximum `SKYSCRAPER_MAX_STOREYS`; `range` raises it) of 3.6 m clear height on 12 m bays with a
 * glass curtain wall, a plant floor every 20 storeys and a tuned mass damper above 150 m, standing on piles to the sand under soft clay in a city wind.
 */
export const OFFICE_TOWER_DEFAULTS: SkyscraperPreset = {
  ...SKYSCRAPER_DEFAULTS,
  storeys: 40,
  range: [20, SKYSCRAPER_MAX_STOREYS],
  height: 3.6,
  bay: [12, 12],
  bays: [3, 3],
  facade: 'curtain',
  mechanicalEvery: 20,
  damperAbove: 150,
}

/** The rooms of the plan, besides the numbers of the structure. */
export interface OfficeTowerPlan {
  /** Target width of an office suite along the facade (default 9 m); a strip gets as many suites as fit. */
  suite?: number
  /** Width of the entrance door on the ground floor (default 3 m). */
  entrance?: number
  /** Restrooms on a typical storey: one at the end of the north strip (default true). */
  restrooms?: boolean
}

export const OFFICE_PLAN_DEFAULTS = { suite: 9, entrance: 3, restrooms: true } as const

/** The layout of an office tower: the sizes of the structure and the plate of the plan. */
export const officeTowerLayout = (options: SkyscraperOptions = {}, preset: SkyscraperPreset = OFFICE_TOWER_DEFAULTS): SkyscraperLayout => skyscraperLayout(options, preset)

/** The destructible tower (core, piles, facade, plant floors, damper) of the layout; the plan above it comes from the template. */
export const buildOfficeTower = (options: SkyscraperOptions = {}, preset: SkyscraperPreset = OFFICE_TOWER_DEFAULTS): ReturnType<typeof buildSkyscraper> => buildSkyscraper(options, preset)

/** `[from, to]` fractions of a strip along its length. */
const cut = (strip: PlateStrip, from: number, to: number): [number, number, number, number] => {
  const [u0, v0, u1, v1] = strip.rect
  return strip.alongU ? [r2(u0 + (u1 - u0) * from), v0, r2(u0 + (u1 - u0) * to), v1] : [u0, r2(v0 + (v1 - v0) * from), u1, r2(v0 + (v1 - v0) * to)]
}

const suitesOf = (strip: PlateStrip, floor: number, plate: TowerPlate, ceiling: number, plan: Required<OfficeTowerPlan>, skipFirst: boolean) => {
  const rooms: RoomDef[] = [], doors: DoorDef[] = [], windows: ReturnType<typeof exteriorWindows> = []
  splitStrip(strip, Math.max(1, Math.round(strip.length / plan.suite))).forEach((rect, k) => {
    if (skipFirst && k === 0) {
      const id = `restroom_${floor}`
      rooms.push({ id, type: 'bathroom', label: 'washrooms', library: 'bathroom_wc', rect })
      doors.push(stripDoor(id, strip, floor, 0.9))
      return
    }
    const id = `suite_${floor}_${strip.id}_${k}`
    rooms.push({ id, type: 'office', label: 'office_suite', library: 'office_open', rect })
    doors.push(stripDoor(id, strip, floor, 1.2))
    windows.push(...exteriorWindows(id, rect, plate, ceiling))
  })
  return { rooms, doors, windows }
}

const officeFiller = (plan: Required<OfficeTowerPlan>): StripFiller => (strip, { floor, plate, ceiling }) =>
  suitesOf(strip, floor, plate, ceiling, plan, plan.restrooms && strip.id === 'north' && Math.round(strip.length / plan.suite) >= 3)

/** The ground floor: the entrance lobby in the middle of the front, reception on one side, the security desk on the other, the building's stockroom on the west side; the rest as a typical storey. */
const groundFiller = (plan: Required<OfficeTowerPlan>): StripFiller => (strip, context) => {
  if (strip.id === 'west') {
    const id = `stockroom_${context.floor}`
    return { rooms: [{ id, type: 'stockroom', label: 'stockroom', rect: [...strip.rect] }], doors: [stripDoor(id, strip, context.floor, 1.2)], windows: [] }
  }
  if (strip.id !== 'south') return officeFiller(plan)(strip, context)
  const { floor, plate, ceiling } = context
  const lobby = `lobby_${floor}_entrance`, reception = `reception_${floor}`, security = `security_${floor}`
  const [left, middleRect, right] = [cut(strip, 0, 0.3), cut(strip, 0.3, 0.7), cut(strip, 0.7, 1)]
  const rooms: RoomDef[] = [
    { id: reception, type: 'office', label: 'reception', library: 'office_open', rect: left },
    { id: lobby, type: 'hall', label: 'lobby_entrance', rect: middleRect },
    { id: security, type: 'office', label: 'security_desk', rect: right },
  ]
  const middle = r2((middleRect[0] + middleRect[2]) / 2)
  const doors: DoorDef[] = [
    { a: lobby, b: 'outside', side: 'front', at: middle, width: plan.entrance },
    stripDoor(lobby, strip, floor, Math.min(plan.entrance, 2)),
    { a: reception, b: lobby, width: 1.2, opensTo: reception },
    { a: security, b: lobby, width: 1.2, opensTo: security },
  ]
  return { rooms, doors, windows: [...exteriorWindows(reception, left, plate, ceiling), ...exteriorWindows(security, right, plate, ceiling)] }
}

const summary = (l: SkyscraperLayout) => ({ storeys: l.storeys, height: l.height, slab: l.slab, pitch: l.pitch, total: l.total, bay: l.bay, plate: l.plate, mechanical: l.mechanical, facade: l.facade, damper: l.damper })

/**
 * The office tower template. `options.floors` is the number of storeys (the zone clamps it through `floorRange`), `options.tower` any
 * `SkyscraperOptions` (bays, height, facade...). A game builds its own with other numbers: `officeTowerTemplate({ ...OFFICE_TOWER_DEFAULTS, storeys: 60 })`.
 */
export function officeTowerTemplate(preset: SkyscraperPreset = OFFICE_TOWER_DEFAULTS, planOptions: OfficeTowerPlan = {}): TemplateDef {
  const plan = { ...OFFICE_PLAN_DEFAULTS, ...planOptions }
  const layoutOf = (o: FloorplanOptions): SkyscraperLayout => skyscraperLayout({ ...(o.tower as SkyscraperOptions | undefined), ...(typeof o.floors === 'number' ? { storeys: o.floors } : {}) }, preset)
  const sizeOf = (o: FloorplanOptions) => { const [w, d] = layoutOf(o).plate; return { w: [w, w], d: [d, d] } }
  return {
    id: 'office_tower', use: 'commercial', place: 'office', style: 'commercial', lot: null,
    limits: sizeOf({}), defaults: { w: layoutOf({}).plate[0], d: layoutOf({}).plate[1] },
    limitsFn: sizeOf,
    defaultsFn: (o) => { const [w, d] = layoutOf(o).plate; return { w, d } },
    floorRange: [preset.range[0], preset.range[1]],
    floorsFn: (o) => { const layout = layoutOf(o); return towerFloors(layout, { typical: officeFiller(plan), ground: groundFiller(plan) }) },
    config: (o) => ({ tower: summary(layoutOf(o)) }),
  }
}

export const officeTower: TemplateDef = officeTowerTemplate()
