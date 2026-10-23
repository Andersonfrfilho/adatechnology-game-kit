/**
 * Public types of @adatechnology/game-destruction.
 *
 * The model is renderer-free. An object is an assembly of parts (simple shapes with a material) held together by joints. Materials decide what a
 * hit does: ductile parts dent and get holes, brittle parts crack and shatter, wood splinters, masonry crumbles, flammable parts ignite, char and
 * turn to ash, fusible parts melt and drip. Joints break under impulse or when their parts are destroyed (the object breaks apart), or are undone
 * with the right tool (the object is taken apart). The world reports everything as events that a renderer draws.
 *
 * Units: metres, kilograms, seconds, joules, degrees Celsius. Every random choice comes from the world seed, so the same inputs give the same
 * events on every machine (a LAN host can run the world and send only the inputs, or the events).
 */

export type Vec3 = [number, number, number]
/** Quaternion `[x, y, z, w]`. */
export type Quat = [number, number, number, number]

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** snake_case material id, e.g. `steel`, `wood_soft`, `glass`, `concrete`. Part of the saved data contract. */
export type MaterialId = string

/** How a part comes apart when it fails. */
export type FractureStyle =
  /** glass, ceramic: sharp flat shards radiating from the impact */
  | 'shatter'
  /** concrete, brick, plaster: many small chunks plus dust */
  | 'crumble'
  /** wood: long splinters along the grain (`grain` axis of the part) */
  | 'splinter'
  /** fabric, leather, foliage, paper: torn into flat scraps */
  | 'tear'
  /** plastic, hard wood boards: a few large pieces */
  | 'snap'
  /** metal: never fractures; it dents, bends, gets holes and melts */
  | 'none'

/** Debris the renderer should emit for an event. */
export type DebrisKind = 'sparks' | 'splinters' | 'dust' | 'shards' | 'fibers' | 'leaves' | 'drips' | 'ash' | 'chips' | 'smoke' | 'steam'

export interface MaterialThermal {
  /** Temperature at which the part catches fire. Omit for non-flammable. */
  ignitionC?: number
  /** Flame temperature while burning (default 800). */
  flameC?: number
  /** Fraction of the part's mass that can burn, 0..1 (wood 0.9, fabric 1, plastic 0.8). */
  fuelFraction?: number
  /** Burn speed in kg per second per square metre of surface (wood ~0.012, fabric ~0.05, foliage ~0.08). */
  burnRate?: number
  /** Temperature at which the part starts to melt. Omit for materials that do not melt in game (wood, fabric). */
  meltC?: number
  /** Melt speed: fraction of the part per second per 100 °C above `meltC` (default 0.05). */
  meltRate?: number
  /** Heat transfer to touching parts, 0..1 (copper 1, steel 0.5, wood 0.05). */
  conductivity: number
  /** Temperature change per second per unit of heat input; lower means it heats and cools faster (default 1). */
  heatCapacity?: number
  /** Brittle parts crack when their temperature changes faster than this many °C per second (glass ~150). */
  thermalShockC?: number
  /** Smoke the material gives while burning (`black` for plastic and rubber). */
  smoke?: 'white' | 'grey' | 'black'
}

export interface MaterialDef {
  id: MaterialId
  /** Density in kg/m³ (used when a part has no `mass`). */
  density: number
  /** Structural hit points per kilogram. */
  hpPerKg: number
  /**
   * Energy in joules a projectile needs to go through 1 mm of this material. A projectile that carries more than `penetration * thicknessMm` goes
   * through and keeps the rest; one that carries less stops (dent, crack or lodge).
   */
  penetration: number
  /** 0 = brittle (glass), 1 = very ductile (soft steel). Ductile parts dent and bend before they break; brittle parts crack and shatter. */
  ductility: number
  /** How the part fails when its hp reaches 0. */
  fracture: FractureStyle
  /** Fragment size range in metres (default `[0.04, 0.2]`). */
  fragmentSize?: [number, number]
  /** Damage multipliers per damage type (default 1). */
  damageScale?: Partial<Record<DamageType, number>>
  /** Debris emitted on a hit that does not break the part. */
  hitDebris: DebrisKind
  /** Debris emitted when the part fractures. */
  breakDebris: DebrisKind
  /** A ballistic hit at a grazing angle (below this many degrees from the surface) ricochets; 0 = never (default 0). */
  ricochetDeg?: number
  thermal: MaterialThermal
  /** Hints for the renderer. Colours are `0xRRGGBB`. */
  visual?: {
    /** Colour a fully charred surface turns to (default 0x1a1410). */
    charColor?: number
    /** The material glows red to white when hot (metals, glass). */
    glows?: boolean
    /** Transparent (glass): cracks are drawn as a star on the surface. */
    transparent?: boolean
  }
  /** Free tags, e.g. `metal`, `organic`, `conductive`. */
  tags?: string[]
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Objects: parts and joints
// ---------------------------------------------------------------------------------------------------------------------------------------------

export type PartShape =
  | { kind: 'box'; size: Vec3 }
  | { kind: 'cylinder'; radius: number; height: number }
  | { kind: 'sphere'; radius: number }

export type FluidKind = 'water' | 'fuel' | 'oil' | 'gas' | 'sap' | 'acid' | 'blood' | string

export interface PartSpec {
  /** Unique inside the object. */
  id: string
  material: MaterialId
  /** Shape in object-local space, centred on `position`. Cylinders are along local +Y. */
  shape: PartShape
  position: Vec3
  /** Euler angles in radians, order XYZ (default none). */
  rotation?: Vec3
  /** Mass in kg (default density × volume × `fill`). */
  mass?: number
  /** Solid fraction of the shape, 0..1 (default 1). A hollow sheet-metal box is ~0.03, a drawer 0.1. */
  fill?: number
  /** Wall thickness in metres for penetration (default: smallest dimension of the shape × `fill`, at most the smallest dimension). */
  thickness?: number
  /** Hit points override (default mass × material.hpPerKg). */
  hp?: number
  /** Axis of the grain for `splinter` materials, in local space (default the longest axis). */
  grain?: 'x' | 'y' | 'z'
  /** Fluid inside the part; punctures make it leak (a `leak` event per hole, the level drops in `update`). */
  contains?: { fluid: FluidKind; liters: number; pressurized?: boolean }
  /** The part explodes when destroyed, or when its temperature passes `atC` (gas bottle, fuel tank, aerosol). */
  explodes?: { energy: number; radius: number; atC?: number }
  /** Fixed to the world (a wall-mounted cabinet, a tree trunk in the ground). Groups that keep an anchored part stay in place. */
  anchored?: boolean
  /** Free tags the host can use (`door`, `wheel`, `screen`, `trunk`, `leaf`...). */
  tags?: string[]
}

/** How two parts are attached. Decides the default strength and the tool that undoes it. */
export type JointKind = 'screw' | 'bolt' | 'nail' | 'weld' | 'glue' | 'hinge' | 'clip' | 'tie' | 'mortar' | 'fused' | 'stem'

/** A tool that can undo joints (`hand` means no tool). */
export type ToolKind = 'hand' | 'screwdriver' | 'wrench' | 'pry_bar' | 'saw' | 'cutting_torch' | 'knife' | 'hammer'

export interface JointSpec {
  /** Unique inside the object (default `${a}~${b}`). */
  id?: string
  a: string
  b: string
  kind: JointKind
  /** Joint hit points (default from `JOINT_DEFAULTS[kind].strength`). Impulses and hits next to the joint wear it down. */
  strength?: number
  /** Tools that undo it (default from `JOINT_DEFAULTS[kind].tools`). An empty list means it can only be broken. */
  tools?: ToolKind[]
  /** Seconds of tool work to undo it (default from `JOINT_DEFAULTS[kind].seconds`). */
  seconds?: number
}

export interface DestructibleSpec {
  /** Display name (free text; translated by the host). */
  name?: string
  parts: PartSpec[]
  /**
   * Joints. When omitted, `inferJoints` is used: touching parts are joined with the kind that fits their materials
   * (see `JOINT_BY_MATERIALS`).
   */
  joints?: JointSpec[]
  /** Free tags (`furniture`, `vehicle`, `plant`, `structure`, `weapon`, `item`...). */
  tags?: string[]
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Damage input
// ---------------------------------------------------------------------------------------------------------------------------------------------

export type DamageType =
  /** bullets and pellets: `energy`, `caliber`; makes holes, dents, cracks, ricochets */
  | 'ballistic'
  /** hammers, falls, thrown objects, vehicle impacts: `energy`, `radius` of contact */
  | 'blunt'
  /** axes, knives, machetes: `energy`; cuts and splinters, opens fabric */
  | 'slash'
  /** blasts: `energy`, `radius`; damage and impulse fall off with distance, joints break, fragments fly */
  | 'explosive'
  /** open flame (lighter, molotov, flamethrower): `temperature`, `radius`, `duration`; ignites */
  | 'fire'
  /** heat without flame (cutting torch, hot plate): `temperature`, `radius`, `duration`; heats and melts */
  | 'heat'

export interface Hit {
  type: DamageType
  /** Point of the hit (world space unless `space: 'local'`). For `explosive` it is the centre of the blast. */
  point: Vec3
  /** Direction the hit travels in (ballistic, blunt, slash). */
  direction?: Vec3
  /** Kinetic or blast energy in joules. */
  energy?: number
  /** Bullet diameter in millimetres (hole size). */
  caliber?: number
  /** Radius of effect in metres (blast radius, flame radius, blunt contact radius). */
  radius?: number
  /** Source temperature for `fire` and `heat`. */
  temperature?: number
  /** Seconds the heat is applied for (a flamethrower calls `hit` every frame with `duration: dt`). */
  duration?: number
  /** `world` (default) or `local` to the object. */
  space?: 'world' | 'local'
  /** Who caused it (passed through to events). */
  source?: string
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------------------------------------------------------

export type PartStatus =
  | 'intact'
  | 'damaged'
  /** hp reached 0; the part fractured into fragments (it no longer exists as one piece) */
  | 'broken'
  /** melted into a puddle */
  | 'melted'
  /** burned to ash */
  | 'ashes'

/** A dent in local space of the part's object. */
export interface Dent {
  point: Vec3
  normal: Vec3
  radius: number
  depth: number
}

export interface Hole {
  point: Vec3
  normal: Vec3
  diameter: number
  /** The projectile went through. */
  through: boolean
}

export interface Crack {
  point: Vec3
  normal: Vec3
  /** Length of the longest crack line in metres. */
  length: number
  /** Number of radial lines. */
  rays: number
}

export interface PartState {
  id: string
  material: MaterialId
  status: PartStatus
  hp: number
  maxHp: number
  /** Current mass (burning and melting reduce it). */
  mass: number
  temperature: number
  burning: boolean
  /** Burnable mass left, kg. */
  fuel: number
  /** 0..1, how charred the surface is. */
  char: number
  /** 0..1, how much of the part has melted. */
  melt: number
  dents: Dent[]
  holes: Hole[]
  cracks: Crack[]
  /** Fluid left, when the part `contains` one. */
  liters?: number
  /** Index into `ObjectState.groups` of the piece this part belongs to. */
  group: number
}

export interface JointState {
  id: string
  a: string
  b: string
  kind: JointKind
  hp: number
  maxHp: number
  /** 0..1 of tool work done towards undoing it. */
  progress: number
  /** Broken or undone. */
  open: boolean
  /** How it opened. */
  openedBy?: 'break' | 'tool' | 'part_lost'
}

export interface ObjectState {
  id: string
  name?: string
  position: Vec3
  rotation: Quat
  parts: PartState[]
  joints: JointState[]
  /**
   * Pieces: connected components of remaining parts over closed joints. Index 0 is the piece that keeps the object's id (the one with an
   * anchored part, else the heaviest). The others are loose pieces the renderer should make into separate bodies.
   */
  groups: string[][]
  /** Every part is broken, melted or ash. */
  destroyed: boolean
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** A fragment for the renderer: an oriented box (or shard) with initial motion. Coordinates in world space. */
export interface Fragment {
  id: string
  part: string
  material: MaterialId
  shape: 'chunk' | 'shard' | 'splinter' | 'scrap' | 'slab'
  center: Vec3
  /** Full size of the fragment box. Shards are thin (`size[2]` is the thickness), splinters long along x. */
  size: Vec3
  rotation: Quat
  velocity: Vec3
  angularVelocity: Vec3
  mass: number
}

interface EventBase {
  object: string
  /** Seconds since the world was created. */
  time: number
  source?: string
}

/** Points in events are in world space. */
export type DestructionEvent =
  | (EventBase & { type: 'damage'; part: string; amount: number; hp: number; damageType: DamageType })
  | (EventBase & { type: 'dent'; part: string; dent: Dent; worldPoint: Vec3 })
  | (EventBase & { type: 'hole'; part: string; hole: Hole; worldPoint: Vec3; exitPoint?: Vec3 })
  | (EventBase & { type: 'crack'; part: string; crack: Crack; worldPoint: Vec3 })
  | (EventBase & { type: 'ricochet'; part: string; point: Vec3; direction: Vec3; energy: number })
  | (EventBase & { type: 'debris'; part: string; kind: DebrisKind; point: Vec3; normal: Vec3; count: number; speed: number })
  | (EventBase & { type: 'fracture'; part: string; style: FractureStyle; fragments: Fragment[]; point: Vec3 })
  | (EventBase & { type: 'detach'; joint: string; parts: [string, string]; by: 'break' | 'tool' | 'part_lost'; groups: string[][] })
  | (EventBase & { type: 'disassemble_progress'; joint: string; tool: ToolKind; progress: number })
  | (EventBase & { type: 'ignite'; part: string; point: Vec3 })
  | (EventBase & { type: 'extinguish'; part: string })
  | (EventBase & { type: 'burnout'; part: string; point: Vec3 })
  | (EventBase & { type: 'melt'; part: string; melt: number })
  | (EventBase & { type: 'drip'; part: string; point: Vec3; material: MaterialId })
  | (EventBase & { type: 'leak'; part: string; fluid: FluidKind; point: Vec3; direction: Vec3; rate: number; pressurized: boolean })
  | (EventBase & { type: 'explode'; part: string; point: Vec3; energy: number; radius: number })
  | (EventBase & { type: 'destroyed' })

export type DestructionEventType = DestructionEvent['type']

/** What a single `hit` did. */
export interface HitResult {
  object: string
  /** First part the hit landed on, if any. */
  part?: string
  /** World point where it landed. */
  point?: Vec3
  /** Damage dealt in total (all parts). */
  damage: number
  /** Ballistic: the projectile came out the other side with `exitEnergy` left. */
  penetrated: boolean
  exitEnergy: number
  events: DestructionEvent[]
}

export interface RayHit {
  object: string
  part: string
  point: Vec3
  normal: Vec3
  distance: number
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------------------------------------------------------------------

export interface DestructionOptions {
  /** Extra or overriding materials (merged over `MATERIALS` by id). */
  materials?: MaterialDef[]
  /** Seed for every random choice (default 1). */
  seed?: number
  /** Ambient temperature (default 20). */
  ambientC?: number
  /** Called for every event, in order. */
  onEvent?: (event: DestructionEvent) => void
  /** Maximum fragments in one `fracture` event (default 24). The renderer can draw fewer. */
  maxFragments?: number
  /** Maximum dents kept per part; older nearby dents merge (default 24). */
  maxDents?: number
  /** Maximum holes kept per part (default 32). */
  maxHoles?: number
  /** Distance at which a burning part heats parts of other objects, in metres (default 0.6). */
  fireSpread?: number
}

export interface AddOptions {
  /** Object id (default a generated `obj_1`, `obj_2`...). */
  id?: string
  position?: Vec3
  rotation?: Quat
}

export interface DestructionWorld {
  readonly materials: ReadonlyMap<MaterialId, MaterialDef>
  /** Add an object and return its id. */
  add(spec: DestructibleSpec, options?: AddOptions): string
  remove(id: string): void
  has(id: string): boolean
  ids(): string[]
  /** Move an object (the renderer or physics owns transforms; keep the world in sync so world-space hits land). */
  setTransform(id: string, position: Vec3, rotation: Quat): void
  /**
   * Split a loose group into its own object (after a `detach`, when the renderer makes the piece a separate body). The parts move with their
   * state; the new object starts at the old object's transform. Returns the new id.
   */
  splitGroup(id: string, group: number, newId?: string): string
  /** Apply a hit to one object (to the part it lands on, or for `explosive`/`fire`/`heat`, to every part in `radius`). */
  hit(objectId: string, hit: Hit): HitResult
  /** Apply a hit to a known part (e.g. after the host's own raycast). */
  hitPart(objectId: string, partId: string, hit: Hit): HitResult
  /** A blast in world space against every object in range. */
  explode(point: Vec3, energy: number, radius: number, source?: string): HitResult[]
  /** Raycast against every part shape (world space). */
  raycast(origin: Vec3, direction: Vec3, maxDistance?: number): RayHit | null
  /** Ballistic shot: raycast, hit, and continue through with the exit energy (up to 4 objects/parts). */
  shoot(origin: Vec3, direction: Vec3, energy: number, caliber: number, source?: string): HitResult[]
  /**
   * Work on a joint with a tool for `dt` seconds (call every frame while the player holds the button). Returns the progress 0..1, or -1 when the
   * tool cannot undo this joint. At 1 the joint opens (`detach` with `by: 'tool'`).
   */
  disassemble(objectId: string, jointId: string, tool: ToolKind, dt: number): number
  /** Joints of an object that `tool` can undo now (open joints excluded). */
  workableJoints(objectId: string, tool: ToolKind): JointState[]
  /** Joint nearest to a world point (for "aim at the screw"). */
  nearestJoint(objectId: string, point: Vec3, maxDistance?: number): JointState | null
  /** Put out fire on a part or the whole object, and cool it by `coolC` (default 200). */
  extinguish(objectId: string, partId?: string, coolC?: number): void
  /** Advance fire, heat transfer, cooling, melting, leaks and delayed explosions. */
  update(dt: number): DestructionEvent[]
  state(id: string): ObjectState | null
  part(id: string, partId: string): PartState | null
  /** Repair an object to its spec (test benches use it for "reset"). */
  reset(id: string): void
  on(type: DestructionEventType | '*', fn: (event: DestructionEvent) => void): () => void
  /** Plain JSON of every object (spec + state + transform) and the rng state. */
  serialize(): DestructionSnapshot
  load(snapshot: DestructionSnapshot): void
  /** Seconds since creation. */
  readonly time: number
}

export interface DestructionSnapshot {
  version: 1
  time: number
  rng: number
  objects: Array<{ id: string; spec: DestructibleSpec; state: ObjectState }>
}
