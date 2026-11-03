import type { Palette, PaletteContext } from './palette'
import type { Rng } from './rng'

/** Axis-aligned rectangle `[u0, v0, u1, v1]`. `u` runs along the facade, `v` from the street to the back. */
export type Rect = [number, number, number, number]
export type Vec2 = [number, number]
export type Weights = Record<string, number>

/** An open value from a template or a plugin: narrow it before use. */
export type Json = unknown

export type MeshFront = '+z' | '-z' | '+x' | '-x'
export type Mount = 'ceiling' | 'wall' | 'window' | 'support' | 'floor' | 'roof' | 'ground' | 'wall_top' | (string & {})

/** How an item is coloured: a palette role, a fixed colour, or a seeded pick from a list. */
export type ItemColor = { role: string } | { hex: number } | { pick: number[] }

export interface FurnitureDef {
  type: string
  category: string
  w: number
  d: number
  h: number
  /** Local mesh axis that is the front (default `+z`). */
  front: MeshFront
  /** May sit under a window (default: `h <= 0.95`). */
  window: boolean
  /** Does not need a clearance in front (default: `h <= 0.5`). */
  low: boolean
  /** Rugs, decks: ignores collisions. */
  flat: boolean
  deck: boolean
  /** Keep-out margin around the item (pools). */
  rim: number
  decor?: boolean
  /** Hangs a wall cabinet over the counter (y 1.55 to 2.15 m): it blocks a window unless the fill dropped the cabinet. */
  overhead?: boolean
  /** Effective height that blocks a window when taller than `h` (a shower enclosure is 0.1 m tray plus 1.95 m glass). */
  windowHeight?: number
  /** Plugs into a socket (lamps, appliances). */
  powered?: boolean
  /** Only picked when a slot names its exact type (`=type`), never through its category. */
  exactOnly?: boolean
  mount?: Mount
  equip?: string[]
  color?: ItemColor
}
export type ItemInput = Pick<FurnitureDef, 'type' | 'category' | 'w' | 'd' | 'h'> & Partial<FurnitureDef>

export type Anchor = 'wall' | 'corner' | 'center' | 'window' | 'on' | 'inside'
export type Side = 'left' | 'right' | 'front' | 'back' | 'any'
export type FacingRule = 'center' | 'door' | 'target' | 'u+' | 'u-' | 'v+' | 'v-'

export interface SlotDef {
  id: string
  anchor: Anchor
  size?: number[]
  cats: Weights
  side?: Side
  pos?: number
  shift?: number
  corner?: string
  fx?: number
  fz?: number
  dx?: number
  dz?: number
  on?: string
  n?: number
  part?: number
  required?: boolean
  chance?: number
  clearance?: number
  group?: string
  requires?: string
  facing?: FacingRule
  target?: string
  slide?: number
  /** Parent slot id of an `on`/`inside` slot (copied from `on` when the room's slots are expanded). */
  parent?: string
  /** The slot may sit over door and stair swing zones. */
  floorFree?: boolean
  [extra: string]: Json
}

export type SlotLibrary = SlotDef[] | ((room: { w: number; d: number }) => SlotDef[])

export interface SlotKit {
  wall(id: string, side: Side, pos: number, size: number[], cats: Weights, o?: Partial<SlotDef>): SlotDef
  corner(id: string, corner: string, size: number[], cats: Weights, o?: Partial<SlotDef>): SlotDef
  center(id: string, fx: number, fz: number, size: number[], cats: Weights, o?: Partial<SlotDef>): SlotDef
  windowSlot(id: string, size: number[], cats: Weights, o?: Partial<SlotDef>): SlotDef
  on(id: string, parent: string, cats: Weights, o?: Partial<SlotDef>): SlotDef
  inside(id: string, parent: string, cats: Weights, o?: Partial<SlotDef>): SlotDef
}

export interface RoomDef {
  id: string
  type: string
  label?: string
  rect: number[]
  parts?: number[][]
  library?: string
  without?: string[]
  overrides?: Record<string, Json>
  extras?: SlotDef[]
  slots?: SlotLibrary
  link?: number[]
  outdoor?: boolean
  ceiling?: number
  seedKey?: string
  [extra: string]: Json
}

export interface DoorDef {
  a: string
  b: string
  side?: string
  at?: number
  width: number
  opensTo?: string
  steel?: boolean
  /** Clear wall from the opening to a corner or junction; defaults to the template's `clearance.door`, else 0.12 m. */
  clearance?: number
  /** Explicit position instead of a wall edge (a tent flap in the middle of the lot). */
  edge?: { axis: 'u' | 'v'; pos: number; a0: number; a1: number }
  model?: string
  type?: string
  steps?: number
  [extra: string]: Json
}
export interface WindowDef {
  room: string
  side: string
  at?: number
  n?: number
  width: number
  y0?: number
  y1?: number
  [extra: string]: Json
}

export interface FloorDef {
  label?: string
  ceiling: number
  openPairs?: [string, string][]
  rooms(w: number, d: number, options: FloorplanOptions): RoomDef[]
  doors(w: number, d: number, options: FloorplanOptions): DoorDef[]
  windows(w: number, d: number, options: FloorplanOptions): WindowDef[]
}

export interface GateCfg {
  u: number
  width: number
  to?: string
}
export interface LotConfig {
  frontSetback: number
  marginLeft: number
  marginRight: number
  backyardDepth: number
  parking?: { width: number }
  garage?: GateCfg
  pedestrian?: { u: number }
  cargo?: GateCfg
  doorTarget?: { a: string; side: string }
  libraries?: Record<string, string>
  /** Lot zones over the building area (a camp). */
  extraZones?: { id: string; type: string; label?: string; parts: Rect[]; library?: string }[]
  yardZones?: { id: string; type: string; label?: string; v0: number; v1: number; library?: string }[]
  grounds?: Record<string, string>
  pool?: boolean
}

export interface TemplateDef {
  id: string
  /** Declared use for zoning, e.g. `residential_single`. */
  use?: string
  style: string | ((o: FloorplanOptions) => string)
  limits: { w: number[]; d: number[] }
  defaults: { w: number; d: number }
  limitsFn?: (o: FloorplanOptions) => TemplateDef['limits']
  defaultsFn?: (o: FloorplanOptions) => TemplateDef['defaults']
  floors?: FloorDef[]
  floorsFn?: (o: FloorplanOptions) => FloorDef[]
  /** Highest floor count the template can reach (zoning); defaults to the generated floor count. */
  /** Adjustable storey count `[min, max]` through `options.floors`; lets zoning clamp the plan. */
  floorRange?: [number, number]
  lot?: ((w: number, d: number, style: StyleDef, o: FloorplanOptions) => LotConfig) | null
  facade?: { balcony?: boolean; veranda?: boolean; steelDoor?: boolean }
  facadeExtra?: (facade: Facade, rng: Rng, w: number, d: number, o: FloorplanOptions) => void
  building?: (w: number, d: number, o: FloorplanOptions) => Json
  singleFloor?: boolean
  /** Place tag of the building for finds (`house`, `pharmacy`...). */
  place?: string
  /** Building system the structure pack builds (a reference registered there). */
  construction?: string
  /** Region of the content (`br`...), chosen by the pack that registered the template. */
  region?: string
  /** Clear wall around openings: from a door to a corner or junction, and from a window to a corner, junction or door. */
  clearance?: { door?: number; window?: number }
  /** No walls are built (a tent): rooms and openings stay. */
  noWalls?: boolean
  /** Storey heights add up (a mezzanine with a different ceiling) instead of `index * ceiling`. */
  cumulativeCeilings?: boolean
  /** Settings the packs read from the plan (`power`: `grid`, `offgrid` or `tap`; `solar`); it lands in `result.config`. */
  config?: (o: FloorplanOptions, w: number, d: number) => Json
  /** Marks lot areas taken by the building (chimney, tank, tents) as keep-out zones for the lot fill. */
  reservations?: (plan: Plan) => void
  /** Own paths from the doors that sit away from the building edge (tents); replaces the generated ones. */
  paths?: (plan: Plan, context: { gates: PlanGate[]; setback: number; marginLeft: number; marginRight: number; backyard: number; w: number; d: number }) => LotPath[]
  /** Sides built against a neighbour (`left` / `right`): exempt from the side setback. */
  partyWalls?: ('left' | 'right')[]
  options?: Json
  [extra: string]: Json
}

export interface BoundaryRule {
  type: Weights
  top: Weights
}
export interface StyleDef {
  id: string
  /** Other ids resolving to this style. */
  aliases?: string[]
  /** Name of the legacy palette RNG stream (kept so old seeds still reproduce). */
  seedKey?: string
  height: number
  /** Height of a fence boundary (default 2.0 m). */
  fenceHeight?: number
  front: BoundaryRule
  sideYard: BoundaryRule
  back: BoundaryRule
  gate: { garage: Weights }
  facade: { finish: Weights; grilles: number; roof: Weights }
  /** Facade swatches `[labelKey, hex]`. */
  swatches: [string, string][]
  /** Ground type weights per lot zone type. */
  grounds: Record<string, Weights>
}

export interface CarClearance {
  /** Clear space beside the driver door (m). */
  driver: number
  /** Clear space on the passenger side (m). */
  side: number
  /** Clear space in front of and behind the car (m). */
  end: number
}

// ---- result extensions and finds ----
export interface ResultExtensionContext {
  plan: Plan
  /** The result built so far: the plan, the items, the state items and the extensions that ran before. */
  result: FloorplanResult
  seed: number | string
  /** Seeded stream of the extension: `createRng(seed, seedKey ?? name)`. */
  rng: Rng
  options: FloorplanOptions
}
export type ResultExtensionRun = (context: ResultExtensionContext) => unknown
export interface ResultExtensionOptions {
  /** Extensions that must run first. */
  after?: string[]
  /** Name of the seeded stream; defaults to the extension name. A pack sets the name of the team's own flow to reproduce its seeds. */
  seedKey?: string
}

export interface FindStack {
  readonly itemId: string
  readonly count: number
  readonly data?: { readonly ageDays?: number; readonly condition?: number; readonly charge?: number; readonly fill?: number }
}
export interface FindsQuery {
  /** Kind of place (`TemplateDef.place`, a room type, a lot zone type). */
  place: string
  /** Kind of container (a furniture category). */
  container: string
  state: string
  rng: Rng
  /** Outbreak days; 0 is the normal world. */
  day?: number
  region?: string
  /** Footprint of the place in m². */
  footprint?: number
  key?: string
}
/**
 * Answers what a container holds. Registered by an item pack; the engine only keeps the registry. An array is the answer, even an empty one (an abandoned
 * cupboard that holds nothing); `null` means this provider does not know the container, and the next provider (or the default of the pack) answers.
 */
export interface FindsProvider {
  findsFor(query: FindsQuery): readonly FindStack[] | null
}

export interface FloorplanOptions {
  /** Number of storeys, for templates that accept it. */
  floors?: number
  /** Building system of the structure pack (`masonry`, `wood_frame`, ...). */
  construction?: string
  /** How finely the structure pack splits the walls (`coarse`, `panels`, `units`). */
  wallDetail?: 'coarse' | 'panels' | 'units'
  /** Radius of the player body (m, default 0.24): a disc this wide must pass between doors and rooms once the furniture is placed. */
  playerRadius?: number
  /** Space a parked car keeps from walls (default driver 0.8, side 0.6, end 0.6). */
  carClearance?: Partial<CarClearance>
  seed?: number | string
  w?: number
  d?: number
  style?: string
  state?: string
  /** Quality tier used by some templates. */
  tier?: string
  floor?: number
  /** Output language for names and messages (default `en`). */
  locale?: string
  /** Urban zone id or definition to clamp the plan to. */
  zone?: string | ZoneDef
  /** Outbreak days for the finds (`FindsQuery.day`); 0 or none is the normal world. */
  day?: number
  /** Region of the world for the finds (`FindsQuery.region`), as the item pack names it. */
  region?: string
  [extra: string]: Json
}

// ---- plan (internal) ----
export interface Room {
  id: string
  type: string
  label?: string
  floor: number
  parts: Rect[]
  library: string | null
  without: string[]
  overrides: Record<string, Json>
  extras: SlotDef[]
  slots: SlotLibrary | null
  link: number[] | null
  outdoor: boolean
  ceiling: number | null
  seedKey?: string
  ground?: string
}

/** Axis a wall or opening runs along: `u` is across the lot (x), `v` is front to back (z). */
export type PlanAxis = 'u' | 'v'

/** A door placed on a wall of one storey (`Plan.doors`). */
export interface PlanDoor {
  id: string
  floor: number
  u: number
  v: number
  axis: PlanAxis
  /** Position of the wall line on the other axis. */
  pos: number
  /** Centre of the door along the wall. */
  at: number
  width: number
  /** Room on each side; `b` is `outside` on an exterior door. */
  a: string
  b: string
  opensTo: string
  exterior: boolean
  side: string | null
  leaves: number
  model: string
  type: string
  steps: number
  hinge: string
  /** Swing areas on both sides that furniture keeps clear of. */
  zones: Rect[]
  /** Left open (set by a house state). */
  open?: boolean
  /** Blocked shut, e.g. barricaded (set by a house state). */
  blocked?: boolean
}

/** One straight piece of wall or railing of one storey (`Plan.walls`). */
export interface PlanWall {
  floor: number
  axis: PlanAxis
  u0: number
  v0: number
  u1: number
  v1: number
  thickness: number
  /** Room ids on each face (`outside` for the street side). */
  sides: [string, string]
  exterior: boolean
  type: 'railing' | 'wall'
  /** Height in metres (the storey ceiling for a full wall). */
  h: number
}

/** A window on an exterior wall (`Plan.windows`). */
export interface PlanWindow {
  id: string
  floor: number
  u: number
  v: number
  axis: PlanAxis
  pos: number
  at: number
  width: number
  /** Sill and head heights above the storey floor. */
  y0: number
  y1: number
  room: string
  side: string
  /** Boarded up (set by a house state). */
  boards?: boolean
}

/** A gate in the lot boundary (`Plan.gates`). */
export interface PlanGate {
  id: string
  type: string
  model: string
  u: number
  v: number
  axis: PlanAxis
  width: number
  height: number
  side: string
  /** What the gate leads to (`door`, `inner_garage`...), or null. */
  to: string | null
  material: string
  zones: Rect[]
  /** Starts open (set by a template or a later pass). */
  open?: boolean
}

/** A door or a lot gate: anything a path or the furniture fill has to keep clear. */
export type PlanOpening = PlanDoor | PlanGate

/** A walkway or driveway across the lot (`Plan.paths`). */
export interface LotPath {
  id: string
  type: 'pedestrian' | 'vehicle' | string
  /** Gate the path starts at, or null when it starts at no gate. */
  from: string | null
  to: string
  width: number
  rects: Rect[]
  points: Vec2[]
}

/** How one side of the lot is closed (wall, fence or railing). */
export interface LotBoundary {
  type: string
  material: string
  height: number
  top: string
  totalHeight: number
  thickness: number
}

/** One straight piece of the lot boundary. */
export interface LotPerimeterPiece extends LotBoundary {
  id: string
  side: string
  u0: number
  v0: number
  u1: number
  v1: number
}

/** The lot around the building (`Plan.lot`). */
export interface Lot {
  rect: Rect
  setback: number
  sideYard: { left: number; right: number }
  backyard: number
  style: string
  zones: Room[]
  perimeter: LotPerimeterPiece[]
  gates: PlanGate[]
  paths: LotPath[]
  pool: boolean
}

/** The known fields of a facade. */
export interface FacadeFields {
  style: string
  color: { name: string; hex: string }
  finish: string
  grilles: boolean
  roof: string
  balcony: boolean
  veranda: boolean
  steelDoor: boolean
  floors: number
}

/** The look of the building from the street (`Plan.facade`); templates may add fields through `facadeExtra`. */
export interface Facade extends FacadeFields {
  [extra: string]: unknown
}

export interface Plan {
  w: number
  d: number
  tpl: TemplateDef
  floorDefs: FloorDef[]
  style: string
  floors: { index: number; name?: string; number?: number; y0: number; ceiling: number }[]
  rooms: Room[]
  zones: Room[]
  doors: PlanDoor[]
  windows: PlanWindow[]
  walls: PlanWall[]
  gates: PlanGate[]
  paths: LotPath[]
  lot: Lot | null
  facade?: Facade
  openPairs: Record<number, [string, string][]>
  zoning?: ZoningReport
  /** Lot areas the building keeps out of the fill (set by `TemplateDef.reservations`). */
  reservations: Rect[]
  /** The options the plan was built with (seed included). */
  options: FloorplanOptions
  /** Result of `TemplateDef.config`. */
  config?: Json
  /** Cache of the wall bodies per storey, filled by the walkability grid. */
  wallBodies?: Record<number, Rect[]>
  playerRadius: number
  carClearance: CarClearance
}

/** Where a resolved slot sits inside the room: its cell, facing, the room part and the walls it leans on. */
export interface SlotCell {
  rect: Rect
  f: Vec2
  enclosed: string[]
  R: Rect
  size: Vec2
}

/** The known fields of a resolved slot. */
export interface SlotFields {
  id: string
  room: string
  floor: number
  outdoor: boolean
  anchor: string
  side: string | null
  cats: Weights
  slide?: number
  required: boolean
  chance: number
  clearance: number
  front: string
  group: string | null
  requires: string | null
  /** Parent slot of an `on`/`inside` slot. */
  on: string | null
  target: string | null
  valid: boolean
  reason: string | null
  x: number
  z: number
  ry: number
  w: number
  d: number
  frontU: number
  frontV: number
  aabb: Rect
  /** Null on an invalid slot. */
  _cell: SlotCell | null
}

/** A slot of a room after it has been placed (`resolveSlot`); a library may carry fields of its own. */
export interface Slot extends SlotFields {
  [extra: string]: Json
}

/** The known fields of a placed item (`PlacedItem` without its open extras). */
export interface PlacedItemFields {
  id: string
  type: string
  category: string
  x: number
  z: number
  ry: number
  w: number
  d: number
  h: number
  y: number
  room: string | null
  floor: number
  outdoor: boolean
  aabb: Rect
  color?: number | string
  /** Facing of the item's front. */
  frontU?: number
  frontV?: number
  /** Slot that placed it, and the item it stands on or in. */
  slot?: string
  on?: string | null
  mode?: 'on' | 'inside' | null
  clearance?: number
  flat?: boolean
  low?: boolean
  decor?: boolean
  overhead?: boolean
  /** Driver side of a car (unit vector). */
  driver?: Vec2
  carClearance?: CarClearance
  /** Storeys a stair or passage room connects, or the id of the item this one serves (a gas cylinder names its stove). */
  link?: { from: number; to: number } | string
  /** Unrounded footprint used by the fill, dropped from the result. */
  _r?: Rect
  _seedId?: string
  /** Where a decor item hangs (`floor`, `wall`...). */
  mount?: Mount
  /** Colour rule set by a plugin; replaced by `color` in the result. */
  colorSpec?: ItemColor
}

/** An item placed by the fill, a decor pass or a state plugin; plugins may add fields of their own. */
export interface PlacedItem extends PlacedItemFields {
  [extra: string]: Json
}

// ---- result of generate ----
/** A storey of the result. */
export interface ResultFloor {
  index: number
  label?: string
  name?: string
  number?: number
  y0: number
  ceiling: number
}

/** A room of the result, with its first part spread as `u0..v1` and the colour roles of its wall and floor. */
export interface ResultRoom {
  id: string
  type: string
  label?: string
  name?: string
  floor: number
  u0: number
  v0: number
  u1: number
  v1: number
  parts: Rect[]
  link: number[] | null
  ceiling: number
  color: { wall: string; floor: string }
}

/** A gate of the result lot. */
export interface ResultGate extends Omit<PlanGate, 'zones' | 'open'> {
  open: boolean
  color: string
}

/** The lot of the result (null for apartments). */
export interface ResultLot {
  rect: Rect
  setback: number
  backyard: number
  sideYard: { left: number; right: number }
  style: string
  pool: boolean
  zones: { id: string; type: string; label?: string; name?: string; parts: Rect[]; ground?: string }[]
  perimeter: (LotPerimeterPiece & { color: string })[]
  gates: ResultGate[]
  paths: LotPath[]
}

/** The facade of the result: the plan facade with the palette colour and the colour roles. */
export interface ResultFacade extends Omit<FacadeFields, 'color'> {
  color: { name?: string; key: string; hex: string }
  roles: Record<string, string>
  [extra: string]: unknown
}

/** An item of the result: the placed item without its internal fields, with its colour role or value. */
export interface ResultItem extends Omit<PlacedItemFields, '_r' | '_seedId' | 'colorSpec'> {
  [extra: string]: unknown
}

/** The known fields of a `generate` result. */
export interface FloorplanResultFields {
  template: string
  name: string
  use: string
  seed: number | string
  style: string
  state: string
  locale?: string
  w: number
  d: number
  floors: ResultFloor[]
  rooms: ResultRoom[]
  walls: PlanWall[]
  doors: PlanDoor[]
  windows: PlanWindow[]
  openPairs: [string, string][]
  facade: ResultFacade
  lot: ResultLot | null
  items: ResultItem[]
  stateItems: ResultItem[]
  colors: Palette
  /** Output of `TemplateDef.building`. */
  building: Json
  missing: { room: string; slot: string }[]
  /** Storey of an apartment unit. */
  floorNumber?: number
  partyWalls: string[]
  /** Output of `TemplateDef.config`. */
  config?: Json
  zoning?: ZoningReport
}

/** What `generate` returns. Result extensions add their output under their own name. */
export interface FloorplanResult extends FloorplanResultFields {
  [extension: string]: unknown
}

// ---- zoning ----
export interface ZoneDef {
  id: string
  /** Generic use strings: `residential_single`, `residential_multi`, `commercial`, `mixed`, `industrial`... */
  allowedUses: string[]
  maxFloors: number
  /** Metres. */
  maxHeight: number
  /** Minimum setbacks in metres. */
  setbacks: { front: number; side: number; back: number }
  /** Maximum building footprint / lot area (taxa de ocupacao). */
  maxCoverage: number
  /** Maximum total built area / lot area (coeficiente de aproveitamento). */
  maxFar: number
  /** Minimum lot area in m2. */
  minLot: number
  /** Minimum lot frontage in metres. */
  minFrontage: number
  /** Minimum permeable fraction of the lot (taxa de permeabilidade). */
  permeableMin: number
}
export interface ZoneViolation {
  rule: 'use' | 'floors' | 'height' | 'setback_front' | 'setback_side' | 'setback_back' | 'coverage' | 'far' | 'min_lot' | 'min_frontage' | 'permeable'
  actual: number | string
  limit: number | string
  message?: string
}
export interface ZoneAdjustment {
  field: string
  from: number | string
  to: number | string
  reason: string
}
export interface ZoningReport {
  zone: string
  adjustments: ZoneAdjustment[]
  violations: ZoneViolation[]
}

// ---- plugins ----
export interface StateContext {
  plan: Plan
  items: PlacedItem[]
  seed: number | string
  state: string
  rng: Rng
  /** Placement helpers shared with the decor passes. */
  ctx: PlacementContext
  kit: PlacementKit
  catalog: Record<string, FurnitureDef>
  wallTopHeights: Record<string, number>
}
export interface StatePlugin {
  /** Name of the legacy RNG stream (kept so old seeds still reproduce). */
  seedKey?: string
  /** Applies the state and returns the state items (not part of `items`). */
  apply(c: StateContext): PlacedItem[]
  /** Adjusts the palette roles (HSL) before the contrast rules run. */
  adjustPalette?(roles: Record<string, Hsl>): void
}

/** Walkability grid of a room (`createGrid`): cells of `gs` metres, the walkable ones and the entry cells. */
export interface WalkGrid {
  gs: number
  u0: number
  v0: number
  nx: number
  nz: number
  inside: Uint8Array
  entries: [number, number][]
  center: [number, number]
}

/** Options of `PlacementContext.placeOnFloor`. */
export interface PlaceOnFloorOptions {
  /** Treat the item as flat (no clearance or walkability check). */
  flat?: boolean
  /** Candidate rectangles to try instead of the corners and walls. */
  cands?: Rect[]
  /** Footprint to use instead of the catalogue size. */
  dim?: readonly number[]
  /** Try the candidates in order instead of shuffled. */
  ordered?: boolean
  /** Rejects a candidate. */
  without?: (rect: Rect) => boolean
  /** Walkability grid to check instead of the room's. */
  railing?: WalkGrid
}

export interface PlacementContext {
  make(room: Room, type: string, rect: Rect, front: Vec2, extra?: Partial<PlacedItem>): PlacedItem
  add(item: PlacedItem): PlacedItem
  placeOnFloor(room: Room, type: string, rng: Rng, opts?: PlaceOnFloorOptions): Rect | null
  itemsOfRoom(room: Room): PlacedItem[]
  solidsOfRoom(room: Room): Rect[]
  gridOf(room: Room): WalkGrid
  extraSolids: Record<string, Rect[]>
  roomById(id: string): Room | undefined
  setIgnored(ids: Set<string> | null): void
  added: PlacedItem[]
}

export interface PlacementKit {
  MARGIN: number
  EPS: number
  r2(x: number): number
  clamp(x: number, a: number, b: number): number
  overlaps(a: Rect, b: Rect, e?: number): boolean
  inner(p: Rect): Rect
  inflate(r: Rect, e: number): Rect
  areaOf(r: Rect): number
  topOf(m: PlacedItem): number
  extent(size: Vec2, f: Vec2): Vec2
  insideUnion(r: Rect, inners: Rect[]): boolean
  usableParts(room: Room, extra?: number): Rect[]
  zonesOfFloor(plan: Plan, floor: number): Rect[]
  windowsOfRoom(plan: Plan, room: Room): PlanWindow[]
  windowZone(j: Pick<PlanWindow, 'width' | 'side' | 'u' | 'v' | 'axis'>, outside?: boolean): Rect
  roomAt(plan: Plan, u: number, v: number, floor: number): Room | null
  reachable(grid: WalkGrid, solids: Rect[], inflation: number): boolean
  createGrid(plan: Plan, room: Room, ignored?: Set<string> | null): WalkGrid
  clearRect(r: Rect, f: Vec2, clearance: number): Rect
  pickWeighted(rng: Rng, w: Weights): string
  createRng(seed: number | string, key: string): Rng
  /** Name of the room in seeded streams: the legacy key when the room id was renamed, else the id. */
  roomSeedKey(room: Room): string
  shuffle<T>(a: T[], rng: Rng): T[]
  facingRotation(f: Vec2, type: string): number
  cutIntervals(intervals: [number, number][], a: number, b: number): [number, number][]
  blocksWindow(it: FurnitureDef, j: Pick<PlanWindow, 'y0'>, overheadOff?: boolean): boolean
}

export interface DecorPassContext {
  plan: Plan
  items: PlacedItem[]
  seed: number | string
  rng: Rng
  ctx: PlacementContext
  kit: PlacementKit
  catalog: Record<string, FurnitureDef>
  /** Decor profiles registered per style id. */
  profiles: Record<string, Json>
}
export type DecorPass = (c: DecorPassContext) => void

export interface GroundOverlayRule {
  /** Item category that triggers the overlay (e.g. `pool`). */
  category: string
  /** Ground type drawn around it. */
  ground: string
  /** Metres added around the trigger footprint. */
  inflate: number
  /** Skip when the zone already uses this ground type. */
  unlessGround?: string
  /** Merge all triggers of the zone into one rectangle. */
  merge?: boolean
}

export interface RoomColorDef {
  type: string
  /** Position in the colour stream, so legacy seeds keep their draws. */
  order: number
  /** Wall `[hue, lightness]` for a style context. */
  wall(c: PaletteContext): [number, number]
  /** Fixed floor base `[hue, saturation, lightness]`; falls back to the style's general floor. */
  floor?: [number, number, number]
  /** Neutral rooms are capped to low saturation. */
  neutral?: boolean
}

export interface Hsl {
  h: number
  s: number
  l: number
}
export interface FloorplanLocale {
  labels?: Record<string, string>
  templates?: Record<string, string>
  styles?: Record<string, string>
  facadeColors?: Record<string, string>
  zones?: Record<string, string>
  reasons?: Record<string, string>
  messages?: Record<string, string>
  ui?: Record<string, string>
}

// ---- 2D viewer layers ----
export interface ViewerLayerContext {
  /** Canvas 2D context, already in CSS pixels. */
  g: CanvasRenderingContext2D
  /** The `generate` result being drawn. */
  plan: FloorplanResult
  /** Storey being drawn (0 when `all`). */
  floor: number
  /** All storeys at once (the lot view). */
  all: boolean
  /** Metres to pixels. */
  scale: number
  X(u: number): number
  Z(v: number): number
  rect(r: Rect, fill?: string | null, stroke?: string | null, lineWidth?: number): void
  /** Tooltip area (metres) with its text. */
  hit(r: Rect, text: string): void
}
export interface ViewerLayerLegendEntry {
  label: string
  color: string
  shape: 'filled' | 'hollow' | 'dashed' | 'line'
}
/** A layer a pack adds to the 2D viewer (the structure pack draws pillars and beams); the viewer shows a checkbox for it. */
export interface ViewerLayer {
  id: string
  /** Checkbox text, or a key of the `ui` locale table. */
  label: string
  defaultOn?: boolean
  draw(context: ViewerLayerContext): void
  legend?(plan: FloorplanResult): ViewerLayerLegendEntry[]
}
