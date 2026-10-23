/**
 * Public types of @adatechnology/game-destruction-bench.
 *
 * A self-contained test area any team can drop into its viewer: a floor with a target wall, shelves and a table, a first-person player
 * (pointer lock, WASD) with an orbit fallback, a catalogue of the host's objects, and tools. The player can spawn objects, grab them, carry,
 * drop and throw them (a thrown or dropped object takes and deals blunt damage), shoot them with real calibres, hit, cut, burn, melt, blow up
 * and take them apart joint by joint, and inspect the state of every part.
 */
import type * as THREE_NS from 'three'
import type {
  DamageType,
  DestructibleSpec,
  DestructionEvent,
  DestructionOptions,
  DestructionWorld,
  ToolKind,
  Vec3,
} from '@adatechnology/game-destruction'
import type { DestructionRenderer, Quality, SpecFromObjectOptions } from '@adatechnology/game-destruction-three'

export type ThreeNamespace = typeof THREE_NS

/** One entry of the catalogue: something the host can build. */
export interface BenchItem {
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
}

/** What a tool does when the player uses it. Real-world numbers are data (`TOOLS`), the host can add its own. */
export type ToolAction =
  | { kind: 'shoot'; energy: number; caliber: number; pellets?: number; spreadDeg?: number; rpm: number; auto?: boolean; range?: number }
  | { kind: 'melee'; damage: Extract<DamageType, 'blunt' | 'slash'>; energy: number; radius: number; reach: number; rpm: number }
  | { kind: 'flame'; temperature: number; radius: number; range: number; cone?: boolean }
  | { kind: 'heat'; temperature: number; radius: number; range: number }
  | { kind: 'throwable'; energy: number; radius: number; fuse: number; fire?: boolean }
  | { kind: 'disassemble'; tool: ToolKind; reach: number }
  | { kind: 'extinguish'; range: number; coolC: number }
  | { kind: 'hand'; reach: number }

export interface BenchTool {
  /** snake_case id; the name comes from the locale table (`tools.<id>`) or `name`. */
  id: string
  name?: string
  /** Hotbar group: `firearm`, `melee`, `fire`, `tool`, `explosive`. */
  category: 'firearm' | 'melee' | 'fire' | 'tool' | 'explosive' | 'hand'
  action: ToolAction
  /** Calibre label shown in the HUD (e.g. `9×19 mm`). */
  label?: string
}

export interface BenchOptions {
  THREE: ThreeNamespace
  /** Element the bench fills (canvas + HUD). */
  container: HTMLElement
  /** `en` (default) or `pt-BR`. */
  locale?: string
  catalog: BenchItem[]
  /** Tools (default `TOOLS`). */
  tools?: BenchTool[]
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
  /** Called for every destruction event (to log, play sounds, sync over LAN). */
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

export interface DestructionBench {
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
  setTool(toolId: string): void
  readonly tool: BenchTool
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
  dispose(): void
}

export type { DestructionEvent, Vec3 }
