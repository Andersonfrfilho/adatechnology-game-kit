/**
 * Public types of @adatechnology/game-test-room.
 *
 * A self-contained test room any team can drop into its viewer: a floor with a target wall, shelves and a table, a first-person player
 * (pointer lock, WASD) with an orbit fallback, a catalogue of the host's objects, and tools. The player can spawn objects, grab them, carry,
 * drop and throw them (a thrown or dropped object takes and deals blunt damage), shoot them with real calibres, hit, cut, burn, melt, blow up
 * and take them apart joint by joint, inspect the state of every part, and use items that hold liquids (fill a cup, drink a coffee, pour, spill, shoot a jerrycan and watch it leak).
 * Every action and result goes to a behaviour log shown on screen in plain words and exportable as JSON / NDJSON, and scripted scenarios run
 * from buttons (or headless in tests) and write pass/fail checks to the same log, so people and agents can verify the behaviour.
 */
import type * as THREE_NS from 'three'
import type { AudioEngine } from '@adatechnology/game-audio'
import type { BlastOptions, DestructibleSpec, DestructionEvent, DestructionOptions, DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { DoorUseRules, FurniturePushRules } from '@adatechnology/game-player'
import type { RoomDoorState } from './door-open'
import type { RoomPushState } from './furniture-push'
import type { RoomLoading } from './loading'
import type { DestructionRenderer, FragmentLifeRule, Quality, SpecFromObjectOptions } from '@adatechnology/game-destruction-three'
import type { Arsenal, WeaponDef, WeaponState } from '@adatechnology/game-weapons'
import type { SpriteKindDef, VfxWorld } from '@adatechnology/game-vfx'
import type { Terrain, TerrainBudget } from '@adatechnology/game-terrain'
import type { GroundLayout } from '@adatechnology/game-contracts'
import type { SchedulerStats } from '@adatechnology/game-runtime'
import type { FilmBridge, FluidRenderer } from '@adatechnology/game-fluids-three'
import type { ContainerSpec, FluidWorld, ItemUseDef, LiquidDef, SurfaceSpec } from '@adatechnology/game-fluids'
import type { RoomSeat } from './seating'
import type { AnimationClipSpec, BlastShoveOptions, BusyOptions, BusyTask, ControlValue, DestructibleImpl, EnvironmentBus, HandTargets, ItemSeat, ModuleControl, ModuleItemSeal, ModuleLayer, TestableModule } from '@adatechnology/game-contracts'

export type { InspectInfo } from './ui'
import type { InspectInfo } from './ui'
/** What `strikeCombo` takes: the shape of `StrikeCombo` of game-characters-people, restated so the room does not depend on it. */
export type StrikeComboOption = {
  readonly id: string
  readonly name?: Readonly<Record<string, string>>
  readonly tools: readonly string[]
  readonly steps: ReadonlyArray<{ readonly clip: string; readonly hand?: 'left' | 'right' }>
  readonly reset: number
}
export type { RoomAvatar, RoomAvatarState, RoomFirstPersonState, RoomReachView, CameraMode, KickLeg, PunchHand, ThirdPersonOptions } from './avatar'
import type { CameraMode, KickLeg, PunchHand, RoomAvatar, RoomAvatarState, ThirdPersonOptions } from './avatar'
import type { TestTable, TestTableOptions } from './test-table'

export type ThreeNamespace = typeof THREE_NS

/** One entry of the catalogue: something the host can build. */
export interface TestRoomItem {
  /** snake_case id. */
  id: string
  /** Display name (already translated by the host). */
  name: string
  /** Catalogue tab (free text: e.g. `Furniture`, `Vehicles`, `Plants`, `House`, `Weapons and items`). */
  group: string
  /** Build the three.js object, origin at the centre of its footprint on the floor, front facing +z. */
  build: (THREE: ThreeNamespace) => THREE_NS.Object3D
  /** Destruction spec. Default: `specFromObject3D` on the built object with `specOptions`. A function gets the built root. */
  spec?: DestructibleSpec | ((root: THREE_NS.Object3D) => DestructibleSpec)
  specOptions?: SpecFromObjectOptions
  /** Can be grabbed and thrown (default: total mass <= `maxCarryKg`). Vehicles and trees are usually `false`. */
  movable?: boolean
  /** A big piece that stands on the floor (a sofa, a wardrobe, a fridge) and can be pushed by leaning on it (`TestableItem.pushable`). Default false. */
  pushable?: boolean
  /** Short note shown in the inspector. */
  note?: string
  /** Building it takes a noticeable time (a vehicle): the catalogue shows the loading indicator while it spawns one. `true`, or the text to show. */
  slow?: boolean | string
  /**
   * The item holds a liquid (a cup of coffee, a bottle, a jerrycan, a fuel tank). `part` is the destruction part that is the container (a
   * bullet hole in it makes it leak). `uses` are the item uses offered while it is held (`drink`, `pour`...; defaults from `ITEM_USES`).
   */
  fluid?: { container: ContainerSpec; part?: string; uses?: string[]; offset?: Vec3 }
  /**
   * The item is a sealed container (`ModuleItemSeal`): a use that empties it (`eat`, `drink`, `pour`) opens it first, by hand or with one of `openWith` (an item
   * within reach or a weapon of the loadout), and refuses while it needs a tool there is not; a hole through it or a leak spoils it for eating and drinking.
   */
  seal?: ModuleItemSeal
  /** The item is also a weapon the player can equip from the catalogue (e.g. a crowbar, a knife, a pistol on the table). */
  weapon?: string
  /**
   * The item's own destruction (a `DestructibleImpl` of a game module). The room registers it in the world (`world.register`) instead of
   * building a default object from `spec`; `id` is the object id the room gives it and `DestructibleImpl.id` must be that id. Impl items are not movable.
   */
  impl?: (root: THREE_NS.Object3D, id: string) => DestructibleImpl
  /** Use animations the item brings (see `TestRoom.playAnimation`). Part poses move the child of the built object named after the part id. */
  animations?: AnimationClipSpec[]
  /** Where the player can sit or lie on it (see `TestRoom.sit`). */
  seats?: readonly ItemSeat[]
  /** Picture for the catalogue, the search results and the aimed-item label: an image URL or inline `<svg…>` markup (see `TestableItem.thumbnail`). */
  thumbnail?: string
  /** Author and licence of the thumbnail, shown as the tooltip of the picture in the inspector. */
  thumbnailCredit?: string
}

/**
 * One piece of destructible scenery of the arena (the target wall, the table, the shelf, or any piece the host adds): a spec, where it stands and how it is drawn.
 * Keyed by arena object id in `TestRoomOptions.scenery`.
 */
export interface SceneryObject {
  /** What the destruction world is given. */
  spec: DestructibleSpec
  /** World position of the spec's origin. Required for a new id; for a default id it defaults to the object it replaces. */
  position?: Vec3
  /** Turn about the vertical axis, radians (default 0). */
  rotationY?: number
  /** Colour per part id, then per material id, for the default drawing (`buildFromSpec`). */
  colors?: Record<string, number>
  /**
   * Draws the object: a group whose meshes are named by part id (and carry `userData.destructionPart`), in the space of the spec. Without it the room
   * draws one plain mesh per part with `buildFromSpec`.
   */
  build?: (THREE: ThreeNamespace) => THREE_NS.Object3D
  /**
   * Lets the drawing follow the object in the destruction world, for what the room's destruction renderer cannot draw on it (a house wall redraws its
   * courses without the bricks that shots knock out). Called once the object is in the world as `objectId`; the room calls `restore` when it resets the
   * object and `dispose` when it removes it. `update` (optional) is called every frame, after the renderer's: where the follower paints what it deferred.
   */
  follow?: (root: THREE_NS.Object3D, world: DestructionWorld, objectId: string) => { restore?(): void; dispose?(): void; update?(): void } | null | void
  /** Name shown in the inspector and the log (default the translated name of a default id, else the id). */
  label?: string
  /**
   * A top that loose things rest on (and liquids pool on) while that part stands: the part id and the height of its upper face in the spec's space.
   * The rectangle is the part's footprint. Without it nothing rests on the object.
   */
  top?: { part: string; y: number; parts?: readonly string[] }
  /**
   * Where a water tap of the piece pours (a sink, a tub), in the spec's space: the room's tap (its stream and its HUD button) pours there, and the piece's own model is the tap. The first piece with a `spout` wins over the table tap.
   */
  spout?: Vec3
  /**
   * Stands free on the floor (a bookcase, a wardrobe), not fixed to the room: a blast, or shots whose push is enough to move its mass (a shotgun,
   * not a pistol), make it a piece and shove it. Default false: the scenery stays put.
   */
  free?: boolean
  /** Can also be pushed by leaning on it (needs `free`). Default false. */
  pushable?: boolean
}

/** What the room asks when something thrown or set down needs a model: the tool in the hand, the explosive it carries (an id of the arsenal) and how it is used. */
export interface ProjectileQuery {
  weapon: string
  explosive?: string
  kind: 'grenade' | 'molotov' | 'rocket' | 'charge'
}

/** A model for a projectile: the object, and the axis along its length (default +y, what the room's own primitives use; a rocket points that axis along its flight). */
export interface ProjectileModel {
  model: THREE_NS.Object3D
  axis?: Vec3
}

/** The room's tap (a stream of water): how it is drawn and where the water leaves it. */
export interface SceneryTap {
  /** Draws the tap in its own space (the origin where it stands). */
  build: (THREE: ThreeNamespace) => THREE_NS.Object3D
  /** Where the water leaves the spout, in the space of the model. */
  spout: Vec3
  /** World position of the model's origin. Default: standing on the `table` top, with the spout over its right half (no table, no tap). */
  position?: Vec3
  /** Turn about the vertical axis, radians (default 0). */
  rotationY?: number
}

export interface TestRoomOptions {
  THREE: ThreeNamespace
  /** Element the bench fills (canvas + HUD). */
  container: HTMLElement
  /** `en` (default) or `pt-BR`. */
  locale?: string
  catalog: TestRoomItem[]
  /** Weapons and tools in the hotbar: ids of the arsenal (default `DEFAULT_LOADOUT`), plus extra definitions merged into the arsenal. */
  loadout?: string[]
  weapons?: WeaponDef[]
  /** An existing arsenal (default `createArsenal({ locale })`). */
  arsenal?: Arsenal
  /** Fluids: an existing world, extra liquids, item uses, and surfaces (the arena floor and the table are added automatically). */
  fluids?: FluidWorld
  liquids?: LiquidDef[]
  itemUses?: ItemUseDef[]
  surfaces?: SurfaceSpec[]
  /** Extra scripted checks offered as buttons (the built-in `SCENARIOS` are always there). */
  scenarios?: TestRoomScenario[]
  /** Use the host's renderer/scene/camera instead of making its own (then the host calls `bench.update(dt)` every frame). */
  renderer?: THREE_NS.WebGLRenderer
  scene?: THREE_NS.Scene
  camera?: THREE_NS.PerspectiveCamera
  /** World options (seed, extra materials). Or pass an existing world. */
  world?: DestructionWorld
  worldOptions?: DestructionOptions
  quality?: Quality
  /** What the floor is made of until an area lays its own (`TestableModule.ground`). Default a concrete slab. */
  ground?: GroundLayout
  /** Limits of the floor's marks, thrown pieces and redraws per frame. */
  terrainBudget?: Partial<TerrainBudget>
  /** Heaviest object the player can carry (default 60 kg). */
  maxCarryKg?: number
  /** Arena half size in metres (default 14). */
  arenaSize?: number
  /**
   * The destructible scenery of the arena, by object id. The defaults are `target_wall` (a brick wall of panels 11 m ahead of the start), `table` (with the
   * water tap beside it) and `shelf`. A key that matches a default replaces it (the position defaults to the replaced one), `null` removes it, a new key adds
   * a piece (its `position` is required). The player cannot walk through any of them: the collider is the footprint of the spec's parts.
   */
  scenery?: Record<string, SceneryObject | null>
  /** The tap of the room. Omitted: a tap drawn from primitives on a post beside the table; an object: that model (see `SceneryTap`); `null`: no tap. */
  tap?: SceneryTap | null
  /**
   * The model of something thrown (a grenade, a molotov, a rocket) or set down (a charge). The room only knows the arsenal's ids, so the host's weapons package
   * supplies the real model; where it answers nothing the room draws a plain primitive (a sphere, a cylinder, a box).
   */
  projectileModel?: (query: ProjectileQuery) => ProjectileModel | null | undefined
  /** Keys (`KeyboardEvent.code`) that crouch (a tap stays crouched until the next tap, a longer press crouches while held); default `['KeyC']`. Ctrl is left out on purpose: Ctrl+W closes the tab. */
  crouch?: { keys?: string[] }
  /** Spawn these catalogue ids on start, in a row in front of the player. */
  initial?: string[]
  /** Open on one catalogue group (`furniture`, `structure`, `weapons`…): see `TestRoom.openArea`. */
  area?: string
  /** Called for every destruction event (to log, play sounds, sync over LAN). Fluid events reach the log too. */
  onEvent?: (event: DestructionEvent) => void
  onSound?: (key: string, point: Vec3, volume: number) => void
  /**
   * The sound engine of the room (@adatechnology/game-audio): the destruction renderer's sound keys play on it, and modules get it as `host.audio`.
   * Default: a new engine of the room's own (it makes no AudioContext until the first sound); `false` for a silent room.
   */
  audio?: AudioEngine | false
  /** The environment store modules get as `host.environment` (the weather module writes it, the others read it). Default: a new one with a calm dry day. */
  environment?: EnvironmentBus
  /** Show the built-in HUD and panels (default true). */
  ui?: boolean
  /** The player's body (see `TestRoom.setAvatar`). */
  avatar?: RoomAvatar
  /** The view the room starts in (default `first`; the V key and `TestRoom.setCameraMode` change it). */
  cameraMode?: CameraMode
  /**
   * The strike clip each melee tool plays before its blow lands, by tool id. The blow (`meleeUse`, with the aim read again) falls at the clip's impact second, which
   * the avatar's `strike` answers; a tool that is not here, or an avatar that cannot play the clip, strikes at the click. Default `{ fists: 'punch_right', shove: 'shove_two_hands', kick: 'front_kick' }`.
   */
  strikeClips?: Readonly<Record<string, string>>
  /** The numbers of pushing furniture (`FurniturePushRules` of game-player): the player's force, the friction by material, the hold time, the speed. */
  push?: Partial<FurniturePushRules>
  /** The numbers of opening by hand (`DoorUseRules` of game-player): how long the hand takes to the handle, how fast a leaf of each mass swings. */
  doors?: Partial<DoorUseRules>
  /** Which leg the kick uses: `alternate` (default) swaps at each kick starting with the right, or always `left` or `right`. */
  kickLeg?: KickLeg
  /** Metres above the feet the kick looks for a target from (level, the way the player faces; the nearest hit wins), so it finds what stands low in front; default every 10 cm from 0.25 to 0.85 m (shin to hip). */
  kickHeights?: readonly number[]
  /** Keys (`KeyboardEvent.code`) that kick with the arsenal's `kick` tool, whatever tool is in hand; default `['KeyK']` (Shift+V kicks too). */
  kick?: { keys?: string[] }
  /** Which hand throws the one-handed strikes (`punchTools`): `alternate` (default) swaps at each punch starting with the right, or always `left` or `right`. */
  punchHand?: PunchHand
  /** The tools whose strike is thrown with one hand, so `punchHand` picks it (default `['hand', 'fists']`); the shove and the kick are not. */
  punchTools?: readonly string[]
  /**
   * A strike combo the player has (an ability, such as `PUNCH_COMBO` of game-characters-people): while it is on (N, the combo button or `setStrikeCombo`), each blow of its
   * `tools` plays its next step (`{ clip, hand }`) and a pause longer than `reset` seconds starts it over; while it is off the tools strike as usual. Default none.
   */
  strikeCombo?: StrikeComboOption
  /** Start with the combo on. Default false. */
  strikeComboOn?: boolean
  /** The first-person stance of the arms by tool id, for the tools that hold nothing the module places (default `{ fists: 'fists' }`; any other tool holds, or is `relaxed` with nothing to hold). */
  handStances?: Readonly<Record<string, string>>
  /** The over-the-shoulder view of the `third` mode: distance, shoulder, height, wall probes. Defaults are the team game's. */
  thirdPerson?: ThirdPersonOptions
  /**
   * Milliseconds of every frame the deferred queues (sound voices, destruction events, breach paint, vehicle crease) share. Default 8, the biggest budget the loose
   * queues had; 4 is the library default of `@adatechnology/game-runtime`, for a room whose `maxFramesWaiting` stays under 15 (see `frameStats()`).
   */
  frameBudgetMs?: number
  /** Room counters the bench panel shows and `TestRoom.metrics()` returns (default all); `false` for none. */
  metrics?: readonly RoomMetricId[] | false
  /**
   * How long what breaks off stays on screen. `fragmentLife`: seconds a resting fragment (a chip, a shard, a chunk) stays before it fades, 0 = forever, or a rule per
   * fragment from its material, size and object (default 12 s); `maxFragments`: how many live at once, the oldest fades first (default 160). `particles` tunes the
   * sprites (dust, smoke, chips, sparks...) by kind, e.g. `{ dust: { life: [10, 30] } }` (seconds, min and max). Loose pieces (what breaks off whole: a door, a leg,
   * a slab) stay as part of the map, with collision.
   */
  debris?: { fragmentLife?: number | FragmentLifeRule; maxFragments?: number; particles?: Readonly<Record<string, Partial<SpriteKindDef> | null>> }
  /** Blast options every explosion of the room starts with (`shelter`, `fragmentHits`, `confinement`; default all off). The HUD toggles them and `TestRoom.setBlast` changes them. */
  blast?: BlastOptions
  /**
   * The numbers of the shove an explosion gives to what is around it: loose items, furniture, and the bodies of the modules (people), which read them from `ModuleHost.blastShove`.
   * Default: the SDK's (`DEFAULT_BLAST_SHOVE` of game-contracts: 2 % of the energy becomes speed, 20 m/s at most, falloff `(1 - d / r)^2`).
   */
  blastShove?: BlastShoveOptions
  /**
   * Module bench state. `state` maps a module id to its encoded state, restored when that module is first loaded (a module reloaded
   * keeps its live state instead) before its first changes are sent; ids are per module, so two modules may share a control id.
   * `onChange` gets the encoded state of a module whenever it changes (a page keeps it in its URL). The room never touches `location`.
   */
  bench?: { readonly state?: Readonly<Record<string, string>>; readonly onChange?: (moduleId: string, encoded: string) => void }
  /**
   * The test table (`room.testTable`): a `scenery` piece with a `top` (default id `test_table`) the room lays a group of the catalogue on, a page at a time, to try each item with a
   * shot, a punch, a knife, a flame or a blast. Without that piece the table lays nothing; `false` leaves the panel out too.
   */
  testTable?: TestTableOptions | false
}

/** Counters the room measures itself. `fps` and `frame_ms` use the real frame time, so slow motion does not change them. */
export type RoomMetricId =
  | 'fps' | 'frame_ms' | 'draw_calls' | 'triangles' | 'objects' | 'fragments' | 'particles' | 'decals'
  /** Of the last blast, once the room's blast options are on: the share that reached the most sheltered target (%), the pressure multiplier, the fragment hits. */
  | 'blast_shelter' | 'blast_confinement' | 'blast_fragments'

/** A module control as the room holds it: the declaration with the module's patches applied, and its value (none for an action). */
export type BenchControl = ModuleControl & { readonly disabled: boolean; readonly value?: ControlValue }

export type BenchLayer = ModuleLayer & { readonly on: boolean }

/** The bench of a loaded module, driven from outside the panel (tests, scripts, a page that keeps the state in its URL). */
export interface BenchHandle {
  controls(): BenchControl[]
  layers(): BenchLayer[]
  value(id: string): ControlValue | undefined
  layer(id: string): boolean
  /** Numbers are clamped and snapped to the step. False for an unknown id, a wrong type, an option not offered or a disabled control. */
  set(id: string, value: ControlValue): boolean
  setLayer(id: string, on: boolean): boolean
  act(id: string): boolean
  /** `id=value;id=value`, the format `TestRoomOptions.bench.state[moduleId]` reads back. */
  encode(): string
}

export interface SpawnedObject {
  objectId: string
  itemId: string
  root: THREE_NS.Object3D
  movable: boolean
}

export interface TestRoom {
  /** The room's sound engine, or `null` in a silent room. */
  readonly audio: AudioEngine | null
  /** The environment store lent to modules as `host.environment`. */
  readonly environment: EnvironmentBus
  readonly world: DestructionWorld
  readonly renderer: DestructionRenderer
  readonly scene: THREE_NS.Scene
  readonly camera: THREE_NS.PerspectiveCamera
  /** The test table: lays the catalogue on the `test_table` piece a page at a time and runs the trials (shot, punch, knife, fire, blast) on one item. */
  readonly testTable: TestTable
  /** Spawn a catalogue item at a world position (default in front of the player). */
  spawn(itemId: string, position?: Vec3, rotationY?: number): SpawnedObject
  /** Remove every spawned object, fragment and particle. */
  clear(): void
  /** Repair every spawned object in place. */
  resetAll(): void
  readonly arsenal: Arsenal
  readonly fluids: FluidWorld
  /** The running film of the liquids (blood, fuel, oil): `splat` throws drops into it (a wound), `setWeather` is the rain hook. */
  readonly film: FilmBridge
  /** The room's one effects world (what `host.effects` draws into): the weather moves its wind. */
  readonly vfx: VfxWorld
  /** Equip a weapon or tool of the loadout (or any arsenal id). */
  setTool(weaponId: string): void
  readonly tool: WeaponState
  /** Play an item use on the held item (`drink`, `pour`...). Returns false when nothing is held or the use does not apply. */
  useItem(useId: string): boolean
  /** Use the current tool once from the camera (tests and scripted demos), as the click does: bare hands punch (or let go of what they hold). `hold` seconds for continuous tools. */
  use(hold?: number): void
  /** Where the player's feet are. */
  readonly playerPosition: Vec3
  /** Grab what the camera looks at (or drop what is held). */
  grab(): boolean
  /**
   * Sits the player on a seat an item brings (`TestRoomItem.seats`): on `objectId` (default: what the camera looks at, within 3.2 m), on `seatId` (default: the seat nearest the
   * player). Seated, the keys do not walk and the view stays near the seat's facing; a walk key or a jump gets up. Null when there is no seat there.
   */
  sit(objectId?: string, seatId?: string): RoomSeat | null
  /** Gets up at the seat's exit; false when not seated or something stands on the exit. */
  stand(): boolean
  /** The seat the player is on, or null. */
  readonly seat: RoomSeat | null
  /**
   * Pushing furniture, as holding E against it does: `begin` leans on what the camera looks at (false: nothing within reach to lean on), `setWalk` walks by script (world `[x, z]`, unit; null: the keys), `end`
   * lets go, and `state` says the phase (`grip` while the hold timer fills, `push`, `strain`), the timer and what stops it (`too_heavy`, `obstacle`).
   */
  readonly push: {
    begin(): boolean
    end(): boolean
    setWalk(walk: readonly [number, number] | null): void
    readonly state: RoomPushState | null
  }
  /** Throw what is held at `speed` m/s (default 9). */
  throwHeld(speed?: number): boolean
  /** Point the camera (scripted demos and tests). */
  look(position: Vec3, target: Vec3): void
  /** Object and part the camera looks at, with its state, for the inspector. */
  inspect(): { objectId: string; partId: string; itemId: string } | null
  /** Everything the inspector panel shows for the aimed part (state, joints and the tools that undo them), or null. */
  inspectInfo(): InspectInfo | null
  spawned(): SpawnedObject[]
  /** Advance one frame (only needed when the host owns the loop). */
  update(dt: number): void
  /** Advance frames until the tool in hand has no phase left (the draw `setTool` plays, a reload, a cycle) or `maxSeconds` pass; plus one frame so the next pull is not inside the phase; returns the seconds waited. */
  waitUntilReady(maxSeconds?: number): number
  on(type: 'spawn' | 'tool' | 'grab' | 'throw' | 'event' | 'camera', fn: (data: unknown) => void): () => void
  /** Tilt the held item by `rad` radians around its own x axis (hold Z in the room). Pouring and spilling follow from the tilt. */
  tilt(rad: number): void
  /** Open or close the tap over the table (default: toggle). Returns whether it is open. */
  toggleTap(on?: boolean): boolean
  /** The blast options the room's explosions use now, and a way to change them (each key replaces the old one; `undefined` clears it). */
  blast(): BlastOptions
  setBlast(options: BlastOptions): void
  /** Stop the simulation (time, physics, animations, tools, walks): the UI, the camera and the log stay live. `step` and `update` do nothing until `resume`. Scenarios run unpaused. */
  pause(): void
  resume(): void
  readonly paused: boolean
  /** Walk the player in a straight line to the floor position `to` (x and z; y is ignored) over `seconds` of simulated time, during the next `step()` / frames. Colliders still block. 0 seconds moves at once. */
  walk(to: Vec3, seconds: number): void
  /** 0.25x simulation speed. */
  setSlowMotion(on: boolean): void
  /** Run the simulation 10x per frame (fire, melting and drying take a tenth of the time). */
  setFastForward(on: boolean): void
  /** Turn the strike combo (`strikeCombo`) on or off (N and the combo button do the same); nothing without a combo. */
  setStrikeCombo(on: boolean): void
  /** Whether the strike combo is on; null when the room has none. */
  readonly strikeCombo: boolean | null
  /** Kick with the arsenal's `kick` tool, whatever tool is in hand (K, Shift+V and the kick button do the same); false when there is none or it is not ready yet. */
  kick(): boolean
  /** Equip a weapon by id, adding it to the hotbar when it is not there. Same as selecting a catalogue item with `TestRoomItem.weapon`. */
  equip(weaponId: string): void
  /**
   * Set the room up to test one catalogue group or loaded module (by its group or id): clear it and open the catalogue on that tab. A module
   * that brings an `area` is laid out by it; any other group is laid in rows (small items in front, fixed big ones behind). Unknown: nothing.
   */
  /** The floor: what it is made of, how deep it was dug, its marks and thrown pieces. */
  readonly terrain: Terrain
  openArea(group: string): SpawnedObject[]
  /** The loaded modules (`loadModule`): id, name, catalogue group and whether it lays an area of its own. */
  modules(): Array<{ id: string; name: string; group?: string; hasArea: boolean }>
  /**
   * `openArea` with the loading indicator: shows "Opening <area>…", waits for it to be painted and then lays the area (an area with hundreds of items takes a second or more and would
   * otherwise look frozen). Resolves with the spawned objects. Use it where a person waits for the result (a page that opens an area on load); scenarios call `openArea`, which is synchronous.
   */
  openAreaAsync(group: string): Promise<SpawnedObject[]>
  /** The loading indicator of the room: `begin`, `busy`, `state`, `on` (see `RoomLoading`); modules get it as `ModuleHost.loading`. */
  readonly loading: RoomLoading
  /** `loading.busy`: shows the indicator, waits for it to be painted, runs `work` and takes it down. The way to run a slow, synchronous job. */
  busy<T>(label: string, work: (task: BusyTask) => T | Promise<T>, options?: BusyOptions): Promise<T>
  /** The scenarios the panel offers: the built-in `SCENARIOS` in the room locale plus `TestRoomOptions.scenarios`. */
  readonly scenarios: TestRoomScenario[]
  /** The liquid renderer of `@adatechnology/game-fluids-three` (containers, streams, stains). */
  readonly fluidRenderer: FluidRenderer
  /** The behaviour log (see `TestRoomLog`). */
  readonly log: TestRoomLog
  /** Run scripted checks (no input needed; works headless in tests and from the browser console). */
  runScenarios(scenarios?: TestRoomScenario[]): Promise<ScenarioReport>
  /**
   * Load a module that follows the `TestableModule` contract of `@adatechnology/game-contracts`: its items join the catalogue under `module.group`,
   * its scenarios become buttons, and the contract checks run now (`checkDestructible` for every item with an `impl`, `checkAnimation` for every
   * clip) writing a check line (pass or fail) per result to the log. Loading the same module twice replaces its items and scenarios.
   */
  loadModule(module: TestableModule<ScenarioContext>): ModuleReport
  /**
   * Compiles the shader programs that the first hit, decal or effect would otherwise compile in the middle of a frame, then draws a throw-away blast (its particle materials
   * and lights make the materials recompile the first time they appear) and a fire and clears them, so a loading screen can pay those first-frame costs. Nothing of it stays
   * in the world, the log or the sound. Call it once the lights of the scene are set (a module that adds lights changes the programs).
   */
  warmUp(): void
  /** Animations of the aimed (or held) item: what the animations panel shows. */
  animations(): AnimationInfo | null
  /**
   * Play an animation clip of an item (default the held, else the aimed one). Returns false when there is no such item or clip. Poses are
   * offsets from the rest pose, interpolated linearly; the item keeps the last pose. Events are logged (and `sound` events reach `onSound`).
   */
  playAnimation(clipId: string, objectId?: string): boolean
  /**
   * Opens or closes a leaf (a door, a lid, a drawer: a part an `open_*` clip of the item moves) as the hand does with E: the hand goes to the handle, the leaf swings at the speed of
   * its mass and stops at what is in its way; a locked leaf only rattles. Default part: the first leaf of the object. Answers false when the object has no such leaf.
   */
  useLeaf(objectId: string, part?: string): boolean
  /** How open a leaf is, 0 closed to 1 open (default part: the first leaf). */
  leafOpening(objectId: string, part?: string): number
  /** The parts of an object that open by hand. */
  leaves(objectId: string): string[]
  /** Locks (or unlocks) a leaf, or every leaf of the object when `part` is left out: E then only rattles it. */
  lockLeaf(objectId: string, locked?: boolean, part?: string): void
  /** The leaf being worked by hand now, or null. */
  readonly door: RoomDoorState | null
  /** The bench of a loaded module (default the active one: the module of the last `openArea`, else the last loaded with a bench), or null. */
  bench(moduleId?: string): BenchHandle | null
  /**
   * Show a body for the player (or none with null). The room adds `root` to the scene, puts it at the player's feet with the player's yaw every
   * frame and calls `update` with the speed of the player's movement, Shift, the crouch/down set by `setAvatarState`, whether a firearm is in hand
   * and the camera pitch. Hidden in first person, shown in third. In third person the carried item follows `avatar.hand('R')`. The previous
   * avatar is taken out of the scene, not disposed.
   */
  setAvatar(avatar: RoomAvatar | null): void
  readonly avatar: RoomAvatar | null
  /** Crouch and knocked-down state a player module drives (merged over what is set; the room fills the rest). `armed` forces the armed arms (`null`: follow the tool in hand again). */
  setAvatarState(state: { crouch?: boolean; down?: boolean; armed?: boolean | null }): void
  /** What the first-person arms were last given: the stance, how far the trigger finger is curled (0 extended to 1 pulled) and the targets. Read it on each shot to see the finger. */
  handState(): { stance: string; triggerFinger: number | null; targets: HandTargets | null }
  /** Draws the room from another camera (a debug view: the player's camera, the arms and the tool stay as they are) until it is given null. Look at the arms from the side or at a hand from 25 cm. */
  setDebugCamera(view: { position: Vec3; target: Vec3; fov?: number } | null): void
  /** What the avatar was last given. */
  avatarState(): RoomAvatarState
  /** `first` (the camera is the eye) or `third` (over the shoulder). V toggles it when a body is set. Logged as a `camera` action. */
  setCameraMode(mode: CameraMode): void
  readonly cameraMode: CameraMode
  /** Room counters and the active module's metrics, read now. */
  /**
   * Shakes the camera for the render that follows, by the shake of the effects world, and answers the function that puts it back. The room's own loop
   * wraps its render in it; a host that renders by itself calls it around its own `render`.
   */
  applyCamera(): () => void
  metrics(): { room: Partial<Record<RoomMetricId, number>>; module: Record<string, number | string> }
  /** What the frame scheduler measured: ms per phase of the last frame, substeps, and per deferred queue the work waiting, run, forced and the most frames anything waited. */
  frameStats(): SchedulerStats
  dispose(): void
}

/** What `TestRoom.loadModule` did. */
export interface ModuleReport {
  module: string
  /** Catalogue ids added. */
  items: string[]
  /** Scenario ids added. */
  scenarios: string[]
  /** Every contract check passed. */
  ok: boolean
  /** Each failed check, in words. */
  problems: string[]
}

export interface AnimationInfo {
  objectId: string
  itemId: string
  name: string
  clips: Array<{ id: string; duration: number }>
  /** Clip playing now, if any. */
  playing: string | null
}

/**
 * One line of the behaviour log. Every destruction event becomes one entry with the material, the part status and the numbers that matter, plus
 * the player's actions (spawn, tool use, grab, drop, throw, disassemble) so a reader (a person or an agent) can check the behaviour is right.
 */
export interface LogEntry {
  /** Monotonic index. */
  seq: number
  /** Bench time in seconds. */
  t: number
  /** `action` = something the player or a script did; `event` = a destruction event; `check` = a scenario assertion. */
  channel: 'action' | 'event' | 'check'
  /** Event or action type (`dent`, `hole`, `fracture`, `ignite`, `spawn`, `shoot`, `grab`, `throw`, `disassemble`...). */
  type: string
  objectId?: string
  itemId?: string
  part?: string
  material?: string
  /** Part status and numbers after the event (hp, maxHp, temperature, char, melt, liters, group count). */
  state?: Record<string, number | string | boolean>
  /** Everything else (energy, caliber, depth, diameter, fragment count, joint, tool, pass/fail...). */
  data?: Record<string, unknown>
  /** One human line in the bench locale, e.g. "Cadeira › perna_1 (madeira macia): amassado 4 mm, hp 38/60". */
  text: string
}

export interface TestRoomLog {
  entries(filter?: { channel?: LogEntry['channel']; type?: string; objectId?: string }): LogEntry[]
  clear(): void
  /** JSON array of entries. */
  toJSON(): string
  /** One JSON object per line (easy to grep and diff). */
  toNDJSON(): string
  /** Plain text lines (the on-screen panel). */
  toText(): string
  /**
   * Download the log as a file (`.ndjson` by default). In a claude.ai Artifact page (a `globalThis.claude.use('downloads')` that resolves) it asks the
   * viewer through the `downloads` capability (`ndjson` is saved as `.ndjson.txt`, the allowlist has no `.ndjson`); if the viewer declines, an
   * `export_cancelled` action line is logged. Elsewhere it uses a blob link.
   */
  download(format?: 'json' | 'ndjson' | 'txt'): Promise<void>
  /** Counts per event type and per material (quick summary for checks). */
  summary(): { byType: Record<string, number>; byMaterial: Record<string, number>; objects: number; destroyed: number }
  /** Listener for new entries and for in-place updates of coalesced ones (`updated` true, same entry object). */
  on(fn: (entry: LogEntry, updated: boolean) => void): () => void
  /** Write a line (hosts and scenarios add their own). `seq` and `t` (room time) are filled in. */
  add(entry: NewLogEntry): LogEntry
  /**
   * Write a line, or update in place the last line written with the same `key` when it was touched less than `windowS` seconds ago (default 1).
   * Used for noisy sequences: melting, dripping, taking something apart.
   */
  coalesce(key: string, entry: NewLogEntry, windowS?: number): LogEntry
}

/** What `TestRoomLog.add` takes. */
export type NewLogEntry = Omit<LogEntry, 'seq' | 't'> & { t?: number }

/** A scripted check: spawn things, act, then assert on the log and the world state. */
export interface TestRoomScenario {
  id: string
  /** Shown in the report (already translated). */
  name: string
  run: (ctx: ScenarioContext) => void | Promise<void>
}

export interface ScenarioContext {
  room: TestRoom
  /** Advance the simulation by `seconds` in fixed steps (no rendering needed). */
  step(seconds: number): void
  /** Record a pass/fail line in the log (`channel: 'check'`). */
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
}

export interface ScenarioReport {
  passed: number
  failed: number
  results: Array<{ id: string; name: string; ok: boolean; checks: Array<{ label: string; ok: boolean }> }>
}

export type { DestructionEvent, Vec3 }
export type { RoomPushEvent, RoomPushState } from './furniture-push'
export type {
  AnimationClipSpec,
  ItemAnimationContract,
  DestructibleImpl,
  TestableModule,
  TestableItem,
  ModuleScenario,
} from '@adatechnology/game-contracts'

export type { RoomSeat } from './seating'
