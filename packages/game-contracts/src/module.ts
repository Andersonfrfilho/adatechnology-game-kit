import type { AnimationClipSpec } from './animation'
import type { ModuleBench, ModuleControl, ModuleLayer, ModuleMetric } from './bench'
import type { DestructibleSpec, Vec3 } from './destruction'
import type { DestructibleImpl } from './impact'
import type { ContainerSpec } from './fluids'

/** An item that holds a liquid (a cup, a bottle, a fuel tank). `part` is the destruction part that is the container; a hole in it makes it leak. */
export interface ModuleItemFluid {
  container: ContainerSpec
  part?: string
  /** Item uses offered while held (`drink`, `pour`...). */
  uses?: string[]
  offset?: Vec3
}

/** A picture of an item for catalogues and inventories: a hand-made `svg`, or `render` to have the host draw the 3D model (camera angles in radians, `wear` 0 new, 1 worn, 2 ruined). */
export interface Thumbnail {
  svg?: string
  render?: true | { yaw?: number; pitch?: number; distance?: number; wear?: 0 | 1 | 2 }
}

/** One thing a module can put in the test room (or any viewer): a toy car, a chair, a pistol on a table. */
export interface TestableItem {
  /** snake_case id, unique inside the module. */
  id: string
  /** Display name, already translated for the locale passed to `TestableModule.items`. */
  name: string
  /**
   * Builds the 3D object: `THREE` is the host's three.js namespace, the result is its `Object3D` (origin at the centre of the footprint, on the
   * floor, front facing +z). The contracts package does not depend on three.js, so both are `unknown` here; the host narrows them.
   */
  build: (THREE: unknown) => unknown
  /** Destruction spec for the default destruction world. A module that owns its destruction gives `impl` instead (or as well). */
  spec?: DestructibleSpec | ((root: unknown) => DestructibleSpec)
  /** The module's own destruction: parts, hits and state are its business. The world hosts it next to its own objects. `id` is the object id the host gives it: `DestructibleImpl.id` must be that id. */
  impl?: (root: unknown, id: string) => DestructibleImpl
  fluid?: ModuleItemFluid
  /** The item is also a weapon the player can equip: an id of the arsenal in use. */
  weapon?: string
  /** Use animations this item brings (a pistol `reload` moves `mag`; a car door `open` rotates `door_l`). */
  animations?: AnimationClipSpec[]
  /** Can be grabbed and thrown. */
  movable?: boolean
  /** Picture for catalogues and inventories. */
  thumbnail?: Thumbnail
}

/** A scripted check a module brings: the host calls `run` with its own context (the test room passes a `ScenarioContext`). */
export interface ModuleScenario<Context = unknown> {
  id: string
  name: string
  run(context: Context): void | Promise<void>
}

/** Where one item goes when the host sets the module's area up. */
export interface AreaPlacement {
  /** Id of an item of the module. */
  item: string
  /** World position of the item origin (centre of the footprint, on the floor). */
  position: Vec3
  rotationY?: number
  /** Things placed on it rest on its top (a counter, a shelf board): half size on x and z around `position`, and the height of the top. */
  surface?: { halfSize: [number, number]; height: number }
  /** Starts still: no physics until it is grabbed, hit or pushed. For props laid side by side that would otherwise nudge each other off. */
  asleep?: boolean
}

/** How the host sets the module's area up: what goes where, and where the camera starts. */
export interface ModuleArea {
  placements: AreaPlacement[]
  view?: { eye: Vec3; target: Vec3 }
}

/**
 * What the player did with the tool in hand, as the host reports it. Hosts emit what they support; modules ignore what they do not need. The
 * names are of a tool's cycle, not of a firearm: a nail gun, a chainsaw or a hose has modes, faults and a safety too.
 */
export type HostEvent =
  /** The tool is put in hand; `duration` is the seconds the rule takes to ready it (absent: no draw time). */
  | { type: 'tool'; weapon: string; duration?: number }
  /** `shots` are projectiles (a shotgun shell is many), `rounds` the cartridges spent (a burst is several). */
  | { type: 'shot'; weapon: string; shots: number; recoil: [number, number]; rounds?: number; mode?: string }
  /** The trigger was pulled, the round was spent and nothing left the tool (a dud cartridge): no projectile, no recoil. */
  | { type: 'misfire'; weapon: string }
  /** `kind` is how the rule reloads (`tactical`, `empty`, `one_by_one`); `duration` the seconds of the whole reload, on `start`. */
  | { type: 'reload'; weapon: string; phase: 'start' | 'end'; kind?: string; duration?: number }
  | { type: 'empty'; weapon: string }
  | { type: 'mode'; weapon: string; mode: string }
  | { type: 'fault'; weapon: string; fault: string }
  | { type: 'clear'; weapon: string; fault: string; phase: 'start' | 'end'; duration?: number }
  | { type: 'safety'; weapon: string; on: boolean }
  /** The action works between shots (a pump, a bolt); `duration` is the seconds of the cycle, on `start`. */
  | { type: 'cycle'; weapon: string; phase: 'start' | 'end'; duration?: number }
  /** A step of a longer phase (a reload's magazine out, magazine in, charge), at the moment the rule reaches it. */
  | { type: 'stage'; weapon: string; stage: string }
  /** One more round went into the tool while it loads round by round. */
  | { type: 'feed'; weapon: string }
  /**
   * A throwable with a timer fuse is cooked: the trigger pulls the pin (`start`, `fuse` is the whole fuse), releasing throws it with what is left of
   * the fuse (`throw`), and holding past the fuse sets it off in the hand (`burst`, `fuse` 0).
   */
  | { type: 'cook'; weapon: string; phase: 'start' | 'throw' | 'burst'; fuse: number }
  /** Something blew up: a thrown or launched explosive, a charge, or a part of the world (a fuel barrel); `source` is the weapon or the object, `cause` what set it off. */
  | { type: 'explosion'; source: string; point: Vec3; energy: number; radius: number; cause: string }

/** The tool in hand as the host sees it. */
export interface HostTool {
  weapon: string
  category: string
  ammo: number
  capacity: number
  reserve: number
  reloading: boolean
  mode?: string
  /** The fault the tool is stuck with, if any. */
  fault?: string
  safety?: boolean
  /** 0..1 */
  heat?: number
}

/**
 * What the host lends a module that brings its own presentation (a weapon in the hands, sounds, ejected casings). `THREE`, `scene` and `camera`
 * are the host's three.js namespace, scene and camera: `unknown` here because the contracts do not depend on three.js.
 */
export interface ModuleHost {
  THREE: unknown
  scene: unknown
  camera: unknown
  locale: string
  /** Height of whatever things rest on at (x, z): the floor, a table, a counter. */
  groundAt(x: number, z: number): number
  tool(): HostTool
  /** Follow the player's tool events. Returns the unsubscribe function. */
  on(listener: (event: HostEvent) => void): () => void
  /** Run every simulated frame with the frame's seconds. Returns the unsubscribe function. */
  onFrame(update: (dt: number) => void): () => void
  /** Write a line to the host's behaviour log. */
  log(text: string, data?: Record<string, unknown>): void
  /**
   * Sets what the host lets a module tune on its tools, keyed by the id of the module's own control (`ModuleControl.id`) with the id of the option as the value; the tool in hand changes at once and the
   * ones taken later start that way. A host applies the ids it knows and ignores the rest. The test room knows `condition` (how worn the tools are) and `ammo_quality` (how good what they load is).
   */
  configureTool?(settings: Readonly<Record<string, string>>): void
  /** Lent only to a module that declares controls, layers or metrics. */
  bench?: ModuleBench
}

/** What a module hands the test room: its items and, optionally, scenarios that exercise them, its area and its own presentation. */
export interface TestableModule<Context = unknown> {
  /** snake_case id of the module. */
  id: string
  name: string
  /** Catalogue tab the items go under. */
  group: string
  items(locale: string): TestableItem[]
  scenarios?(locale: string): Array<ModuleScenario<Context>>
  /** How to set the area up when the host opens the module's group. Without it the host lays the items in rows. */
  area?(locale: string): ModuleArea
  /** The bench: what the viewer can set (controls), turn on or off (layers) and watch (metrics). Names already translated for `locale`. */
  controls?(locale: string): ModuleControl[]
  layers?(locale: string): ModuleLayer[]
  metrics?(locale: string): ModuleMetric[]
  /** Called once when the module is loaded, with what the host lends. Returns the function that undoes it. */
  attach?(host: ModuleHost): () => void
}
