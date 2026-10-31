import type { AnimationClipSpec } from './animation'
import type { AudioSink } from './audio'
import type { BlastShoveOptions } from './blast-shove'
import type { BusySink } from './busy'
import type { ModuleBench, ModuleControl, ModuleLayer, ModuleMetric } from './bench'
import type { DestructibleSpec, Vec3 } from './destruction'
import type { DestructibleImpl } from './impact'
import type { EnvironmentBus } from './environment'
import type { EffectSink } from './effects'
import type { HandPose, HandTargetSource } from './hands'
import type { ContainerSpec } from './fluids'
import type { SealSpec } from './seal'

/** An item that holds a liquid (a cup, a bottle, a fuel tank). `part` is the destruction part that is the container; a hole in it makes it leak. */
export interface ModuleItemFluid {
  container: ContainerSpec
  part?: string
  /** Item uses offered while held (`drink`, `pour`...). */
  uses?: string[]
  offset?: Vec3
}

/** A closed container the player opens before eating or drinking it (a food tin, a drink can): the seal, and how the item looks open. */
export interface ModuleItemSeal extends SealSpec {
  /** Draws the item opened: gets the root `build` returned (the cut lid of a tin, the mouth of a can). */
  open?: (root: unknown) => void
  /** Shows what is left in it once open: `share` of what it held (0 eaten up), after each bite or sip. */
  contents?: (root: unknown, share: number) => void
}

/** A place on an item where a body sits or lies (a chair, a sofa cushion, a bed), in the item's own frame, the same shape as a `game-interactables` seat. */
export interface ItemSeat {
  id: string
  pose: 'sit' | 'lie'
  /** Hips (sit) or pelvis (lie). */
  pos: Vec3
  /** Facing of the body, relative to the item. */
  ry: number
  /** Eye height above `pos`. Default 0.62 sitting, 0.18 lying. */
  eye?: number
  /** Where the body stands when it gets up. */
  exit: Vec3
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
  /** The item is a sealed container: it is opened first (with a tool or by hand), and a breach may spoil it (`SealSpec`). */
  seal?: ModuleItemSeal
  /** The item is also a weapon the player can equip: an id of the arsenal in use. */
  weapon?: string
  /** Use animations this item brings (a pistol `reload` moves `mag`; a car door `open` rotates `door_l`). */
  animations?: AnimationClipSpec[]
  /** Can be grabbed and thrown. */
  movable?: boolean
  /** A big piece that stands on the floor (a sofa, a wardrobe, a fridge) and can be pushed by leaning on it. Default false: what goes in the hand is grabbed, never pushed. */
  pushable?: boolean
  /** Where a body sits or lies on it: the host can seat the player there. */
  seats?: readonly ItemSeat[]
  /** Building it takes a noticeable time (a vehicle, a district): the host's catalogue shows its loading indicator while it spawns one. `true`, or the text to show. */
  slow?: boolean | string
  /**
   * A picture of the item for menus, search results and the label of the aimed item: the URL of an image (an SVG silhouette is drawn in the text colour, so give it one colour with
   * the tones as opacity) or the SVG markup itself (starts with `<svg`). Optional: an item without one shows its name only.
   * The room draws it as a CSS mask, so a URL on another origin needs CORS headers (or must be same-origin), and the host must trust the URL: it is loaded as given, not sanitized.
   */
  thumbnail?: string
  /** Author and licence of the thumbnail, shown as the tooltip of the picture in the inspector (e.g. `Skoll, CC BY 3.0`). */
  thumbnailCredit?: string
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

/** A rectangle of the floor made of something else: `rect` is `[x0, z0, x1, z1]` in world metres, `surface` a ground profile id of the host. */
export interface GroundZone {
  readonly rect: readonly [number, number, number, number]
  readonly surface: string
}

/** What the floor is made of. `surface` is a ground profile id (`lawn`, `road`, `concrete_slab`, `tile_floor`...); a host that does not know it uses its default. */
export interface GroundLayout {
  readonly surface: string
  /** Later zones over earlier ones. */
  readonly zones?: readonly GroundZone[]
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
  | {
      type: 'shot'
      weapon: string
      shots: number
      recoil: [number, number]
      rounds?: number
      mode?: string
      suppressed?: boolean
      /**
       * Where the muzzle is in the world and where it points, for a shot the viewer sees from outside (another player, the third-person camera). A module
       * then shows the shooter's flash and casing through `host.effects`. Absent for the player's own shot, which the weapon in the hands already draws.
       */
      origin?: Vec3
      direction?: Vec3
    }
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
  /** An accessory went on (`fit`), came off (`remove`) or broke (`break`) at `mount`; `duration` is the seconds the work takes, on `fit` and `remove`. */
  | { type: 'attachment'; weapon: string; action: 'fit' | 'remove' | 'break'; attachment: string; mount: string; duration?: number }
  /** A light or a laser was turned on or off. */
  | { type: 'toggle'; weapon: string; attachment: string; on: boolean }
  /** The stock was folded or slid in (`collapsed`) or opened (`extended`); `kind` is how it moves (`fold`, `retract`), `duration` the seconds it takes. */
  | { type: 'stock'; weapon: string; state: 'collapsed' | 'extended'; kind?: string; duration?: number }
  /** The weapon in hand changed between the main weapon and the one under its barrel (`on`: the under-barrel one is in use); `duration` is the seconds of the switch. */
  | { type: 'underbarrel'; weapon: string; on: boolean; duration?: number }
  /**
   * Something blew up: a thrown or launched explosive, a charge, or a part of the world (a fuel barrel); `source` is the weapon or the object, `cause` what set it off.
   * `explosive` is the id of the explosive when there is one (`m67`, `c4`, `fuel_barrel`): the host picks the blast by it.
   */
  | { type: 'explosion'; source: string; point: Vec3; energy: number; radius: number; cause: string; explosive?: string }
  /** The player crouched or stood up, or the camera mode changed; read the new state with `host.player()`. */
  | { type: 'player' }

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
  /** What is on the tool (factory parts included): the accessory, where it sits, and whether a light or laser is on. */
  attachments?: readonly HostToolAttachment[]
  /** Where the stock is, for a tool with one that folds or slides. */
  stock?: 'collapsed' | 'extended'
  /** True while a suppressor is on: the shot sound is the muffled one. */
  suppressed?: boolean
  /** True while the trigger and the reload go to the launcher under the barrel. */
  underbarrelActive?: boolean
  /** Kg: the tool with what is on it. */
  mass?: number
  /** Seconds to bring the tool to the sights, with what is on it. */
  aimSeconds?: number
}

export interface HostToolAttachment {
  readonly id: string
  readonly mount: string
  readonly integral?: boolean
  readonly on?: boolean
}

/** What a module asks of the tool in hand (accessories, stock, the launcher under the barrel, how it is held). The work takes the seconds the rule gives it and shows as host events. */
export type ToolCommand =
  | { readonly type: 'fit'; readonly attachment: string; readonly mount?: string }
  | { readonly type: 'remove'; readonly attachment: string }
  | { readonly type: 'toggle'; readonly attachment: string }
  | { readonly type: 'stock'; readonly state: 'collapsed' | 'extended' }
  | { readonly type: 'underbarrel'; readonly on: boolean }
  | { readonly type: 'stance'; readonly aiming?: boolean; readonly supported?: boolean }

/** `ok`, or why nothing happened (the rule's refusal: `no_mount`, `interface`, `occupied`, `busy`...); `seconds` is how long the work takes. */
export interface ToolCommandResult {
  readonly ok: boolean
  readonly reason?: string
  readonly seconds?: number
}

/** The player as the host sees it. Generic: any game with someone walking around in a world has these. */
export interface PlayerState {
  /** World position of the player's feet, metres. */
  readonly position: Vec3
  /** Radians around the vertical axis; 0 looks down -z. */
  readonly yaw: number
  /** Radians up (positive) or down (negative). */
  readonly pitch: number
  readonly crouching: boolean
  /** Horizontal speed in metres per second. */
  readonly speed: number
  readonly running: boolean
  /** How the camera follows the player (`first`, `shoulder`...); the ids are the host's. */
  readonly cameraMode: string
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
  /** The player now: where, which way, crouching, how fast and how the camera follows. A `player` event tells when crouching or the camera mode changes. */
  player(): PlayerState
  /** Follow the player's tool events. Returns the unsubscribe function. */
  on(listener: (event: HostEvent) => void): () => void
  /** Run every simulated frame with the frame's seconds. Returns the unsubscribe function. */
  onFrame(update: (dt: number) => void): () => void
  /**
   * Follow the host clearing its area (`clear()`, opening an area, running scenarios): everything the module put in the world on its own (not as items) is to be taken away or put back. Returns the
   * unsubscribe function. A host that never clears leaves it out.
   */
  onClear?(listener: () => void): () => void
  /** Write a line to the host's behaviour log; `type` is the kind of entry (default `module_note`), so a module can log what a filter looks for (`sound`). */
  log(text: string, data?: Record<string, unknown>, type?: string): void
  /**
   * Sets what the host lets a module tune on its tools, keyed by the id of the module's own control (`ModuleControl.id`) with the id of the option as the value; the tool in hand changes at once and the
   * ones taken later start that way. A host applies the ids it knows and ignores the rest. The test room knows `condition` (how worn the tools are) and `ammo_quality` (how good what they load is).
   */
  configureTool?(settings: Readonly<Record<string, string>>): void
  /**
   * Adds a place the walking player cannot enter: `blocked(x, z, radius)` answers for a disc of the player's `radius` centred on the world point (x, z). A module with walls of its own (a house) uses it so the
   * player stops at them; the function is asked on every step, so it may follow a door that opens. Returns the function that takes it away. A host without a walking player leaves it out.
   */
  addBlocker?(blocked: (x: number, z: number, radius: number) => boolean): () => void
  /**
   * Puts an item of the host's catalogue (from any loaded module, by its id) in the world as part of the scenery: it stays through the clears and the openings of areas, and shots, blows, blasts
   * and fire hit it like any item (a module's lamp rig standing on a real car of the fleet). Scenarios that start from a seeded world run without it, and it comes back after them. `rotationY` turns it about the vertical axis. Returns null while no loaded module has the item; `remove`
   * takes it away. A host without a catalogue leaves it out.
   */
  addObject?(itemId: string, place: { readonly position: Vec3; readonly rotationY?: number }): { readonly objectId: string; readonly root: unknown; remove(): void } | null
  /**
   * Lends the host the place of the hands for the tool in the module's hands (a weapon's grip and handguard): the host that draws the player's arms reads `source` every frame, after the
   * frame hooks have run, and puts the hands there. Pass null (or call the returned function) to let go. A host without arms leaves it out.
   */
  setHandTargets?(source: HandTargetSource | null): () => void
  /**
   * Where the player's body holds a tool now (world space), for a view that shows the body (third person): `position` is the pocket of the right shoulder a stock rests on, `quaternion` turns
   * to the aim (-z the aim, x right, y up, as a camera). A module draws the tool there at its real size, instead of in front of the eye. Null while the view draws the tool in front of
   * the eye (first person); a host without a body leaves it out.
   */
  holdFrame?(): HandPose | null
  /** Asks the tool in hand to do something (see `ToolCommand`). A host without accessories leaves it out. */
  command?(command: ToolCommand): ToolCommandResult
  /** Lent only to a module that declares controls, layers or metrics. */
  bench?: ModuleBench
  /** The host's shared sound engine; a module that makes sound uses it when lent and stays silent (or brings its own) when not. */
  audio?: AudioSink
  /** The host's weather, light and ground; a module that reacts to rain, wind or night reads it. */
  environment?: EnvironmentBus
  /** The host's effects (smoke, sparks, blast, impacts): a module asks for them by id instead of drawing its own. Absent when the host has none. */
  effects?: EffectSink
  /**
   * The numbers of the shove a blast gives to a body. A module that moves bodies of its own (people, vehicles) answers the `explosion` host event with `blastShove(event, body, host.blastShove)`
   * so that it throws things the way the host throws its loose items. Absent when the host keeps the defaults.
   */
  blastShove?: BlastShoveOptions
  /** The host's loading indicator: a module with a slow job of its own (building a house, laying a district) shows it through this instead of freezing the page. Absent when the host has none. */
  loading?: BusySink
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
  /** The floor of the module's area, laid when the host opens it. Without it the host keeps its default floor. */
  ground?: GroundLayout
  /** Called once when the module is loaded, with what the host lends. Returns the function that undoes it. */
  attach?(host: ModuleHost): () => void
}
