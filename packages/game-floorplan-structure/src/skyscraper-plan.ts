import type { DoorDef, FloorDef, RoomDef, WindowDef } from '@adatechnology/game-floorplan'

import type { SkyscraperLayout } from './skyscraper'
import enLocale from './locales/en.json'
import ptBrLocale from './locales/pt-BR.json'

/**
 * The floor plan of a skyscraper at room level, shared by every typology: a central core (stairs, elevator shafts and a service shaft) inside a ring of
 * corridors, with the four strips of the perimeter left for the typology (office suites, apartments) to fill. The plate and the core come from the
 * same `SkyscraperLayout` as the structure (`buildSkyscraper`), so a room of the plan stands where the structure has its slab and its core. The plan is in
 * the space of `game-floorplan` (`u` to the right, `v` to the back, from the front-left corner); the structure is centred (`planToSpace`). Design
 * T10-estrutura-real.md §11.5.
 */

/** `[u0, v0, u1, v1]`. */
export type PlateRect = [number, number, number, number]

export interface PlateOptions {
  /** Width of the corridors around the core (default 1.8 m). */
  corridor?: number
  /** Width of the elevator lobby beside the shafts (default 3 m). */
  lobby?: number
  /** Narrowest the stair room is made (default 3.4 m): the stairs need more than the tube's clear width. */
  stairWidth?: number
}

export const PLATE_DEFAULTS = { corridor: 1.8, lobby: 3, stairWidth: 3.4 } as const

export type StripId = 'south' | 'north' | 'west' | 'east'

/** One of the four bands of the perimeter, where the typology puts its rooms. */
export interface PlateStrip {
  id: StripId
  /** Side of the building the outer edge is on, as `game-floorplan` names it. */
  side: 'front' | 'back' | 'left' | 'right'
  rect: PlateRect
  /** The strip runs along `u` (south and north) or along `v` (west and east). */
  alongU: boolean
  /** Length along the perimeter and depth from the outer wall to the circulation, metres. */
  length: number
  depth: number
  /** Id (without the storey suffix) of the circulation room the inner edge touches: `corridor_s`, `corridor_n`, `corridor_w` or `lobby`. */
  circulation: string
}

export interface TowerPlate {
  w: number
  d: number
  core: PlateRect
  stairs: PlateRect
  service: PlateRect | null
  shafts: PlateRect[]
  lobby: PlateRect
  corridors: { s: PlateRect; n: PlateRect; w: PlateRect }
  strips: PlateStrip[]
}

const r2 = (v: number): number => Math.round(v * 100) / 100

/** The plate of a layout: where the core, its rooms, the circulation and the four strips stand. */
export function towerPlate(layout: SkyscraperLayout, options: PlateOptions = {}): TowerPlate {
  const o = { ...PLATE_DEFAULTS, ...options }
  const [w, d] = layout.plate
  const core = layout.core
  if (!core) throw new Error('A tower plan needs a core (turn the core on)')
  const t = core.wallThickness
  const [W, L] = core.size
  const u = w / 2 + core.center[0], v = d / 2 + core.center[1]
  const rect: PlateRect = [r2(u - W / 2), r2(v - L / 2), r2(u + W / 2), r2(v + L / 2)]
  const [x0, z0, x1, z1] = rect
  const split = r2(Math.min(x1 - 1.8, x0 + Math.max(o.stairWidth, t + core.stairWidth + 0.1)))
  const stairEnd = r2(z0 + Math.min(L, Math.max(5.4, 2 * t + 4.8)))
  const merged = z1 - stairEnd < 1.6
  const stairs: PlateRect = [x0, z0, split, merged ? z1 : stairEnd]
  const service: PlateRect | null = merged ? null : [x0, stairEnd, split, z1]
  const n = core.elevators
  const shafts = Array.from({ length: n }, (_, k): PlateRect => [split, r2(z0 + (k * L) / n), x1, r2(z0 + ((k + 1) * L) / n)])
  const lobby: PlateRect = [x1, z0, r2(x1 + o.lobby), z1]
  const west: PlateRect = [r2(x0 - o.corridor), z0, x0, z1]
  const south: PlateRect = [0, r2(z0 - o.corridor), w, z0]
  const north: PlateRect = [0, z1, w, r2(z1 + o.corridor)]
  const strip = (id: StripId, side: PlateStrip['side'], r: PlateRect, alongU: boolean, circulation: string): PlateStrip => ({
    id, side, rect: r, alongU, length: r2(alongU ? r[2] - r[0] : r[3] - r[1]), depth: r2(alongU ? r[3] - r[1] : r[2] - r[0]), circulation,
  })
  return {
    w, d, core: rect, stairs, service, shafts, lobby, corridors: { s: south, n: north, w: west },
    strips: [
      strip('south', 'front', [0, 0, w, south[1]], true, 'corridor_s'),
      strip('north', 'back', [0, north[3], w, d], true, 'corridor_n'),
      strip('west', 'left', [0, z0, west[0], z1], false, 'corridor_w'),
      strip('east', 'right', [lobby[2], z0, w, z1], false, 'lobby'),
    ],
  }
}

/** A point of the plan (`u`, `v`) in the space of the structure (centred on the plate, `x` right, `z` back). */
export const planToSpace = (layout: SkyscraperLayout, [u, v]: [number, number]): [number, number] => [r2(u - layout.plate[0] / 2), r2(v - layout.plate[1] / 2)]

export type StoreyKind = 'ground' | 'typical' | 'mechanical'

/** What kind each storey is: the first is the ground floor, the mechanical ones are the plant floors of the layout, the rest are typical. */
export const storeyKinds = (layout: SkyscraperLayout): StoreyKind[] =>
  Array.from({ length: layout.storeys }, (_, f) => (f === 0 ? 'ground' : layout.mechanical.includes(f) ? 'mechanical' : 'typical'))

export interface StoreyContext {
  floor: number
  kind: StoreyKind
  layout: SkyscraperLayout
  plate: TowerPlate
  /** Floor to floor, metres: the ceiling of the plan floor. */
  ceiling: number
}

export interface StripFill {
  rooms: RoomDef[]
  doors: DoorDef[]
  windows: WindowDef[]
}

/** Fills one strip of a storey with rooms. Room ids must be unique in the whole tower: end them with the storey (`_${floor}`). */
export type StripFiller = (strip: PlateStrip, storey: StoreyContext) => StripFill

export interface TowerPlanOptions extends PlateOptions {
  /** The perimeter of the typical storeys. */
  typical: StripFiller
  /** The ground floor (default: the typical filler). */
  ground?: StripFiller
  /** The plant floors (default: one plant room per strip, no windows). */
  mechanical?: StripFiller
}

/** Cuts a strip into `count` equal parts along its length. */
export const splitStrip = (strip: PlateStrip, count: number): PlateRect[] => {
  const [u0, v0, u1, v1] = strip.rect
  return Array.from({ length: Math.max(1, count) }, (_, k): PlateRect => {
    const a = k / Math.max(1, count), b = (k + 1) / Math.max(1, count)
    return strip.alongU ? [r2(u0 + (u1 - u0) * a), v0, r2(u0 + (u1 - u0) * b), v1] : [u0, r2(v0 + (v1 - v0) * a), u1, r2(v0 + (v1 - v0) * b)]
  })
}

const EDGE = 1e-6

/**
 * Windows on every outside wall of a room of the plate, `spacing` metres apart (at least one a wall); `y0`, `y1` the sill and head (default 0.3 and the
 * ceiling less 0.5 m, a glass facade).
 */
export function exteriorWindows(id: string, rect: PlateRect, plate: TowerPlate, ceiling: number, o: { spacing?: number; width?: number; y0?: number; y1?: number } = {}): WindowDef[] {
  const [u0, v0, u1, v1] = rect
  const spacing = o.spacing ?? 3
  const out: WindowDef[] = []
  const add = (side: string, length: number) => {
    const n = Math.max(1, Math.round(length / spacing))
    out.push({ room: id, side, n, width: Math.min(o.width ?? 2.4, (length / n) * 0.8), y0: o.y0 ?? 0.3, y1: o.y1 ?? r2(ceiling - 0.5) })
  }
  if (Math.abs(v0) < EDGE) add('front', u1 - u0)
  if (Math.abs(v1 - plate.d) < EDGE) add('back', u1 - u0)
  if (Math.abs(u0) < EDGE) add('left', v1 - v0)
  if (Math.abs(u1 - plate.w) < EDGE) add('right', v1 - v0)
  return out
}

/** The door from a room of a strip to the circulation it touches. */
export const stripDoor = (id: string, strip: PlateStrip, floor: number, width = 1): DoorDef => ({ a: id, b: `${strip.circulation}_${floor}`, width, opensTo: id })

/** The default fill of a plant floor: a plant room on each strip, with a door to the circulation and no windows (the facade has louvres there). */
const plantRooms: StripFiller = (strip, { floor }) => {
  const id = `plant_${floor}_${strip.id}`
  return { rooms: [{ id, type: 'storage', label: 'plant_room', rect: [...strip.rect] }], doors: [stripDoor(id, strip, floor, 1.2)], windows: [] }
}

/** The core and the circulation of a storey: the stairs, the shafts, the service shaft, the lobby and the three corridors, with their doors. */
function coreRooms(plate: TowerPlate, floor: number, storeys: number): { rooms: RoomDef[]; doors: DoorDef[]; openPairs: [string, string][] } {
  const id = (name: string) => `${name}_${floor}`
  const link = floor < storeys - 1 ? [floor, floor + 1] : [floor - 1, floor]
  const rooms: RoomDef[] = [
    { id: id('stairs'), type: 'stairs', label: 'stairs', rect: [...plate.stairs], link },
    ...(plate.service ? [{ id: id('service'), type: 'storage', label: 'service_shaft', rect: [...plate.service] }] : []),
    ...plate.shafts.map((rect, k): RoomDef => ({ id: id(`elevator_${k}`), type: 'elevator', label: 'elevator', rect: [...rect] })),
    { id: id('lobby'), type: 'hall', label: 'elevator_lobby', rect: [...plate.lobby] },
    { id: id('corridor_w'), type: 'corridor', label: 'corridor', rect: [...plate.corridors.w] },
    { id: id('corridor_s'), type: 'corridor', label: 'corridor', rect: [...plate.corridors.s] },
    { id: id('corridor_n'), type: 'corridor', label: 'corridor', rect: [...plate.corridors.n] },
  ]
  const doors: DoorDef[] = [
    { a: id('stairs'), b: id('corridor_w'), width: 1, opensTo: id('corridor_w') },
    ...(plate.service ? [{ a: id('service'), b: id('corridor_w'), width: 0.8, opensTo: id('service') }] : []),
    ...plate.shafts.map((_, k): DoorDef => ({ a: id(`elevator_${k}`), b: id('lobby'), width: 1.2, opensTo: id('lobby') })),
  ]
  const openPairs: [string, string][] = [[id('lobby'), id('corridor_s')], [id('lobby'), id('corridor_n')], [id('corridor_w'), id('corridor_s')], [id('corridor_w'), id('corridor_n')]]
  return { rooms, doors, openPairs }
}

/**
 * The storeys of a tower as `FloorDef`s for `TemplateDef.floorsFn`: each has the core and the circulation, the strips filled by the typology for its
 * kind of storey (ground, typical, plant), `ceiling` the storey pitch of the structure. The template's size must be the plate (`layout.plate`).
 */
export function towerFloors(layout: SkyscraperLayout, plan: TowerPlanOptions): FloorDef[] {
  const plate = towerPlate(layout, plan)
  const fillers: Record<StoreyKind, StripFiller> = { ground: plan.ground ?? plan.typical, typical: plan.typical, mechanical: plan.mechanical ?? plantRooms }
  return storeyKinds(layout).map((kind, floor): FloorDef => {
    const context: StoreyContext = { floor, kind, layout, plate, ceiling: layout.pitch }
    const fills = plate.strips.map((strip) => fillers[kind](strip, context))
    const core = coreRooms(plate, floor, layout.storeys)
    return {
      label: kind === 'ground' ? 'ground_floor' : kind === 'mechanical' ? 'mechanical_floor' : 'typical_floor',
      ceiling: layout.pitch,
      openPairs: core.openPairs,
      rooms: () => [...core.rooms, ...fills.flatMap((f) => f.rooms)],
      doors: () => [...core.doors, ...fills.flatMap((f) => f.doors)],
      windows: () => fills.flatMap((f) => f.windows),
    }
  })
}

/** The names of the rooms and storeys the plan helpers make (`elevator_lobby`, `plant_room`, `typical_floor`...), for the packs that fill the strips to register with `engine.registerLocale`. */
export const towerLocales = { en: { labels: enLocale.labels }, 'pt-BR': { labels: ptBrLocale.labels } } as const
