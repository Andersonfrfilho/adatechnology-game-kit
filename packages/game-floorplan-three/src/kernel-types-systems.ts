/** The kernel's types of the house's systems and state: materials, mirrors, cars, vegetation, interaction, room lights, the interactables kit and the build. */
import type { Aabb } from './house/solids.js';
import type * as THREE_NS from 'three'
import type { ResultGate } from '@adatechnology/game-floorplan'
import type { Outbuilding, StructurePart } from '@adatechnology/game-floorplan-structure'
import type { PanelView } from './destruction/panels.js'
import type { Kernel } from './kernel-types.js'
import type { Props3d } from '@adatechnology/game-props3d'
import type * as Vegetation from '@adatechnology/game-vegetation'
import type * as VegetationThree from '@adatechnology/game-vegetation/three'
import type * as Interactables from '@adatechnology/game-interactables'
import type { InteractablesEffects, InteractablesGfx, InteractablesScreen, SpeciesLibrary } from './adapter-shapes.js'
import type { AdapterPlan, AddResult, BlockedFn, FloorplanAdapter, HouseholdKit, PlanEntry, WaterNetwork } from '@adatechnology/game-floorplan-interactables'
import type { LightBudget, LightHandle } from '@adatechnology/game-render-three'
import type { BuildOptions, Damageable, House, HouseFleetDamageable, HousePart, HouseRenderer, HouseInteractable, LightingOptions } from './types.js'
import type { BreachView, BreachViewOptions, DestructionCollider, HouseDestruction, HouseStructure } from './destruction/types.js'
import type { DeferredQueue } from '@adatechnology/game-contracts'
import type { BoxCollider, DoorLeaf, ElectricalInfo, Flight, FurnitureApi, GutterConfig, Hex, HouseDoor, HouseItem, HouseRecord, HouseRoom, ItemRef, LightRequest, MirrorRecord, Mount, PieceRecord, RoofRect, SolarInfo, StairRecord, Three, TypeEntry, TypeTable, Vec3, WaterApi, WaterState } from './kernel-types.js'

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
  S: SpeciesLibrary
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

/**
 * A moving piece of the house (`definePiece`): a cabinet door, a drawer, a curtain, a gate, a light switch, a door handle, a lamp, or a part
 * of the `part:` contract. `t` is where it is (0 closed, 1 open), `target` where it goes; `outer` stands at the hinge and `inner` moves.
 */
export interface InteractivePiece {
  name: string
  kind: string
  pivot: number[]
  ry: number
  parent?: string
  meshes: THREE_NS.Mesh[]
  t: number
  target: number
  t0?: number
  outer?: THREE_NS.Group
  inner?: THREE_NS.Object3D
  /** A handle: the door leaf and which of its groups holds it. */
  leaf?: DoorLeaf
  k?: number
  /** A lamp: the room it lights. */
  roomId?: string | null
  col?: BoxCollider
  gate?: ResultGate
  sgn?: number
  angle?: number
  travel?: number
  axis?: 'x' | 'y' | 'z'
  /** The item that opens it. */
  item?: InteractiveItem
  damageable?: Damageable
}

/** What `definePiece` takes: the piece without its name, meshes and position, which it fills. */
export type PieceDefinition = Omit<InteractivePiece, 'name' | 'meshes' | 't' | 'target'>

/** Something the player can use (`E`): where they aim at, how far and at what angle it reaches, the pieces it moves, its prompt and action. */
export interface InteractiveItem {
  type: string
  id: string
  floor: number
  anchor: number[]
  range: number
  angle: number
  pieces: InteractivePiece[]
  text(): string
  action(): void
  /** True: reached through walls (gates, mailbox). */
  noWall?: boolean
  /** Its public view (`house.interactables`). */
  pub?: HouseInteractable
}

/** A piece of furniture that blocks walking: rotated rectangle on a floor (`-1`: the lot). */
export interface CollisionObject {
  f: number
  cx: number
  cz: number
  c: number
  s: number
  hw: number
  hd: number
  type: string
}

/** The interaction state of a house (`shared.inter`). */
export interface InteractiveState {
  defs: Map<string, InteractivePiece>
  items: InteractiveItem[]
  pieces: InteractivePiece[]
  /** Lamp pieces per room. */
  lights: Map<string, InteractivePiece[]>
  litRooms: Set<string>
  objs: CollisionObject[]
  anim: Set<InteractivePiece>
  msg: { text: string; until: number } | null
  target: unknown
}

/** The eye of whoever interacts, in house coordinates. */
export interface Eye {
  x: number
  y: number
  z: number
  yaw: number
  pitch?: number
  floor: number
}

/** The best target of an eye: its score (lower is better), prompt, action and what it is. */
export interface InteractionTarget {
  score: number
  text: string
  action: () => unknown
  target: TargetRef
}

/** What a target is: a door leaf, an item of the house or an object of the interactables kit (`kit`, with its public view in `pub`). */
export interface TargetRef {
  id?: string
  type?: string
  kit?: unknown
  pub?: unknown
}

/** What `interaction/state` puts on the kernel. */
export interface KernelInteractionState {
  newInteractiveState(): InteractiveState
  MESSAGE_MS: number
  createInteractiveMaterials(mats: MaterialTable): void
  _EY: THREE_NS.Vector3
  _UM3: THREE_NS.Vector3
  hudMessage(text: string): void
  definePiece(name: string, def: PieceDefinition): InteractivePiece
  /** Item frame (`x`, `z`, `ry`) to plan coordinates. */
  localOf(M: { x: number; z: number; ry: number }, lx: number, lz: number): [number, number]
  visibleChain(o: THREE_NS.Object3D): boolean
  assembleInteractive(gs: Record<string, THREE_NS.Group>): void
  applyPiece(p: InteractivePiece): void
  DURATION: Record<string, number>
  animateInteractive(dt: number): void
  togglePiece(p: InteractivePiece): void
  lightBase(roomId: string | null | undefined): boolean
  lightOn(roomId: string | null | undefined): boolean
  applyLight(roomId: string): void
  toggleLight(roomId: string): void
}

/** What `interaction/collision` puts on the kernel. */
export interface KernelInteractionCollision {
  NO_COLLIDE: RegExp
  registerCollision(m: HouseItem, M: Mount): void
  objectDistance(o: CollisionObject, x: number, z: number): number
  collideObject(x: number, z: number, fx: number, fz: number, floor: number): boolean
  collideAt(x: number, z: number, floor: number, opt?: { radius?: number; from?: readonly number[] }): boolean
}

/** What `interaction/doors` puts on the kernel. */
export interface KernelInteractionDoors {
  linkDoorLeaves(): void
  handleApply(fo: DoorLeaf): void
  toggleDoor(fo: DoorLeaf): void
  animateDoors(dt: number): void
  /** Does the segment from the eye to the target cut a wall? */
  wallBlocks(ex: number, ez: number, ax: number, az: number, floor: number): boolean
  doorText(fo: DoorLeaf): string
  applyLeaf(fo: DoorLeaf): void
}

/** What `interaction/target` puts on the kernel. */
export interface KernelInteractionTarget {
  targetOf(o: Eye | null | undefined, opt?: { strike?: (meshes: THREE_NS.Mesh[]) => THREE_NS.Intersection | null | undefined; interactives?: KitTargetOptions }): InteractionTarget | null
}

/** A drawing call of a builder, recorded to split an item into its moving pieces: the primitive and its arguments after the frame. */
export type RecordedCall = [kind: 'box' | 'cylinder' | 'leaf' | 'plane', args: unknown[]]

/** What `interaction/items` puts on the kernel. */
export interface KernelInteractionItems {
  DOOR_ITEM: RegExp
  DRAWER_ITEM: RegExp
  LIGHT_TYPES: Set<string>
  objectName(type: string, drawer?: boolean): string
  /** A kit that records the drawing calls instead of drawing them (lights still go through). */
  recordApi(api: FurnitureApi): { pr: FurnitureApi; calls: RecordedCall[] }
  buildItem(m: HouseItem, M: Mount, ent: TypeEntry, api: FurnitureApi, parent: string): void
  lightItem(m: ItemRef, M: Mount, ent: TypeEntry, api: FurnitureApi, parent: string): void
  curtainItem(m: HouseItem, M: Mount, ent: TypeEntry, api: FurnitureApi, parent: string): void
  furnitureItem(m: HouseItem, M: Mount, ent: TypeEntry, api: FurnitureApi, parent: string, drawer: boolean): void
}

/** What `interaction/fittings` puts on the kernel. */
export interface KernelInteractionFittings {
  gatesInteractive(): void
  mailboxInteractive(): void
  placeSwitches(): void
  /** Puts a room's light switch beside a door of it; false when no wall there takes one. */
  putSwitch(c: HouseRoom, p: HouseDoor): boolean
}

/** A built house as the room lighting reads it (`House` is one). */
export interface LitHouse {
  group?: THREE_NS.Object3D | null
  house: THREE_NS.Object3D
  lights: { list: LightRequest[] }
  r: HouseRecord
  y0(f: number): number
  lightOn(room: unknown): boolean
  internal?: { doorState?: Map<string, boolean> }
}

/** A rectangle of a light box in world x/z: `[x0, z0, x1, z1]`. */
export type BoxRect = [number, number, number, number]

/** What a room light lit in the last update: the room (or outdoor lamp) key, its boxes, its y band, the exclusion box and its distance. */
export interface LightCrate {
  k: unknown
  rects: BoxRect[]
  y: [number, number]
  exterior: boolean
  exclusion: BoxRect | null
  d: number
}

/** The room lights of `lighting()`: one light per slot, given every frame to the rooms closest to the focus. */
export interface RoomLighting {
  lights: readonly (LightHandle | THREE_NS.PointLight)[]
  crates: (LightCrate | null)[]
  n: number
  shadows: number
  stats: { rooms: number; external: number; shadows: number; shadowChanged: boolean }
  /** Strength of the fake indirect light inside each box. */
  indirect(v: number): void
  invalidate(): void
  update(houses: LitHouse | readonly (LitHouse | null | undefined)[] | null | undefined, focus: { x: number; y: number; z: number }, op?: { floorMax?: number; focusHouse?: LitHouse; focusRoom?: unknown }): RoomLighting['stats']
  dispose(): void
}

/** The masks of the effect lights of a budget (`effectLights`). */
export interface EffectLighting {
  update(houses: LitHouse | readonly (LitHouse | null | undefined)[] | null | undefined): void
}

/** The uniforms of the room masks, shared by every lit material. */
export interface RoomMaskUniforms {
  uRB0: { value: Float32Array }
  uRB1: { value: Float32Array }
  uRB2: { value: Float32Array }
  uRBY: { value: Float32Array }
  uREx: { value: Float32Array }
  uIndK: { value: number }
}

/** What `lights/room-light` puts on the kernel. */
export interface KernelLightsRoomLight {
  MAX_LIGHTS: number
  EMPTY: BoxRect
  LZU: RoomMaskUniforms
  /** Applies the per-room light mask to a lit material (Lambert, Phong, Standard); idempotent. */
  roomLightMask<M extends THREE_NS.Material | null | undefined>(m: M): M
  lighting(o?: LightingOptions): RoomLighting
  effectLights(o?: { budget?: LightBudget; ours?: readonly number[] }): EffectLighting
}

/** The interactables kit the game injected (`cfg.interactives`), bound: the modules, the adapter of the plan and the three.js side. */
export interface InteractablesRefs {
  GI: typeof Interactables
  HH: HouseholdKit
  GT: { createThreeAdapter(THREE: Three, options?: Record<string, unknown>): InteractablesGfx }
  A: FloorplanAdapter
  gfx: InteractablesGfx
  items: boolean
  effects: boolean
  effectSink: unknown
  camera: unknown
  onEvent: ((event: Interactables.WorldEvent, pub: unknown) => void) | null
  onSeat: ((seat: KitSeat | null, event: Interactables.WorldEvent) => void) | null
}

/** A kit object of the house: its plan entry, where it is drawn, its moving parts and its spec. */
export interface KitEntry {
  id: string
  type: string
  entry: PlanEntry
  floor: number
  group: string
  root: THREE_NS.Group
  parts: Record<string, THREE_NS.Object3D>
  spec: Interactables.ObjectSpec
  /** The TV screen mesh, which swaps material. */
  screen: THREE_NS.Mesh | null
  pos: Vec3
  ry: number
  origin: string
}

/** The kit lamps of a room, its switches and whether it is lit (`ef`: some lamp on and powered). */
export interface KitRoomState {
  id: string
  lamps: string[]
  ef: boolean
  switches: string[]
}

/** Where the player sits or lies in the kit. */
export interface KitSeat {
  object: string
  seatInfo: string
  pose: string
  eye: Vec3
  yaw: number
  pitch: number
  exitPoint: Vec3
  floor: number
  type: string | null
}

/** The kit side of a house (`h.IV`). */
export interface InteractablesState {
  k: InteractablesRefs
  plane: AdapterPlan
  world: Interactables.World
  water: WaterNetwork
  entries: Map<string, KitEntry>
  roots: KitEntry[]
  replace: Set<string>
  roomStates: Map<string, KitRoomState>
  lampRoom: Map<string, string>
  anim: Map<string, { object: string; part: string; target: number; t0: number }>
  screens: Map<string, InteractablesScreen>
  efx: InteractablesEffects | null
  items: THREE_NS.Mesh | null
  itemsDirty: boolean
  itemsT: number
  dirty: boolean
  list: null
  listT: number
  t: number
  circuits: { id: string; room?: string; outlets: string[]; switches: string[]; lamps: string[] }[]
  switchRooms: Set<string>
  warnings: string[]
  tBuild: number
  mats: Record<string, THREE_NS.Material | undefined>
  added?: AddResult
  focus?: { x: number; y: number; z: number } | null
  isBlocked?: BlockedFn
  pub?: HouseInteractives
}

/** What the house publishes of the interactables kit (`house.interactives`): the kit world and its tables, and the calls a game makes on it (in house coordinates). */
export interface HouseInteractives {
  active: boolean
  world: Interactables.World
  plane: AdapterPlan
  kit: InteractablesRefs
  entries: Map<string, KitEntry>
  circuits: InteractablesState['circuits']
  roomStates: Map<string, KitRoomState>
  warnings: string[]
  water: WaterNetwork
  /** TV screens (id -> kit screen). */
  screens: Map<string, InteractablesScreen>
  /** The particle system (smoke). */
  effects(): InteractablesEffects | null
  /** (x, z, floor) -> inside a wall (the check of the furniture doors' sweep). */
  isBlocked: BlockedFn
  /** The kit objects one piece of furniture became (a sink: basin, cabinet, overhead). */
  furnitureObjects(mid: string): KitEntry[]
  target(eye: Eye, options?: KitTargetOptions): KitInteractionTarget | null
  interact(eye: Eye, options?: KitTargetOptions): boolean
  interactables(): { id: string; type: string; floor: number; pos: Vec3; radius: number; label: string; act: () => boolean }[]
  /** Where the player sits or lies, if they do. */
  seatInfo(): KitSeat | null
  sit(object: string, seat: string): boolean
  stand(): Vec3 | null
  /** Opens (`target` truthy) or closes all the doors and drawers of a piece of furniture. */
  opens(mid: string, target: unknown): void
  /** Reads a breaker (no `on`) or sets it. */
  breaker(circuit: string, on?: unknown): boolean
  lightOn(roomId: string): boolean | null
  light(roomId: string, on: unknown): void
  /** Whether a kit animation is running. */
  animate(): boolean
}

/** A house being built or played, as the kit side reads it (the per-house state `enter(h)` swaps in). */
export interface HouseInstance {
  ctx: BuildContext
  inter: InteractiveState
  state: SavedHouseState
  mirrors: MirrorState
  quality: 'high' | 'game'
  /** Distance LOD now (0 full, 1 without the small pieces, 2 hidden) and the least the draw budget allows. */
  lodCurrent: number
  lodMin: number
  IV?: InteractablesState | null
  groups?: Record<string, THREE_NS.Group>
  root?: THREE_NS.Group
  house?: THREE_NS.Group
  houseGroup: THREE_NS.Group
  destruction?: { breach: { setLod(n: number): void } }
}

/** What `interactables/kit` puts on the kernel. */
export interface KernelInteractablesKit {
  IVK: InteractablesRefs | null
  VEG: VegetationLibs | null
  vegMaterials(): VegetationThree.VegetationMaterials
}

/** What `interactables/bridge` puts on the kernel. */
export interface KernelInteractablesBridge {
  IV_MATERIAL: Record<string, string>
  IV_WIRE: Record<string, Hex>
  IV_DOOR: RegExp
  ivGroup(e: { floor: number }): string
  ivAccumulate(mat: string, g: THREE_NS.BufferGeometry, ox: number, oy: number, oz: number, ry: number, color: Hex | null): void
  ivBuild(h: HouseInstance, water: WaterNetwork): InteractablesState
  ivRoomEffective(IV: InteractablesState, S: KitRoomState): boolean
  ivDraw(IV: InteractablesState, ent: PlanEntry, type: string, item: PlanEntry['item']): Interactables.ObjectSpec
  ivCords(IV: InteractablesState): void
  ivAssemble(IV: InteractablesState, gs: Record<string, THREE_NS.Group>): void
  ivScreen(IV: InteractablesState, E: KitEntry): void
  ivEvent(h: HouseInstance, e: Interactables.WorldEvent): void
  ivSeat(IV: InteractablesState): KitSeat | null
  ivUpdate(h: HouseInstance, dt: number, time?: number, focus?: { x: number; y: number; z: number } | null): void
  IV_SHAPE: Record<string, [string, number, number, number, number, number][]>
  ivItems(IV: InteractablesState, h: HouseInstance): void
  ivTarget(IV: InteractablesState, o: Eye, opt?: KitTargetOptions): KitInteractionTarget | null
  ivRoomLight(IV: InteractablesState, roomId: string, on: boolean): void
  ivParts(IV: InteractablesState, parts: Record<string, unknown>, tagDamage: (type: string) => unknown): void
  ivDispose(h: HouseInstance): void
  ivPublish(h: HouseInstance): HouseInteractives
}

/** A kit object as an interaction target. */
export interface KitTarget extends TargetRef {
  kit: true
  id: string
  type: string
  object: KitEntry
  item: Interactables.Interactable
  floor: number
  pos: number[]
  text(): string
}

/** The best kit target of an eye. */
export type KitInteractionTarget = InteractionTarget & { target: KitTarget }

/** Options of the kit target: reach, cone and a filter of the candidates. */
export interface KitTargetOptions {
  reach?: number
  cone?: number
  exclude?: (E: KitEntry, k: Interactables.Interactable) => boolean
}

/** A text label of the plan view: a room name or a type with no model. */
export interface HouseLabel {
  pos: THREE_NS.Vector3
  text: string
  group: string
  type: string
  floor?: number
}

/** Gutters, downpipes and drains the roof drew (`house.gutters`). */
export interface GutterInfo {
  /** Each gutter: floor, side of the roof, axis it runs along, from `a` to `b` at `p` across, at height `y`. */
  gutters: { f: number; side: string; axis: string; a: number; b: number; p: number; y: number }[]
  /** Each downpipe: floor, place, bottom and top, and the drain it ends in (none when it floats over a lower roof). */
  downpipes: { f: number; x: number; z: number; y0: number; y1: number; drain: [number, number] | null; hornBox?: boolean }[]
  drains: { x: number; z: number }[]
}

/** The plants the vegetation drew (`house.vegetation`). */
export interface VegetationInfo {
  plants: number
  triangles: number
  colliders: (Vegetation.LotColliderData & { y: number; group: string })[]
  lodCounts: number[]
  materials: VegetationThree.VegetationMaterials
}

/** What one build of a house knows while it draws (`shared.ctx`): the record, its tables and what each module collected. */
export interface BuildContext {
  /** The house is built with its construction stages (`BuildOptions.constructionStages`): the builders tag what they draw with the stage it belongs to. */
  constructionStages?: boolean
  mv: Props3d
  types: TypeTable
  r: HouseRecord
  /** The colour roles of the palette, `0xrrggbb` (`r.colors`, its `meta` aside). */
  colors: Record<string, Hex>
  cut: boolean
  night: boolean
  labels: HouseLabel[]
  colliders: BoxCollider[]
  /** How many of the colliders are walls (they come first). */
  wallColliders: number
  stairs: StairRecord[]
  noTerrain: boolean
  roomById: Record<string, HouseRoom>
  pieces: Map<string, PieceRecord>
  pieceObjects: Map<string, THREE_NS.Object3D[]>
  structureIndex: Record<string, StructurePart>
  panelView: PanelView
  panelsOf: Map<string, StructurePart[]>
  showPillars: boolean
  baseboardBand: boolean
  /** `BuildOptions.gutters === 'visor'`. */
  visorGutters: boolean
  /** `BuildOptions.eave === 'visor'`. */
  visorEave: boolean
  /** `BuildOptions.wallCorners === 'visor'`. */
  visorCorners: boolean
  /** `BuildOptions.ceilings === 'visor'`. */
  visorCeilings: boolean
  /** The scene of the Visor de casas 3D (its gutters, eave, corners and ceilings at once): what reproduces the team's golden draws as the team did. */
  visorScene: boolean
  /** Boxes of the ceilings' slabs, by their builder (outside the Visor's scene): a later box of another builder is laid round them, never through them. */
  occupied: Aabb[]
  /** The boxes of the lot's walls (outside the Visor's scene): the house's sidewalk and baseboard are laid round where one meets the house. */
  lotWalls: Aabb[]
  /** The boxes of the storeys' floor finishes and slabs (outside the Visor's scene): the furniture and the flights standing on them keep out of them. */
  floorFinishes: Aabb[]
  /** The floor the piece being drawn stands on (a storey's furniture, outside the Visor's scene): a face looking down on its plane is shut by it, as by the ground. */
  restOn?: number | undefined
  /** The boxes a piece being drawn keeps out of (a storey's furniture among the walls, outside the Visor's scene): what of a box stands in them is not drawn. */
  keepOut?: readonly Aabb[] | undefined
  /** The square boxes of the piece being drawn so far (a storey's furniture, outside the Visor's scene): a face of a later one lying against one is not drawn. */
  itemBoxes?: Aabb[] | undefined
  /** The group the piece being drawn stands in: only its boxes there are noted (a moving part shows its faces once moved). */
  itemGroup?: string | undefined
  apartment: boolean
  /** Apartment building: floors, the unit's floor and the unit index. */
  pa: number
  pf: number
  pu: number
  showBuilding: boolean
  limits: { x0: number; z0: number; x1: number; z1: number }
  veg: VegetationContext | null
  vegInfo: VegetationInfo | null
  iv: InteractablesState | null
  leaves: DoorLeaf[]
  /** Groups of the `part:` contract by name (`laundry_<seed>`, `mailbox_<id>`). */
  parts: Record<string, THREE_NS.Object3D>
  clotheslines: unknown[]
  animateDoorsOn: boolean
  waterTankPos?: { x: number; z: number; y: number; group: string }
  roofRects: RoofRect[]
  noPiece: boolean
  _flights?: { r: HouseRecord; l: Flight[] }
  solarInfo: SolarInfo | null
  electricalInfo: ElectricalInfo | null
  gutter: GutterConfig
  gutterInfo: GutterInfo | null
  /** Roof planes of the plan (`res.roof.panes`). */
  panes: { id: string; aabb?: number[]; [extra: string]: unknown }[]
  lights: LightRequest[]
  unitRy?: number
  unitInverse: THREE_NS.Matrix4
  outbuildingList?: Outbuilding[]
  tBuild: number
  /** Types with no builder, and how many items of each. */
  noModel: Map<string, number>
}

/** The state a house keeps between builds (`newState()`): doors, moving pieces, water and the kit world. */
export interface SavedHouseState {
  doors: Map<string, boolean>
  inter: Map<string, number | boolean>
  water?: WaterState | null
  iv?: Interactables.WorldState | null
}

/**
 * The state the kernel works on (`shared`): the house being built or played (`enter(h)` swaps its `ctx`, `inter`, `doorState`, `partState`,
 * `mirrors` and `quality` in) and what the renderer shares across houses (materials, counters).
 */
export interface SharedState {
  ctx: BuildContext
  inter: InteractiveState
  doorState: Map<string, boolean>
  partState: Map<string, number | boolean>
  mirrors: MirrorState
  quality: 'high' | 'game'
  mats: MaterialTable
  vegMaterials: VegetationThree.VegetationMaterials | null
  /** The kit a lamp or tap draws its moving parts with (`furniture/spec` swaps it). */
  api0: FurnitureApi | null
  partCount: number
  tapCount: number
  destructionSeq: number
  mirrorEnv: THREE_NS.CubeTexture | null
  mirrorMat: THREE_NS.MeshStandardMaterial | null
}

/** What `destruction/pieces`, `destruction/breach` and `destruction/world` put on the kernel: the fragments, the structure of a house and its adapter to the destruction world. */
export interface KernelDestruction {
  FRAGMENT_COLOR: Record<string, number>
  FRAGMENT_GEO: THREE_NS.BoxGeometry
  FRAGMENT_MAT: Record<string, THREE_NS.MeshLambertMaterial>
  fragmentMaterial(material: string): THREE_NS.MeshLambertMaterial
  /** Tags the loose groups that are pieces (doors, water tank, gas cylinder, pipes, gates, panels): userData on the meshes and a piece record. */
  markGroups(r: HouseRecord, root: THREE_NS.Group, parts: Record<string, HousePart>): void
  /** The structure of a built house (`house.structure`). */
  assembleStructure(r0: HouseRecord, root: THREE_NS.Group): HouseStructure
  /** The adapter of a built house to the destruction world (`house.destruction`). */
  createHouseDestruction(root: THREE_NS.Group, house: THREE_NS.Group, structure: HouseStructure, parts: Record<string, HousePart>, colliders: readonly DestructionCollider[], water: WaterApi): HouseDestruction
  createBreachView(opts: BreachViewOptions): BreachView
  /** The painting of every house's breach, as one queue for a frame budget. */
  breachPaintQueue: DeferredQueue
}

/** What `build/build` puts on the kernel: `build(result, options)` draws a house and returns it (`House`). */
export interface KernelBuildBuild {
  build(r0: HouseRecord, options?: BuildOptions): House
}

/** What `build/instance` puts on the kernel: the props kit, the type table, the saved state, `enter(h)` and the damage of a class. */
export interface KernelBuildInstance {
  props: Props3d
  TYPES: TypeTable
  newState(): SavedHouseState
  /** Makes `h` the house the kernel works on. */
  enter(h: HouseInstance): void
  tagDamage(type: string): Damageable
}

/** The renderer as `buildApi` makes it: the public `HouseRenderer` plus the kernel and the shared state for the recorders of `furniture/spec` (not a stable api). */
export type HouseRendererInternal = HouseRenderer & { internals: { K: Kernel; shared: SharedState } }
