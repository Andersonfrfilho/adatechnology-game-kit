/**
 * The kernel `K` is the closure the team's Casa3DSDK kept in one function: every installer of a module reads what the earlier ones
 * defined from it and adds what it defines (`Object.assign(K, ...)`). `Shared` holds the per-house state `enter(house)` swaps.
 *
 * The members are typed module by module (`KernelGeometry`, ...). Until every installer is typed, the index signature keeps the members
 * of the modules not yet typed reachable; it goes away with the last one (docs/migracao-typescript.md). The modules already typed are
 * checked with `strict` by `tsconfig.strict.json`.
 */
import type * as THREE_NS from 'three'
import type { FloorplanResultFields, PlanDoor, PlanWall, PlanWindow, Rect, ResultGate, ResultLot, ResultRoom } from '@adatechnology/game-floorplan'
import type { Outbuilding, PlumbingPoint, PlumbingRun, Utilities } from '@adatechnology/game-floorplan-structure'
import type { DocumentLike, Props3d, Props3dOptions } from '@adatechnology/game-props3d'
import type * as Vegetation from '@adatechnology/game-vegetation'
import type * as VegetationThree from '@adatechnology/game-vegetation/three'
import type * as VegetationSpecies from '@adatechnology/game-vegetation-species'

import type { Translate } from './locale.js'
import type { HouseFleetDamageable, HouseRendererOptions } from './types.js'

export type { Rect }

export type Three = typeof THREE_NS
export type Vec3 = [number, number, number]
/** A colour as three.js takes it: `0xrrggbb`. */
export type Hex = number

/** Vertex arrays of a template geometry (`GEO.box`, `GEO.cyl`...). */
export interface GeoData {
  p: ArrayLike<number>
  n: ArrayLike<number>
  u: ArrayLike<number>
  i: ArrayLike<number> | null
  nv: number
}

/** Atlas cell of a face (`u0..v1`), its rotation in quarter turns, a mirror flag and a per-vertex colour multiplier. */
export interface UvRect {
  u0: number
  v0: number
  u1: number
  v1: number
  rot?: number
  fx?: boolean | number
  vc?: (x: number, z: number) => readonly number[]
}

/** A destruction piece being drawn: the meshes record where it starts so a hit finds it again. */
export interface PieceRecord {
  id: string
  mat: string
  role: string | null
  floor?: number
  [extra: string]: unknown
}

/** Where a piece starts inside an accumulator. */
export interface PieceLimit {
  pc: PieceRecord | null
  v: number
  i: number
}

/** Vertex and index buffers of one group and material (one mesh per pair). */
export interface Accumulator {
  cv: number
  ci: number
  p: Float32Array
  n: Float32Array
  c: Float32Array
  u: Float32Array
  i: Uint32Array
  nv: number
  ni: number
  lim: PieceLimit[]
  cur: PieceRecord | null
  piece0: PieceRecord | null
  mat: string
  group: string
  ensure(nv: number, ni: number): void
}

/** The drawing cursor: the group and piece being drawn, the accumulators, and the origin and rotation of the part in progress. */
export interface Cursor {
  group: string
  accs: Map<string, Accumulator>
  rot: unknown[]
  org: readonly number[]
  ry: number
  pc?: PieceRecord | null
  separate?: boolean
}

/** How a moving part opens: `swing`/`toggle` turn about `axis` by `angle`, `slide` moves `dist`, `scale` scales by `k`. */
export interface PartOpens {
  type: string
  axis?: readonly number[]
  angle?: number
  dist?: number
  k?: number
  [extra: string]: unknown
}

/** Metadata of a moving part (userData of its group). */
export interface PartMeta {
  id?: string
  opens?: PartOpens
  hidden?: boolean
  t0?: number
  [extra: string]: unknown
}

export interface PartRecord {
  name: string
  parent: string
  pos: number[]
  type: string
  meta: PartMeta
  ry: number
}

/** A real mirror to assemble at the end of the build (`furniture/fixtures` writes it, `mirrors.ts` assembles it). */
export interface MirrorRecord {
  x: number
  y: number
  z: number
  ry: number
  w: number
  h: number
  room: unknown
  floor?: number
  parent: string
}

/** Axis-aligned box by its corners: material, min corner, max corner, colour. */
export type BoxFn = (mat: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Hex) => void

/** What `kernel/geometry` puts on the kernel: the accumulators and the primitives every builder draws with. */
export interface KernelGeometry {
  GEO: Record<string, GeoData>
  UV_SCALE: Record<string, number>
  WITH_MAP: Record<string, number>
  Accumulator: new () => Accumulator
  cursor: Cursor
  PARTS: PartRecord[]
  /** Real mirrors to assemble at the end (`mirrors.ts` writes them). */
  MIRRORS: MirrorRecord[]
  part(type: string, pos: readonly number[], fn: () => void, meta?: PartMeta, parent?: string | null, ry?: number): string
  applyPart(g: THREE_NS.Object3D, t: number): void
  _Y: THREE_NS.Vector3
  _qa: THREE_NS.Quaternion
  _qb: THREE_NS.Quaternion
  pieceRecord(id: string, mat: string, role?: string | null, extra?: Record<string, unknown>): PieceRecord
  structurePiece(id: string): PieceRecord | null
  accFor(mat: string): Accumulator
  _q: THREE_NS.Quaternion
  _e: THREE_NS.Euler
  _col: THREE_NS.Color
  rgbOf(h: Hex): Vec3
  put(mat: string, geo: string, px: number, py: number, pz: number, q: THREE_NS.Quaternion, sx: number, sy: number, sz: number, color: Hex, uvr?: UvRect | null): void
  boxC(mat: string, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: Hex, rx?: number, ry?: number, rz?: number, uvr?: UvRect | null): void
  bx: BoxFn
  getBx(): BoxFn
  setBx(f: BoxFn): void
  cylBase(mat: string, x: number, y: number, z: number, r: number, h: number, color: Hex, seg?: string): void
  polyFace(mat: string, pts: readonly (readonly number[])[], color: Hex, hint?: readonly number[] | null): void
}

/** The frame an item is drawn in: where it stands (`x`, `z`, `ry`, `base` floor height, `y` mounting height) and its palette. */
export interface Frame {
  x: number
  z: number
  ry: number
  base: number
  y?: number
  floor?: number
  room?: unknown
  lampId?: string
  palette?: Record<string, Hex>
}

/**
 * A furniture item being drawn (the `M` every builder takes): its frame, its size, and what the house gave it (colour, seed, room).
 * Builders read other flags by name.
 */
export interface Mount extends Frame {
  w: number
  d: number
  h: number
  id?: string
  seed?: string | number
  color?: Hex
  on?: boolean
  ceiling?: number
  typeWith?: string
  /** Hose of a wall tap, as points from the tap (`furniture/yard`). */
  hose?: number[][]
  u?: number
  v?: number
  [extra: string]: unknown
}

/** A real light a builder asks for (`api.light`); the lighting turns it into a lamp. */
export interface LightRequest {
  x: number
  y: number
  z: number
  color: Hex
  range: number
  type: string
  floor?: number
  group: string
  base: number
  room?: unknown
  id?: string
  roomId?: unknown
  [extra: string]: unknown
}

/** What a builder draws with, in the item's frame (`makeApi()`); the lamps and curtains swap it for a recorder. */
export interface FurnitureApi {
  box(M: Frame, mat: string, x: number, y: number, z: number, w: number, h: number, d: number, color: Hex, ry?: number, rx?: number, rz?: number): void
  cylinder(M: Frame, mat: string, x: number, y: number, z: number, r: number, h: number, color: Hex, rx?: number, rz?: number, seg?: string): void
  leaf(M: Frame, x: number, y: number, z: number, w: number, h: number, color: Hex, ry?: number, rx?: number): void
  plane(M: Frame, mat: string, x: number, y: number, z: number, w: number, h: number, color: Hex, ry?: number, rx?: number, rz?: number, uv?: UvRect | null): void
  light(M: Frame, x: number, y: number, z: number, color: Hex, range: number, type: string, ex?: Record<string, unknown> | null): void
}

/** The `kk(M, A)` shortcuts: box and cylinder at the mounting height, the item's random stream and its wood and metal colours. */
export interface MountShortcuts {
  b(mat: string, x: number, y: number, z: number, w: number, h: number, d: number, color: Hex, ry?: number, rx?: number, rz?: number): void
  c(mat: string, x: number, y: number, z: number, r: number, h: number, color: Hex, rx?: number, rz?: number, seg?: string): void
  rnd: () => number
  wood: Hex
  met: Hex
}

/** What `furniture/api` puts on the kernel. */
export interface KernelFurnitureApi {
  MATERIAL_MAP: Record<string, string>
  mm(k: string): string
  LIGHTS: LightRequest[]
  makeApi(): FurnitureApi
  /** Colour `c` with each channel scaled by `f` (shade). */
  sh(c: Hex, f: number): Hex
  paletteColor(M: Frame, k: string, d: Hex): Hex
  rngOf(M: Frame): () => number
  kk(M: Frame, A: FurnitureApi): MountShortcuts
  PE: number
}

/** Variations a builder takes (`FURNITURE.cabinet(M, A, { doors: 2 })`). */
export interface BuilderOptions {
  color?: Hex
  top?: Hex
  useColor?: boolean
  ceiling?: number
  doors?: number
  glass?: boolean
  iron?: boolean
  open?: boolean
  crates?: boolean
  round?: boolean
  tablecloth?: boolean
  noChairs?: boolean
  oneSide?: boolean
  headboard?: boolean
  backrest?: boolean
  column?: boolean
  items?: boolean
  low?: boolean
  lowCrown?: boolean
  noBasin?: boolean
  noOverhead?: boolean
  register?: boolean
  shrub?: boolean
  stool?: boolean
  [flag: string]: unknown
}

/** Draws one furniture item with the api, in the item's frame. */
export type FurnitureBuilder = (M: Mount, A: FurnitureApi, o?: BuilderOptions) => void

/** What `furniture/builders` puts on the kernel (the other furniture modules add more builders to it). */
export interface KernelFurnitureBuilders {
  FURNITURE: Record<string, FurnitureBuilder>
}

/**
 * The drawing kit of an item (`kit2(M, A, y0)`): `W` turns the item's local point into the world, `b`/`c`/`e` draw a box, a cylinder
 * and a centred ellipsoid at the mounting height `y0`, `t` a tube between two points, and `part` a moving part in the item's frame.
 */
export interface Kit {
  W(lx: number, ly: number, lz: number): Vec3
  y0: number
  M: Mount
  readonly A: FurnitureApi
  b(mat: string, x: number, y: number, z: number, w: number, h: number, d: number, color: Hex, ry?: number, rx?: number, rz?: number): void
  c(mat: string, x: number, y: number, z: number, r: number, h: number, color: Hex, seg?: string): void
  e(mat: string, x: number, y: number, z: number, r: number, h: number, color: Hex): void
  /** Tube from `p` to `q`. Without a colour it draws black, as the team's track spots do (their emissive material gives the light). */
  t(mat: string, p: readonly number[], q: readonly number[], r: number, color?: Hex, seg?: string): void
  polyFace(mat: string, pts: readonly (readonly number[])[], color: Hex, hint?: readonly number[] | null): void
  part(type: string, lx: number, ly: number, lz: number, fn: () => void, meta?: PartMeta): string | null
}

/** What `lights/fixtures` puts on the kernel: the seeded randomness, the item kit, and the lamps and the switch. */
export interface KernelLightsFixtures {
  hashString(s: unknown): number
  rngString(s: string): () => number
  SEED(): number | string
  STYLE(): string
  kit2(M: Mount, A: FurnitureApi, y0?: number): Kit
  arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, n: number): [number, number][]
  TEMP_WARM: Hex[]
  TEMP_NEUTRAL: Hex[]
  TEMP_COOL: Hex[]
  colorTemperature(M: Mount): Hex
  lightStyle(M: Mount, requested?: string): string
  ceilingLamp(M: Mount, A: FurnitureApi, type: string): void
  tableLamp(M: Mount, A: FurnitureApi, y: number): void
  floorLamp: FurnitureBuilder
  sconce: FurnitureBuilder
  outdoorLamp: FurnitureBuilder
  lightSwitch: FurnitureBuilder
}

/** What `create()` itself puts on the kernel before the installers run. */
export interface KernelBase {
  t: Translate
  /** The game's key for a seed (`cfg.seedKey`), or the seed itself. */
  seedKey(id: unknown): unknown
  /** The three.js namespace, with the primitive geometries of `game-shapes-three`. */
  THREE: Three
  cfg: HouseRendererOptions
  /** Where the procedural canvases are drawn; null outside a page with no `options.document`. */
  DOC: DocumentLike | null
  /** `@adatechnology/game-props3d` or the game's replacement. */
  PROPS: { create(THREE: Three, options?: Props3dOptions): Props3d }
  /** `THREE.Reflector`; null: the mirrors use only the environment map. */
  Reflector: ReflectorClass | null
  FLEET: HouseRendererOptions['fleet']
  /** Hit points per damage class. */
  HP: Record<string, number>
  invalidate(): void
  invalidateShadow(): void
  colliderChanged(c: unknown): void
  VERSION: string
  isOpenArea(c: { type: string; outdoor?: boolean }): boolean
}

/** The `Reflector` of three's examples: a plane that mirrors the scene. */
export type ReflectorClass = new (geometry: THREE_NS.BufferGeometry, options: Record<string, unknown>) => THREE_NS.Mesh

/** Variations of a plant builder: flattened blobs, a share of flowers and their colours, coconuts, fruit colours, a low crown, a type. */
export interface PlantOptions {
  flatten?: boolean
  flower?: number
  flowers?: Hex[]
  coconut?: boolean
  fruit?: Hex[]
  lowCrown?: boolean
  type?: string
}

/** A plant drawn with an item kit. */
export type PlantBuilder = (M: Mount, A: FurnitureApi, o?: PlantOptions) => void

/** What `furniture/plants` puts on the kernel. */
export interface KernelFurniturePlants {
  GREENS: Hex[]
  FLOWERS: Hex[]
  blobs(K: Kit, cx: number, cy: number, cz: number, R: number, n: number, green: Hex, rnd: () => number, o?: PlantOptions): void
  /** Clay pot; returns the height of its top. */
  potModel(K: Kit, x: number, y: number, z: number, r: number, h: number, color: Hex, soil?: boolean): number
  /** Arched leaf; returns its tip. */
  arcLeaf(K: Kit, bx_: number, by: number, bz: number, az: number, len: number, elev: number, drop: number, wmax: number, color: Hex, serrated: boolean, nSeg?: number): number[]
  tuft(K: Kit, x: number, y: number, z: number, r: number, n: number, color: Hex, rnd: () => number): void
  palm_tree: PlantBuilder
  treeModel: PlantBuilder
  shrubModel: PlantBuilder
  potPlant: PlantBuilder
  tablePot: FurnitureBuilder
  planterModel: PlantBuilder
}

/** What `furniture/taps` puts on the kernel: the taps, each a lever part and a hidden water part; they return the tap's id. */
export interface KernelFurnitureTaps {
  counterTap(K: Kit, x: number, y: number, z: number, reach: number, back: number, meta?: PartMeta): string
  wallTap(K: Kit, x: number, y: number, zw: number, direction: number, back: number, meta?: PartMeta): string
}

/** What `furniture/yard` puts on the kernel (it also adds the laundry tub, clothesline, gas cylinder and mailbox builders). */
export interface KernelFurnitureYard {
  CLOTHES_COLORS: Hex[]
  /** Cloth strip: `rows` = `[y, xLeft, xRight]` from top to bottom, `rot` = rotation of the cloth about y. */
  strip(K: Kit, rows: readonly (readonly number[])[], zc: number, rot: number, color: Hex, cx: number): void
  garment(K: Kit, type: string, cx: number, ly: number, zc: number, rot: number, color: Hex, rnd: () => number): void
}

/**
 * An item of the house record (`r.items`, `r.stateItems`): the placed item of `game-floorplan` (its `ResultItem`), with the fields the
 * state plugins add (`polygon` of a ground cover, an open door, the hose of a gas cylinder).
 */
export interface HouseItem {
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
  color?: number | string
  overhead?: boolean
  polygon?: number[][]
  doorOpen?: boolean
  hose?: number[][]
  assembly?: unknown
  /** Storeys a stair connects, or the id of the item this one serves. */
  link?: { from: number; to: number } | string
  [extra: string]: unknown
}

/** The builder picked for a furniture type, and where it came from (`props3d`, `game`...). */
export interface TypeEntry {
  f: FurnitureBuilder
  source?: string
  [extra: string]: unknown
}

/** Furniture type -> its builder (`typeTable(props)`). */
export type TypeTable = Record<string, TypeEntry>

/** What `furniture/place-items` puts on the kernel. */
export interface KernelFurniturePlaceItems {
  /** Draws every item of the house; returns how many of each type had no builder. */
  houseItems(): Map<string, number>
  waterTankOfHouse(api: FurnitureApi): void
  hashColor(s: unknown): Hex
  /** No builder: a box on the item's footprint with a label. */
  labeledBox(m: HouseItem, M: Mount, group: string): void
}

/** What `furniture/type-table` puts on the kernel. */
export interface KernelFurnitureTypeTable {
  /** The builder of each furniture type: the props3d builders, the kit's own (`game`) and aliases. */
  typeTable(props: Props3d): TypeTable
}

/** What `furniture/extra-types` puts on the kernel. */
export interface KernelFurnitureExtraTypes {
  /** Adds the lamps, cars, plants and fixtures to the table. */
  extraTypes(T: TypeTable, props: Props3d): void
}

/** What has plan rectangles: its `parts`, or its own `u0..v1` when it has none (a room, a lot zone). */
export interface RoomRects {
  parts?: readonly Rect[] | null
  u0: number
  v0: number
  u1: number
  v1: number
}

/** A room of the house record; the open areas of a plugin may be marked `outdoor`, and the rooms of an outbuilding name it. */
export type HouseRoom = ResultRoom & { outdoor?: boolean; outbuilding?: unknown; [extra: string]: unknown }

/** A wall of the house record, with the structure fields the structure extension adds (`id`, `material`, `role`). */
export interface HouseWall extends PlanWall {
  id?: string
  material?: string
  role?: string
  outbuilding?: string
}

/** The house record the renderer draws: the `generate` result of `game-floorplan`, with the fields the plugins add to its rooms, walls and items. */
export interface HouseRecord extends Omit<FloorplanResultFields, 'rooms' | 'walls' | 'doors' | 'windows' | 'items' | 'stateItems'> {
  rooms: HouseRoom[]
  walls: HouseWall[]
  doors: HouseDoor[]
  windows: HouseWindow[]
  items: HouseItem[]
  stateItems: HouseItem[]
  /** Utilities of `game-floorplan-structure` (empty until its extension ran). */
  utilities?: Partial<Utilities>
  /** Walk-in yard buildings of `game-floorplan-structure`. */
  outbuildings?: Outbuilding[]
  [extension: string]: unknown
}

/** A door of the house record; an outbuilding's door names it, and has no stair steps or type of its own. */
export interface HouseDoor extends Omit<PlanDoor, 'type' | 'steps'> {
  type?: string
  steps?: number
  outbuilding?: string
}

/** A window of the house record; an outbuilding's window names it. */
export interface HouseWindow extends PlanWindow {
  outbuilding?: string
}

/** Colour and material of one face of a wall, and whether it faces outside. */
export interface WallSide {
  color: Hex
  mat: string
  exterior: boolean
}

/** What `house/helpers` puts on the kernel: the house's storeys, rooms and their rectangles and colours. */
export interface KernelHouseHelpers {
  OPEN_ROOM_TYPES: Set<string>
  NO_CEILING: Set<string>
  /** An open area has no roof or ceiling. */
  OPEN_AREA(c: { type: string; outdoor?: boolean }): boolean
  EPS: number
  /** Floor height of storey `f` (clamped to the storeys there are). */
  Y0(f: number): number
  /** A colour by value (`0xrrggbb`) or by palette role; null when the role has no colour. */
  colorOf(v: unknown): Hex | null
  rectsOf(c: RoomRects): readonly Rect[]
  roomAt(f: number, u: number, v: number): HouseRoom | null
  /** Rectangle `a` minus `b`. */
  subRect(a: Rect, b: Rect): Rect[]
  subRects(rs: readonly Rect[], holes: readonly Rect[]): readonly Rect[]
  wallColor(c: HouseRoom | null | undefined): Hex
  floorColor(c: HouseRoom | null | undefined): Hex
  /** Plan rectangle of a stair (front = local +z). */
  stairFootprint(m: { x: number; z: number; ry: number; w: number; d: number }): Rect
  /** A wall a little taller than the storey pitch stops at the next floor. */
  effectiveHeight(f: number, h: number): number
}

/** A flight of stairs between two storeys, once (the house record repeats the stair item on both): its plan box, the landing under its first steps when
 * another flight stands below it, and the flat top of a flight with none above (`LP` long). */
export interface Flight {
  m: HouseItem
  from: number
  to: number
  rect: Rect
  landing?: Rect
  top?: Rect
  LP?: number
}

/** A piece of a slab tile and the rectangle it covers (`null`: not part of the structure). */
export type Tile = [PieceRecord | null, Rect]

/** What `house/floors` puts on the kernel. */
export interface KernelHouseFloors {
  flights(): Flight[]
  floorsAndSlabs(): void
  /** A slab tile cut at the borders of its panels, each part tagged with its own panel. */
  tilesOf(parent: string | null | undefined, rc: Rect): Tile[]
  panelAt(parent: string, x: number, z: number): PieceRecord | null
}

/** A stair drawn in the house (`ctx.stairs`): its item, storeys, foot height, rise and plan box, and where its landing starts (share of its depth). */
export interface StairRecord {
  m: HouseItem
  f: number
  to: number
  y0: number
  H: number
  rect: Rect
  landingPoint: number
}

/** What `house/stairs` puts on the kernel. */
export interface KernelHouseStairs {
  buildStairs(): void
  elevator(): void
}

/** What `house/baseboard` puts on the kernel. */
export interface KernelHouseBaseboard {
  /** External baseboard and protective sidewalk around the ground floor, closing the outer corners. */
  baseboardAndSidewalk(): void
}

/** A unit of an apartment building: its corner and whether it is turned. */
export interface BuildingUnit {
  u: number
  v: number
  ry: number
}

/** The apartment building of a record (`r.building`, from the apartment template's `building`). */
export interface ApartmentBuilding {
  ceilingHeight: number
  unit: { w: number; d: number }
  units: BuildingUnit[]
  corridor: Rect
  hall: Rect
  elevator: { rect: Rect }
  stairs: { rect: Rect }
}

/** What `house/building` puts on the kernel. */
export interface KernelHouseBuilding {
  /** The apartment building around the unit: stacked storeys, hall, stair and elevator; the chosen unit highlighted. */
  building(): void
}

/** What `house/outbuildings` puts on the kernel. */
export interface KernelHouseOutbuildings {
  /** Use -> [room type, colour role, name]. */
  OUTBUILDING_USE: Record<string, [string, string, string]>
  /** The record with the outbuildings' rooms, walls, doors, windows and items in its own lists (and every wall named). */
  applyOutbuildings(r: HouseRecord): HouseRecord
  outbuildings(): void
}

/** What `house/windows` puts on the kernel. */
export interface KernelHouseWindows {
  FRAME_COLORS: Record<string, Hex>
  SILL_COLORS: Record<string, Hex>
  windows(): void
}

/** A box collider of the house (`ctx.colliders`): a wall, door, board, lot wall or gate on storey `f` (`-1`: the lot); `off` while a door is open. */
export interface BoxCollider {
  type: string
  f: number
  x0: number
  z0: number
  x1: number
  z1: number
  piece?: string
  off?: boolean
  [extra: string]: unknown
}

/** Material, colour and top of the outer face of a wall (the pillars in it take them). */
export interface WallLook {
  mat: string
  color: Hex
  top: number
}

/** What `house/walls` puts on the kernel. */
export interface KernelHouseWalls {
  /** Both halves of a wall stretch, each in its side's colour and material. */
  wallBox(alongU: boolean, L: number, a: number, b: number, ya: number, yb: number, th: number, cL: Hex, cH: Hex, mL: string, mH: string): void
  sideOf(id: string, frontLine: boolean): WallSide
  pieceOf(w: HouseWall): PieceRecord | null
  /** The wall segment of the line closest to `c` (door lintels belong to it). */
  nearestWall(f: number, axis: string, L: number, c: number): HouseWall | null
  walls(): void
  wallPillars(looks: ReadonlyMap<string, WallLook>): void
}

/** A door leaf group: its name and where its hinge stands. */
export interface LeafGroup {
  name: string
  pos: number[]
}

/** A door of the house as it moves (`ctx.leaves`): its state, its leaf groups and handles, and its collider. */
export interface DoorLeaf {
  id: string
  floor: number
  type: string
  open: boolean
  t: number
  blockedFlag: boolean
  locked: boolean
  handleNames: string[]
  hT: number
  cx: number
  cz: number
  visH: number
  groups: LeafGroup[]
  col: BoxCollider | null
  minScale?: number
  rot?: number
  [extra: string]: unknown
}

/** What `house/doors` puts on the kernel. */
export interface KernelHouseDoors {
  /** The two faces in a door gap, from the wall beside it. */
  doorLineSides(p: HouseDoor): [WallSide, WallSide]
  doors(): void
}

/** A roof rectangle of the house (`ctx.roofRects`): where it is and, once drawn, the geometry the solar panels rest on. */
export interface RoofRect {
  f: number
  r: Rect
  touchesU?: number[]
  slab?: boolean
  outbuilding?: string
  yb?: number
  tp?: number
  gable?: boolean
  alongX?: boolean
  exterior?: Rect
  rm?: number
}

/** What `roof/tiles` puts on the kernel. */
export interface KernelRoofTiles {
  R_STYLE(): string
  /** Tile relief on a roof plane (colonial rows or fibre cement waves). */
  tileRelief(mat: string, pts: readonly (readonly number[])[], color: Hex, type: string): void
  /** Ridge or hip cap along a line. */
  ridge(a: readonly number[], b: readonly number[], type: string, roofColor: Hex): void
  /** The structure piece of the roof plane under the point (or the nearest). */
  pieceOfPane(x: number, z: number): PieceRecord | null
}

/** What `roof/rect` puts on the kernel. */
export interface KernelRoofRect {
  /** A gable or hipped cover over a rectangle, with its eave band, soffit and fascia; `touchesU` = sides (x0, z0, x1, z1) against an upper storey. */
  roofRect(type: string, X0: number, Z0: number, X1: number, Z1: number, yb: number, roofColor: Hex, gable: boolean, F: unknown, touchesU?: number[]): void
}

/** Gutter settings of a house (`ctx.gutter`), drawn from its seed. */
export interface GutterConfig {
  on: boolean
  rnd: () => number
  color: Hex
  bad: boolean
  fallback: boolean
  ncond?: number
  nbuz?: number
  bz?: Set<string>
}

/** Cell grid of a storey's roof: `O(j, i)` = covered, `U(j, i)` = the upper storey stands there, `full` = a whole block covered, `pe` = height of a block's eave. */
export interface RoofGrid {
  O(j: number, i: number): boolean
  U(j: number, i: number): boolean
  full(i0: number, i1: number, j0: number, j1: number): boolean
  pe(x0: number, z0: number, x1: number, z1: number): number
}

/** What `roof/gutters` puts on the kernel. */
export interface KernelRoofGutters {
  gutterConfig(): GutterConfig
  gutter(type: string, f: number, X0: number, Z0: number, X1: number, Z1: number, yb: number, touchesU: readonly number[]): void
  /** Floor drain with a grate; with `px`, `pz`, the pipe from the downpipe's foot. */
  drain(x: number, z: number, px?: number | null, pz?: number | null, c?: Hex): void
}

/** What `roof/slabs` puts on the kernel. */
export interface KernelRoofSlabs {
  /** Flat roof: a plate per cell, the parapet only on the outer perimeter. */
  slabs(f: number, xs: readonly number[], zs: readonly number[], O: RoofGrid['O'], U: RoofGrid['U'], nx: number, nz: number, full: RoofGrid['full'], pe: RoofGrid['pe'], C: Record<string, Hex>): void
}

/** What `roof/roofs` puts on the kernel. */
export interface KernelRoofRoofs {
  roofs(): void
}

/** What `lot/terrain` puts on the kernel. */
export interface KernelLotTerrain {
  terrain(): void
  /** Stretches `[x0, x1]` of a lot wall line that do not go through a room of the house. */
  freeSpans(alongU: boolean, L: number, a: number, b: number): [number, number][]
}

/** What `lot/perimeter` puts on the kernel. */
export interface KernelLotPerimeter {
  perimeter(): void
  paths(): void
}

/** What `lot/gates` puts on the kernel. */
export interface KernelLotGates {
  /** Which way a sliding gate opens: +1 to the right when it fits in the lot, otherwise -1. */
  slideDirection(g: ResultGate, lt: ResultLot): number
  gates(): void
}

/** What `lights/decor` puts on the kernel. */
export interface KernelLightsDecor {
  /** Extra lamps by class and seed: table lamp, floor lamp beside the sofa, sconces beside the mirror, outdoor lamp at the entrance. */
  decorLights(api: FurnitureApi): void
}

/** The item a builder draws for (its id and room). */
export interface ItemRef {
  id: string
  room: string | null
  [extra: string]: unknown
}

/** Water in a house's tank: kept in the house's state so it survives a rebuild (night, cut). */
export interface WaterState {
  cap: number
  level: number
  rate: number
}

/** The water network of a house (`house.water`): the tank level and the points that draw from it. */
export interface WaterApi {
  capacity: number
  points: Record<string, PlumbingPoint>
  itemPoint: Record<string, string>
  runs: PlumbingRun[]
  level(): number
  fraction(): number
  /** Draws litres from a point; returns the litres delivered. */
  consume(pointId: string, liters: number): number
  fill(liters: number): number
  /** Litres per second; 0 stops it. */
  leak(rate: number): number
  readonly leakage: number
  readonly dry: boolean
  on(ev: 'dry' | 'full', fn: (api: WaterApi) => void): () => void
  off(ev: 'dry' | 'full', fn: (api: WaterApi) => void): void
  step(dt: number): void
}

/** What `utilities/water` puts on the kernel. */
export interface KernelUtilitiesWater {
  createWater(r: HouseRecord, state: { water?: WaterState }): WaterApi
  PIPE_COLOR: Hex
  /** Cylinder between two points. */
  pipe(a: readonly number[], b: readonly number[], diameter: number, color: Hex): void
  _v3: THREE_NS.Vector3
  waterPipes(): void
}

/** The solar panels and inverter as the game sees them (`house.solar`). */
export interface SolarInfo {
  type: string
  panels: { id: string; pos: Vec3; tilt: number; w: number; length: number }[]
  inverter: { id: string; pos: Vec3; side: string; link: string } | null
}

/** What `utilities/solar` puts on the kernel. */
export interface KernelUtilitiesSolar {
  /** Height of the roof surface at (u, v), on storey `f` or any; null where no roof covers. */
  roofHeightAt(u: number, v: number, f?: number): number | null
  solar(): void
}

/** The electrical structure as the game sees it (`house.electrical`). */
export interface ElectricalInfo {
  pole: { pos: Vec3; h: number } | null
  meter: { id: string; pos: Vec3; place: string } | null
  panel: { id: string; pos: Vec3; normal: Vec3; room: string; breakers: number } | null
  conduits: string[]
  outlets: { id: string; pos: Vec3; normal: Vec3; room: string; floor: number; type: string; voltage: number }[]
  switches: { id: string; pos: Vec3; normal: Vec3; room: string; floor: number; controls: string[] }[]
  circuits: unknown[]
  exposed: boolean
}

/** What `utilities/electrical` puts on the kernel. */
export interface KernelUtilitiesElectrical {
  electricalStructure(): void
  pipe2(a: readonly number[], b: readonly number[], diameter: number, color: Hex): void
}

/** The procedural textures (`materials/textures`): what `cfg.textures` can replace. */
export type TextureName = 'roughcast' | 'block' | 'tile' | 'dirt' | 'grass' | 'asphalt' | 'sidewalk' | 'fiber_cement'
/** The atlas textures (`cfg.atlas` can give them ready). */
export type AtlasTextureName = 'picture' | 'floorKind' | 'water'

/** What `materials/textures` puts on the kernel. */
export interface KernelMaterialsTextures {
  texture(n: number, f: (g: CanvasRenderingContext2D, n: number) => void, rep?: boolean, rx?: number, ry?: number): THREE_NS.CanvasTexture
  /** Seeded random of the procedural textures (one sequence for all of them, in their order). */
  rngTexture(): number
  TEXGEN: Record<TextureName, () => THREE_NS.CanvasTexture>
  TEX: Record<TextureName, THREE_NS.Texture>
  ATLAS: Partial<Record<AtlasTextureName, THREE_NS.Texture>>
}

/** The house's materials by name (`plain`, `glass`, `dirt`...). */
export type MaterialTable = Record<string, THREE_NS.Material>

/** What `materials/materials` puts on the kernel. */
export interface KernelMaterialsMaterials {
  createMaterials(props: Props3d): MaterialTable
  antiTile(mat: THREE_NS.Material, scale2: number, fn: number): void
  dirtMaterial(mat: THREE_NS.Material): void
  /** Time and wind of the clothes on the line (`animation/clotheslines` updates them). */
  CLOTHES_UNIFORMS: { uTime: { value: number }; uVento: { value: number } }
  clothesMaterial(): THREE_NS.MeshLambertMaterial
  /** Render order per material (transparent ones last). */
  ORDER: Record<string, number>
  /** Materials whose meshes cast no shadow. */
  NO_SHADOW: Set<string>
}

/** What `animation/clotheslines` puts on the kernel. */
export interface KernelAnimationClotheslines {
  WIND: { t0: number; last: number; base: number }
  animateClotheslines(now: number): void
}

/** A mirror assembled with a real reflection: the group, its environment-map plane and the reflector (null when it failed). */
export interface MirrorEntry {
  E: MirrorRecord
  g: THREE_NS.Group
  fake: THREE_NS.Mesh
  real: THREE_NS.Mesh | null
}

/** Mirrors of a house: the assembled ones, the one reflecting now, a scratch vector and the house group. */
export interface MirrorState {
  list: MirrorEntry[]
  active: MirrorEntry | null
  tmp: THREE_NS.Vector3
  house: THREE_NS.Object3D | null
}

/** What `mirrors` puts on the kernel. */
export interface KernelMirrors {
  mirrorEnv(): THREE_NS.CubeTexture
  newMirrorState(): MirrorState
  assembleMirrors(groups: Record<string, THREE_NS.Group>): void
  /** Floor index of a height in the house. */
  floorAtY(y: number): number
  chooseMirror(camera: THREE_NS.Camera): void
}

/** A car to place at the end of the build (`furniture/extra-types` writes it): where, its slot, the fleet kind, the paint seed and the group. */
export interface CarSlot {
  x: number
  y: number
  z: number
  ry: number
  w: number
  d: number
  k: string
  seed: number
  parent: string
}

/** A car model merged by material, built once per kind, quality and seed. */
export interface CarModel {
  damageables: HouseFleetDamageable[]
  /** Where the fleet group's centre (x, z) and floor (y) were. */
  off: Vec3
  parts: { geo: THREE_NS.BufferGeometry; mat: THREE_NS.Material }[]
  W: number
  L: number
  H: number
  tris: number
}

/** A shine class of the plain opaque car materials: one vertex-coloured material per class. */
export interface CarBucket {
  sig: string
  mat: THREE_NS.MeshStandardMaterial
}

/** What `cars` puts on the kernel. */
export interface KernelCars {
  CARS: CarSlot[]
  CAR_BY_STYLE: Record<string, string[]>
  CAR_CACHE: Map<string, CarModel | null>
  materialSignature(m: THREE_NS.Material): string
  BUCKETS: Map<string, CarBucket>
  bucketMaterial(m: THREE_NS.Material): CarBucket | null
  carModel(k: string, seed?: number): CarModel | null
  carGroup(k: string, w: number, d: number, seed?: number): THREE_NS.Group | null
  assembleCars(groups: Record<string, THREE_NS.Group>): void
  assembleMergedCars(groups: Record<string, THREE_NS.Group>): void
}

/** The vegetation packages the game injected (`cfg.vegetation`): what the house uses of them. */
export interface VegetationLibs {
  G: Pick<typeof Vegetation, 'scatter' | 'buildLot'> & Pick<typeof VegetationThree, 'createLotObject' | 'createVegetationMaterials'>
  S: Pick<typeof VegetationSpecies, 'toSpec'>
}

/** The plants of one group and height, collected by `vegItem` and merged by `assembleVegetation`. */
export interface VegetationGroup {
  group: string
  y: number
  pl: Vegetation.Placement[]
}

/** The vegetation of the house being built (`shared.ctx.veg`). */
export interface VegetationContext extends VegetationLibs {
  mats(): VegetationThree.VegetationMaterials
  groups: Map<string, VegetationGroup>
  /** Species the package knows (cached `toSpec` checks). */
  ok: Map<string, boolean>
  opts: Omit<Vegetation.BuildLotOptions, 'seed'>
}

/** What `vegetation/bridge` puts on the kernel. */
export interface KernelVegetationBridge {
  VEG_POT: string[]
  VEG_CACTUS: Record<string, string>
  /** Plan item type -> species ids. */
  VEG_MAP: Record<string, string[]>
  /** Planter type -> species scattered in it. */
  VEG_PLANTER: Record<string, string[]>
  /** True when the vegetation took the item; false lets the house's own builder draw it. */
  vegItem(m: HouseItem, M: Mount, group: string): boolean
  assembleVegetation(groups: Record<string, THREE_NS.Group>): void
}

/** What `kernel/noise` puts on the kernel. */
export interface KernelNoise {
  _h2(x: number, z: number): number
  vnoise(x: number, z: number): number
  /** Per-vertex RGB multiplier of a ground (`dirt` or other). */
  macroGround(x: number, z: number, type: string): Vec3
}

/** What `kernel/close-scene` puts on the kernel. */
export interface KernelCloseScene {
  markMesh(m: THREE_NS.Mesh, A: Accumulator): void
  closeScene(mats: Record<string, THREE_NS.Material>): Record<string, THREE_NS.Group>
}

/** The modules typed so far, and the members of the others by name until they are typed. */
export interface Kernel extends KernelBase, KernelGeometry, KernelNoise, KernelCloseScene, KernelFurnitureApi, KernelFurnitureBuilders, KernelLightsFixtures, KernelFurniturePlants, KernelFurnitureTaps, KernelFurnitureYard, KernelFurniturePlaceItems, KernelFurnitureTypeTable, KernelFurnitureExtraTypes, KernelHouseHelpers, KernelHouseFloors, KernelHouseStairs, KernelHouseBaseboard, KernelHouseBuilding, KernelHouseOutbuildings, KernelHouseWindows, KernelHouseWalls, KernelHouseDoors, KernelRoofTiles, KernelRoofRect, KernelRoofGutters, KernelRoofSlabs, KernelRoofRoofs, KernelLotTerrain, KernelLotPerimeter, KernelLotGates, KernelLightsDecor, KernelUtilitiesWater, KernelUtilitiesSolar, KernelUtilitiesElectrical, KernelMaterialsTextures, KernelMaterialsMaterials, KernelAnimationClotheslines, KernelMirrors, KernelCars, KernelVegetationBridge {
  [member: string]: any
}

export type Shared = Record<string, any>
export type Installer = (K: Kernel, shared: Shared) => any
