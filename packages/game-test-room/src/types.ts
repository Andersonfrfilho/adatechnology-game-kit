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
import type { DestructionRenderer, Quality, SpecFromObjectOptions } from '@adatechnology/game-destruction-three'
import type { Arsenal, WeaponDef, WeaponState } from '@adatechnology/game-weapons'
import type { VfxWorld } from '@adatechnology/game-vfx'
import type { FilmBridge, FluidRenderer } from '@adatechnology/game-fluids-three'
import type { ContainerSpec, FluidWorld, ItemUseDef, LiquidDef, SurfaceSpec } from '@adatechnology/game-fluids'
import type { AnimationClipSpec, ControlValue, DestructibleImpl, EnvironmentBus, ModuleControl, ModuleLayer, TestableModule } from '@adatechnology/game-contracts'

export type { InspectInfo } from './ui'
import type { InspectInfo } from './ui'
export type { RoomAvatar, RoomAvatarState, CameraMode, ThirdPersonOptions } from './avatar'
import type { CameraMode, RoomAvatar, RoomAvatarState, ThirdPersonOptions } from './avatar'

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
  /** Short note shown in the inspector. */
  note?: string
  /**
   * The item holds a liquid (a cup of coffee, a bottle, a jerrycan, a fuel tank). `part` is the destruction part that is the container (a
   * bullet hole in it makes it leak). `uses` are the item uses offered while it is held (`drink`, `pour`...; defaults from `ITEM_USES`).
   */
  fluid?: { container: ContainerSpec; part?: string; uses?: string[]; offset?: Vec3 }
  /** The item is also a weapon the player can equip from the catalogue (e.g. a crowbar, a knife, a pistol on the table). */
  weapon?: string
  /**
   * The item's own destruction (a `DestructibleImpl` of a game module). The room registers it in the world (`world.register`) instead of
   * building a default object from `spec`; `id` is the object id the room gives it and `DestructibleImpl.id` must be that id. Impl items are not movable.
   */
  impl?: (root: THREE_NS.Object3D, id: string) => DestructibleImpl
  /** Use animations the item brings (see `TestRoom.playAnimation`). Part poses move the child of the built object named after the part id. */
  animations?: AnimationClipSpec[]
  /** Picture for the catalogue, the search results and the aimed-item label: an image URL or inline `<svg…>` markup (see `TestableItem.thumbnail`). */
  thumbnail?: string
  /** Author and licence of the thumbnail, shown as the tooltip of the picture in the inspector. */
  thumbnailCredit?: string
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
  /** Replaces the arena floor with a deformable patch (60 m, 33 cm cells) that the craters of big explosions dig into. Default false. */
  craters?: boolean
  /** Heaviest object the player can carry (default 60 kg). */
  maxCarryKg?: number
  /** Arena half size in metres (default 14). */
  arenaSize?: number
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
  /** The over-the-shoulder view of the `third` mode: distance, shoulder, height, wall probes. Defaults are the team game's. */
  thirdPerson?: ThirdPersonOptions
  /** Room counters the bench panel shows and `TestRoom.metrics()` returns (default all); `false` for none. */
  metrics?: readonly RoomMetricId[] | false
  /** Blast options every explosion of the room starts with (`shelter`, `fragmentHits`, `confinement`; default all off). The HUD toggles them and `TestRoom.setBlast` changes them. */
  blast?: BlastOptions
  /**
   * Module bench state. `state` maps a module id to its encoded state, restored when that module is first loaded (a module reloaded
   * keeps its live state instead) before its first changes are sent; ids are per module, so two modules may share a control id.
   * `onChange` gets the encoded state of a module whenever it changes (a page keeps it in its URL). The room never touches `location`.
   */
  bench?: { readonly state?: Readonly<Record<string, string>>; readonly onChange?: (moduleId: string, encoded: string) => void }
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
  /** Use the current tool once from the camera (tests and scripted demos). `hold` seconds for continuous tools. */
  use(hold?: number): void
  /** Grab what the camera looks at (or drop what is held). */
  grab(): boolean
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
  /** Equip a weapon by id, adding it to the hotbar when it is not there. Same as selecting a catalogue item with `TestRoomItem.weapon`. */
  equip(weaponId: string): void
  /**
   * Set the room up to test one catalogue group or loaded module (by its group or id): clear it and open the catalogue on that tab. A module
   * that brings an `area` is laid out by it; any other group is laid in rows (small items in front, fixed big ones behind). Unknown: nothing.
   */
  openArea(group: string): SpawnedObject[]
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
  /** Compiles the shader programs that the first hit, decal or effect would otherwise compile in the middle of a frame. Call it once the lights of the scene are set (a module that adds lights changes the programs). */
  warmUp(): void
  /** Animations of the aimed (or held) item: what the animations panel shows. */
  animations(): AnimationInfo | null
  /**
   * Play an animation clip of an item (default the held, else the aimed one). Returns false when there is no such item or clip. Poses are
   * offsets from the rest pose, interpolated linearly; the item keeps the last pose. Events are logged (and `sound` events reach `onSound`).
   */
  playAnimation(clipId: string, objectId?: string): boolean
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
export type {
  AnimationClipSpec,
  ItemAnimationContract,
  DestructibleImpl,
  TestableModule,
  TestableItem,
  ModuleScenario,
} from '@adatechnology/game-contracts'
