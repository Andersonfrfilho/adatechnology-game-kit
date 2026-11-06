/**
 * The kernel `K` is the closure the team's Casa3DSDK kept in one function: every installer of a module reads what the earlier ones
 * defined from it and adds what it defines (`Object.assign(K, ...)`). `Shared` holds the per-house state `enter(house)` swaps.
 *
 * The members are typed module by module (`KernelGeometry`, ...). Until every installer is typed, the index signature keeps the members
 * of the modules not yet typed reachable; it goes away with the last one (docs/migracao-typescript.md). The modules already typed are
 * checked with `strict` by `tsconfig.strict.json`.
 */
import type * as THREE_NS from 'three'
import type { Props3d } from '@adatechnology/game-props3d'

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
  /** The game's key for a seed (`cfg.seedKey`), or the seed itself. */
  seedKey(id: unknown): unknown
}

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
export interface Kernel extends KernelBase, KernelGeometry, KernelNoise, KernelCloseScene, KernelFurnitureApi, KernelFurnitureBuilders, KernelLightsFixtures, KernelFurniturePlants, KernelFurnitureTaps, KernelFurnitureYard, KernelFurniturePlaceItems, KernelFurnitureTypeTable, KernelFurnitureExtraTypes {
  [member: string]: any
}

export type Shared = Record<string, any>
export type Installer = (K: Kernel, shared: Shared) => any
