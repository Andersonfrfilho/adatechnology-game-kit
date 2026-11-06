import type * as THREE from 'three'
import type { DeferredQueue } from '@adatechnology/game-contracts'
import type { LightBudget } from '@adatechnology/game-render-three'
import type { Messages } from './locale.js'
import type { DocumentLike, Props3d, Props3dOptions } from '@adatechnology/game-props3d'
import type { DestructionEvent, DestructionWorld } from '@adatechnology/game-destruction'
import type { HouseDestruction, HouseStructure } from './destruction/types.js'
import type { FloorplanResult } from '@adatechnology/game-floorplan'
import type { HouseDestructionRenderer } from './adapter-shapes.js'
import type { AdapterOptions, FloorplanAdapter, HouseholdKit } from '@adatechnology/game-floorplan-interactables'
import type { BoxCollider, BuildContext, DoorLeaf, ElectricalInfo, Eye, GutterInfo, HouseInstance, HouseInteractives, HouseLabel, HouseRecord, HouseRoom, InteractionTarget, CarModel, InteractablesRefs, KitInteractionTarget, ReflectorClass, Three, VegetationLibs, EffectLighting, MaterialTable, RoomLighting, TypeTable, InteractiveState, KitTargetOptions, LightRequest, MirrorState, SavedHouseState, SolarInfo, StairRecord, VegetationInfo, WaterApi } from './kernel-types.js'

/** A part of the house a hit can damage (door, window, glass, tank...): the game reads `hp`. */
export interface Damageable {
  type: string
  hp: number
  hpMax: number
}

/** A damageable box of a fleet car, in the car's frame (`game-vehicles` gives them). */
export interface HouseFleetDamageable {
  box: THREE.Box3
  zone: string
  part?: string
  side?: string
  type?: string
}

/** A car the fleet built: its group (+z in front), its damageable boxes, and how to give its resources back. */
export interface HouseFleetCar {
  group: THREE.Object3D
  damageables?: HouseFleetDamageable[]
  release?(): void
}

/** The interactables kit a game injects (`interactives`): its modules, and optionally its own adapter of the plan. */
export interface HouseInteractivesOptions {
  GameInteractables?: InteractablesRefs['GI']
  GameInteractablesHousehold?: HouseholdKit
  GameInteractablesThree?: InteractablesRefs['GT']
  /** An adapter, or a factory with `create(options)`; the default is `@adatechnology/game-floorplan-interactables`. */
  adapter?: FloorplanAdapter | { create(options: AdapterOptions): FloorplanAdapter }
  /** Passed to the factory's `create()`. */
  adapterOptions?: AdapterOptions
  locale?: AdapterOptions['locale']
  region?: AdapterOptions['region']
  /** `false`: the kit does not draw the items of the plan. */
  items?: boolean
  /** `false`: no particle effects. */
  effects?: boolean
  /** () => the host's `EffectSink`: smoke, steam, fire and sparks go through its world. */
  effectSink?: unknown
  camera?: unknown
  onEvent?: InteractablesRefs['onEvent']
  onSeat?: InteractablesRefs['onSeat']
}

/** The vegetation packages a game injects (`vegetation`): `{ GameVegetation, GameVegetationSpecies }`, or one object with both sides. */
export type HouseVegetationOptions = { GameVegetation?: VegetationLibs['G']; GameVegetationSpecies?: VegetationLibs['S'] } & Partial<VegetationLibs['G'] & VegetationLibs['S']>

/** What `onInteract` gets: the id, type and label of what the player acts on, and the house's or the kit's own reference to it. */
export interface HouseInteractTarget { id: string; type: string; label: string; ref: unknown }

/** What `onDamage` gets for a wall. */
export interface HouseWallDamage { type: 'wall'; damageable: Damageable; collider: { damageable?: Damageable; piece?: string } }

/** What `create(THREE, options)` reads. Everything is optional; the three.js namespace is the first argument. */
export interface HouseRendererOptions {
  /** Document used to draw the procedural textures on a canvas (default: the page's). */
  document?: DocumentLike
  /** `'game'` merges more and draws less than `'high'`. */
  quality?: 'high' | 'game'
  /** Locale of the texts the house shows (`en`, `pt-BR`) or a table of messages. */
  locale?: string | Partial<Messages>
  /** `@adatechnology/game-props3d` (default: the package's own dependency). */
  props?: { create(THREE: Three, options?: Props3dOptions): Props3d }
  /** `THREE.Reflector` (three/examples/jsm/objects/Reflector.js); without it the mirrors use only the environment map. */
  reflector?: ReflectorClass
  /** Cars of the lot and garage: `build(kind, { quality, seed })` -> `{ group, damageable, release() }`. Without it there are no cars. */
  fleet?: { build(kind: string, options: { quality: string; seed: number }): HouseFleetCar } | null
  /** Car kinds (fleet ids) per lot style (`budget`, `mid`, `high`); replaces the list of a style. */
  carKinds?: Record<string, string[]>
  /** Hit points per damage class (glass, wood, water, metal, masonry, rubber, fuel, gas). */
  hp?: Record<string, number>
  /** Textures from the app that replace the procedural ones. */
  textures?: Partial<Record<'roughcast' | 'block' | 'tile' | 'dirt' | 'grass' | 'asphalt' | 'sidewalk' | 'fiber_cement', THREE.Texture>>
  /** Atlas textures from the app: framed pictures, floor kinds, water. */
  atlas?: { picture?: THREE.Texture; floorKind?: THREE.Texture; water?: THREE.Texture }
  /** Materials the game swaps (a material or a function of the default one). */
  materials?: Record<string, THREE.Material | ((material: THREE.Material, key: string) => THREE.Material | null | undefined | void)>
  /** The world of `@adatechnology/game-destruction`; the house registers itself in it on first need. */
  destruction?: DestructionWorld
  /** `createDestructionRenderer(THREE, { scene, world })` of `@adatechnology/game-destruction-three`: draws fracture, collapse, fragments, spalls and the rebar cage on the house's meshes. */
  destructionRenderer?: HouseDestructionRenderer
  /** The lights of effects (a blast, a fire, a flare) light the room where their point is, and the rooms either side of an open door or window next to it (see `effectLights` and `lighting`). Default true; false keeps them off every house surface. */
  effectLightsIndoors?: boolean
  /** Milliseconds per frame the house may spend repainting damaged walls (chipped plaster, holes); events of one frame are painted together. Default `Infinity` (all of them at the frame's flush); a game loop sets a few ms. */
  breachPaintBudgetMs?: number
  /** The interactables kit, injected: `{ GameInteractables, GameInteractablesHousehold, GameInteractablesThree, adapter (optional), adapterOptions, locale, region, items, effects, effectSink, camera, onEvent, onSeat }`. */
  interactives?: HouseInteractivesOptions
  /** The vegetation packages, injected: `{ GameVegetation, GameVegetationSpecies }`. */
  vegetation?: HouseVegetationOptions
  /** Maps an id of the plan to the key its seeded random draws use, to reproduce a scene drawn with other ids (golden tests). */
  seedKey?: (id: string) => string | null | undefined
  /** Distance (m) beyond which the interior (`interior`) and the house (`hide`) are drawn no more, or `false` to switch distance LOD off. */
  lod?: false | { interior?: number; hide?: number }
  drawCallBudget?: number
  onChange?: (change: { shadow: boolean }) => void
  /** A collider opened or closed (a door, a gate, a piece of furniture moved). */
  onCollider?: (collider: HouseBoxCollider | HouseFurnitureCollider) => void
  /** A part took damage (`house.damage`, a hit of the destruction world): the part, or for a wall `{ type: 'wall', damageable, collider }`. */
  onDamage?: (part: HousePart | HouseWallDamage, point: HousePoint | null | undefined, type: string) => void
  /** Every event of the destruction world about this house, with the house's inner group. */
  onWreck?: (event: DestructionEvent, house: THREE.Group) => void
  /** The player acts on something; returning `false` cancels it. */
  onInteract?: (target: HouseInteractTarget, action?: InteractionTarget | KitInteractionTarget) => boolean | void
  /** A room's light turned on or off (`on` is what it shows now). */
  onLight?: (roomId: string, on: boolean) => void
  onMessage?: (text: string) => void
}

export interface BuildOptions {
  /** `'high'` (default) or `'game'`. */
  quality?: 'high' | 'game'
  /** Night: lit windows and room lamps. */
  night?: boolean
  /** Roof cut off and floors above hidden, to look into the plan. */
  cut?: boolean
  /** A state returned by `newState()`: pass the same one to rebuild without closing every door. */
  state?: SavedHouseState
  /** `false`: the app already has ground, street and lawn. */
  terrain?: boolean
  /** `true`: no lot wall, fence or gates (the game has its own). */
  noPerimeter?: boolean
  /** `'meshes'`: one mesh per structural piece instead of one per group and material. */
  pieces?: 'meshes'
  /**
   * The concrete pillars that stand in the masonry walls (`wall_column_*`, `column_*` at the corners and `jamb_column_*` of the structure). `'shown'` (default): drawn as what they are, plastered and painted
   * a shade off the wall and standing 2.5 cm out of each face (a 20 cm pillar in a 15 cm wall), so the frame reads from the ends of each wall, its corners
   * and its openings, and a shot or a blow that takes their plaster off shows their concrete and bars. `'hidden'`: inside the wall, seen only where it is
   * damaged, as the Visor de casas 3D drew the houses.
   */
  pillars?: 'shown' | 'hidden'
  /**
   * `'tiles'` (default): the outer baseboard is laid tile by tile and the sidewalk slab by slab, each a piece that breaks on its own (`BASEBOARD_TILES`,
   * `SIDEWALK_SLABS`). `'band'`: one strip of each per face, as the Visor de casas 3D drew them (still destructible, as a whole).
   */
  baseboard?: 'tiles' | 'band'
  drawCallBudget?: number
  building?: { floors?: number; floor?: number; unit?: number; showBuilding?: boolean }
}

/** Something the player can use, as the house publishes it: where it is, how far it reaches, its prompt and how to use it. */
export interface HouseInteractable {
  id: string
  type: string
  floor: number
  pos: number[]
  radius: number
  angle?: number
  readonly label: string
  ref: unknown
  _action: () => unknown
  act?: () => boolean
}

/** A part of the house that moves or takes damage (`house.parts[id]`): its group, its damage and how to open it. */
export interface HousePart {
  id: string
  type: string
  group: THREE.Object3D | null
  damageable: Damageable | null
  opens(t: number): void
  readonly t: number
  floor?: number
  /** Box of a virtual part (window, mirror, car zone): `[x0, y0, z0, x1, y1, z1]`. */
  aabb?: number[]
  virtual?: boolean
  [extra: string]: unknown
}

/** What `HouseRenderer.build` takes: a plan of `game-floorplan` (`generate`), or a house record made from one. */
export type HousePlan = FloorplanResult | HouseRecord

/** A point in world coordinates. */
export interface HousePoint { x: number; y: number; z: number }

/** A box collider of `house.colliders`: a wall, door, lot wall or gate on floor `f`, `[x0, z0]`-`[x1, z1]`. */
export type HouseBoxCollider = BoxCollider

/** A furniture collider of `house.colliders`: the oriented box of a piece on its floor. */
export interface HouseFurnitureCollider { type: 'furniture'; f: number; obb: { cx: number; cz: number; hw: number; hd: number; c: number; s: number }; item: string; off: boolean }

/** Options of `house.target` and `house.interact`: the ray test the game uses for the meshes, and the options of the interactables kit's targeting. */
export interface HouseTargetOptions { strike?: (meshes: THREE.Mesh[]) => THREE.Intersection | null | undefined; interactives?: KitTargetOptions }

/** The house the renderer built. The three.js groups are ready to add to a scene. */
export interface House {
  version: string
  /** The plan it was built from. */
  r: HouseRecord
  name: string
  quality: 'high' | 'game'
  group: THREE.Group
  house: THREE.Group
  groups: Record<string, THREE.Group>
  floors: THREE.Group[]
  ceilings: (THREE.Group | null)[]
  roof: THREE.Group | null
  lot: THREE.Group | null
  ground: THREE.Group | null
  building: THREE.Group | null
  /** The water tank of the plan: its part, its group, where it stands and the plan's tank. */
  waterTank: { part: HousePart | null; group: THREE.Object3D | null; pos: { x: number; z: number; y: number; group: string } | null; plant: NonNullable<HouseRecord['waterTank']> } | null
  /** Public colliders: walls, doors, lot walls and gates (aabb) and furniture (obb). */
  colliders: (HouseBoxCollider | HouseFurnitureCollider)[]
  /** Parts that move or take damage: id -> `{ group, type, opens(t), damageable }`. */
  parts: Record<string, HousePart>
  /** The lot and garage cars: fleet kind, seed, place and the ids of their virtual parts. */
  cars: { i: number; k: string; seed: number; pos: number[]; ry: number; scale: number; parts: string[] }[]
  interactables: HouseInteractable[]
  doors: DoorLeaf[]
  stairs: StairRecord[]
  labels: HouseLabel[]
  /** Item types of the plan the props kit has no model for, with their count. */
  noModel: Map<string, number>
  /** The real lights the builders asked for (at night) in `list`, and the same grouped by room id in `byRoom`. */
  lights: { list: LightRequest[]; byRoom: Record<string, LightRequest[]> }
  limits: { x0: number; z0: number; x1: number; z1: number }
  apartment: boolean
  showBuilding: boolean
  buildingConfig: { floors: number; floor: number; unit: number }
  unitRy: number
  night: boolean
  cut: boolean
  /** What the interactables kit published for the house (with `interactives`). */
  interactives: HouseInteractives | null
  /** The doors and pieces state to pass to a rebuild (`build(plan, { state })`). */
  state: SavedHouseState
  stats: { quality: 'high' | 'game'; drawCalls: number; drawCallsLOD1: number; triangles: number; trianglesLod1: number; budget: number | null; overBudget: boolean; tBuild: number }
  vegetation: VegetationInfo | null
  solar: SolarInfo | null
  water: WaterApi
  electrical: ElectricalInfo | null
  gutters: GutterInfo | null
  /** The structure of the house (`game-floorplan-structure`): its parts and `spec()`, the destructible spec. */
  structure: HouseStructure
  /** The adapter to the destruction world (`destruction` option). */
  destruction: HouseDestruction
  update(dt: number, time?: number, focus?: HousePoint): void
  show(options?: { floor?: number; cut?: boolean; lot?: boolean }): void
  target(eye: Eye, options?: HouseTargetOptions): InteractionTarget | null
  interact(eye: Eye, options?: HouseTargetOptions): boolean
  /** The message the house shows now (a locked door...), or null. */
  message(): string | null
  toggleDoor(door: DoorLeaf | string): void
  toggleLight(room: string): void
  lightOn(room: string): boolean
  collide(x: number, z: number, floor: number, options?: { radius?: number; from?: readonly number[] }): boolean
  roomAt(floor: number, x: number, z: number): HouseRoom | null
  /** Height of the floor `f`. */
  y0(floor: number): number
  chooseMirror(camera: THREE.Camera): void
  setLod(level: number): void
  readonly lod: number
  /** World centre of the house, and its distance to a point (the shared draw budget sorts by it). */
  center(): THREE.Vector3
  distance(focus: THREE.Vector3 | HousePoint): number
  damage(id: string, point?: HousePoint | null, type?: string, amount?: number): { part: HousePart; hp: number; destroyed: boolean } | null
  colliderDamage(collider: { damageable?: Damageable; piece?: string } | null | undefined, point?: HousePoint | null, type?: string, amount?: number): { hp: number; destroyed: boolean } | null
  /** The part (door, window, furniture piece...) an object belongs to, found by going up its parents. */
  partOf(object: THREE.Object3D | null | undefined): HousePart | null
  /** The first part whose box holds the point (with a tolerance, default 5 cm). */
  partAt(point: HousePoint, tolerance?: number): HousePart | null
  dispose(): void
  /** The builder's own state, for the recorders and the tests: not a stable api. */
  internal: { h: HouseInstance; ctx: BuildContext; inter: InteractiveState; partState: Map<string, number | boolean>; doorState: Map<string, boolean>; mirrors: MirrorState }
}

/** What `HouseRenderer.lighting` reads. */
export interface LightingOptions {
  scene?: THREE.Object3D
  /** Room lights, 1 to 12 (6). */
  n?: number
  /** How many of them cast shadows (2). */
  shadows?: number
  shadowSize?: number
  /** Outside lamps that may take a light (2). */
  external?: number
  /**
   * The host's LightBudget: the house leases `n` point slots (`shadows` with shadow) for good instead of creating lights, and the room masks are written at the slot of each light (what the shader
   * indexes by). Without it the lights are created here, which changes every lit material's program key (deprecated, removed in the next major).
   */
  budget?: LightBudget
}

/** The renderer `create(THREE, options)` returns. */
export interface HouseRenderer {
  version: string
  /** Builds the house of a plan (the result of `game-floorplan`, or a house record such as `wallPlan`'s). */
  build(plan: HousePlan, options?: BuildOptions): House
  newState(): SavedHouseState
  /** Damage class and props kit type of each item type. */
  types: TypeTable
  /** The props kit (`game-props3d`) the renderer draws with. */
  mv: Props3d
  applyPart(group: THREE.Object3D, t: number): void
  materials: MaterialTable
  /** Lets a material take the room light mask of `lighting()` (returns it). */
  roomLightMask<M extends THREE.Material | null | undefined>(material: M): M
  lighting(options?: LightingOptions): RoomLighting
  /**
   * Lets the lights of effects (a blast, a fire, a flare) that hold slots of `budget` light the room their point is in, and the rooms either side of an open door or window next to it.
   * Call `update(houses)` every frame after the budget's `present`. Works without `lighting()`. Off for every house with `effectLightsIndoors: false`.
   */
  effectLights?(options?: { budget?: LightBudget; ours?: readonly number[] }): EffectLighting
  setNight(night: boolean): void
  /** The painting of the damaged walls of every house as a `DeferredQueue` for a shared frame budget; `budget.register` attaches it and `flush()` stops painting from `onFrame`. */
  deferredQueue?(): DeferredQueue
  cars: { model(kind: string, seed?: number): CarModel | null; group(kind: string, w: number, d: number, seed?: number): THREE.Group | null; info(kind: string, seed?: number): { parts: number; tris: number; L: number; W: number; H: number } | null }
  dispose(): void
}
