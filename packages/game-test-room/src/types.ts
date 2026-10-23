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
import type {
  DamageType,
  DestructibleSpec,
  DestructionEvent,
  DestructionOptions,
  DestructionWorld,
  
  Vec3,
} from '@adatechnology/game-destruction'
import type { DestructionRenderer, Quality, SpecFromObjectOptions } from '@adatechnology/game-destruction-three'
import type { Arsenal, WeaponDef, WeaponState } from '@adatechnology/game-weapons'
import type { ContainerSpec, FluidWorld, ItemUseDef, LiquidDef, SurfaceSpec } from '@adatechnology/game-fluids'

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
  /** Heaviest object the player can carry (default 60 kg). */
  maxCarryKg?: number
  /** Arena half size in metres (default 14). */
  arenaSize?: number
  /** Spawn these catalogue ids on start, in a row in front of the player. */
  initial?: string[]
  /** Called for every destruction event (to log, play sounds, sync over LAN). Fluid events reach the log too. */
  onEvent?: (event: DestructionEvent) => void
  onSound?: (key: string, point: Vec3, volume: number) => void
  /** Show the built-in HUD and panels (default true). */
  ui?: boolean
}

export interface SpawnedObject {
  objectId: string
  itemId: string
  root: THREE_NS.Object3D
  movable: boolean
}

export interface TestRoom {
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
  spawned(): SpawnedObject[]
  /** Advance one frame (only needed when the host owns the loop). */
  update(dt: number): void
  on(type: 'spawn' | 'tool' | 'grab' | 'throw' | 'event', fn: (data: unknown) => void): () => void
  /** The behaviour log (see `TestRoomLog`). */
  readonly log: TestRoomLog
  /** Run scripted checks (no input needed; works headless in tests and from the browser console). */
  runScenarios(scenarios?: TestRoomScenario[]): Promise<ScenarioReport>
  dispose(): void
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
  /** Download the log as a file in the browser (`.ndjson` by default). */
  download(format?: 'json' | 'ndjson' | 'txt'): void
  /** Counts per event type and per material (quick summary for checks). */
  summary(): { byType: Record<string, number>; byMaterial: Record<string, number>; objects: number; destroyed: number }
  on(fn: (entry: LogEntry) => void): () => void
}

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
