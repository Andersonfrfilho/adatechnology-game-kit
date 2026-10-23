/**
 * Destruction contract: the types a game module and a destruction world share. A module (vehicle, furniture, plant, house, weapon) describes
 * itself with these and never needs the default destruction world; the world, the renderer and the test room consume them.
 *
 * Units: metres, kilograms, seconds, joules, degrees Celsius.
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
  /**
   * Structural role. Structural parts (any role but `none`) carry their own mass plus the load of the parts resting on them down to the anchored
   * parts, over the joints that `bears`. `foundation` implies `anchored`. `none` (and parts without `structure`) never carry load: a window, a door
   * or furniture is not part of the structure. Objects without any structural part behave as before.
   */
  structure?: { role: StructureRole; capacity?: number }
}

/**
 * Role of a part in the structure of a building. `partition` is a non-load-bearing wall: it is supported by other parts and carries nothing, so
 * breaking it never drops anything.
 */
export type StructureRole = 'foundation' | 'column' | 'beam' | 'slab' | 'wall' | 'partition' | 'roof' | 'stair' | 'none'

/** How two parts are attached. Decides the default strength and the tool that undoes it. */
export type JointKind = 'screw' | 'bolt' | 'nail' | 'weld' | 'glue' | 'hinge' | 'clip' | 'tie' | 'mortar' | 'fused' | 'stem' | 'rebar' | 'resting'

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
  /**
   * The joint transfers load (default true when both parts have a structure role other than `none`, false otherwise). `'a_on_b'` means part `a`
   * rests on part `b` (load flows from `a` to `b` only), `'b_on_a'` the opposite. With `true` the load is shared with the neighbours closer to an
   * anchored part. A part that loses every support path to an anchored part collapses, even if it is still connected sideways to other parts.
   */
  bears?: boolean | 'a_on_b' | 'b_on_a'
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
  /**
   * Structural parts only. Load in kg: own mass plus what rests on the part. `stress` = `load / capacity`; above 1 the part takes damage every
   * `update` (`(stress - 1) * maxHp * 0.5` per second), which can cascade. Capacity is `structure.capacity`, else `compressive * section` of the
   * material, where the section is the product of the two smallest dimensions (columns, beams, roofs, stairs, foundations x10), thickness times longest dimension (slabs) or
   * thickness times horizontal length (walls). Example: a 0.3 m concrete column carries 40 t, a 0.2 m brick wall 8 t per metre, a 0.1x0.2 m softwood beam 2 t.
   */
  load?: number
  stress?: number
  /** Index into `ObjectState.groups` of the piece this part belongs to (-1 when the part is broken, melted or ash). */
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
  /** A structural part is overloaded (`stress` > 1); throttled to once per 0.5 s per part. Brittle parts also `crack` at stress > 0.8. */
  | (EventBase & { type: 'stress'; part: string; stress: number; load: number })
  /** A group with structural parts lost every anchored part (an anchored part exists in the object): it falls. Reported once per group. */
  | (EventBase & { type: 'collapse'; parts: string[]; mass: number })
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
