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

/** Seconds from a trigger to the blast: fixed, or `[min, max]` drawn from the world seed. */
export type ChainDelay = number | readonly [number, number]

/** How an explosive part is set off by what happens around it. See `PartSpec.explodes`. */
export interface ExplosionChain {
  shot?: ChainDelay
  fire?: ChainDelay
  explosion?: ChainDelay
  /** Fraction of the part's hit points a shot must have taken off before it sets the part off (default 0: any hit). */
  shotDamageFraction?: number
}

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
  contains?: {
    fluid: FluidKind
    liters: number
    pressurized?: boolean
    /**
     * Object-local direction the fluid leaves through a hole (the `leak` event's `direction`), for a fluid that does not spray back out of the hole
     * but runs down through it: the water on a roof membrane goes `[0, -1, 0]` into the floor below. Default: out of the hole (its normal).
     */
    outflow?: Vec3
  }
  /** The part explodes when destroyed, or when its temperature passes `atC` (gas bottle, fuel tank, aerosol). */
  explodes?: {
    energy: number
    radius: number
    atC?: number
    /**
     * Chain reaction: what sets the part off before it is destroyed and the seconds from that to the blast (a number, or `[min, max]` drawn
     * from the world seed). `shot`: a bullet hit; `fire`: the part gets to `atC` (default 300 °C) or burns; `explosion`: a blast reaches it.
     * Each part goes off once. Without `chain`, it explodes only when destroyed (or at `atC`).
     */
    chain?: ExplosionChain
    /** Id of the effect the host plays for the blast (`explosion_fuel_barrel`); without it the host picks a generic one by `energy` and `radius`. */
    effect?: string
  }
  /** Fixed to the world (a wall-mounted cabinet, a tree trunk in the ground). Groups that keep an anchored part stay in place. */
  anchored?: boolean
  /** Free tags the host can use (`door`, `wheel`, `screen`, `trunk`, `leaf`...). */
  tags?: string[]
  /**
   * Structural role. Structural parts (any role but `none`) carry their own mass plus the load of the parts resting on them down to the anchored
   * parts, over the joints that `bears`. `foundation` implies `anchored`. `none` (and parts without `structure`) never carry load: a window, a door
   * or furniture is not part of the structure. Objects without any structural part behave as before.
   */
  structure?: { role: StructureRole; capacity?: number; rebar?: TensionRebar; pile?: PileSpec }
  /**
   * Coats over the core, outermost first (plaster, tile, the paper of a drywall board). `thickness` of the part is the core only; each coat adds
   * `material.penetration x thickness` to what a bullet must get through, and a hit spalls the outer coat at the impact (`spall` event) before it
   * reaches the core.
   */
  layers?: readonly SurfaceLayer[]
  /** Steel inside a concrete part: when the part reaches 0 hp the concrete crumbles but the cage stays (`expose`, `PartState.stripped`). */
  reinforcement?: Reinforcement
  /** Masonry made of units (bricks, blocks, panels): fragments of a breach or a fracture are the size of one unit, laid in `bond`. */
  units?: PartUnits
  /**
   * Opts the part into damage stages (`PartState.stage`, `stage` events). Through damage (through holes, blunt and explosive damage) within
   * `radius` metres of a point that adds up to `area` square metres opens the part: stage 2, the part stays with an opening.
   */
  breach?: PartBreach
}

/** A coat over a part's core. `faces` says on which side(s) of the part's thinnest axis it lies (`'+'` and `'-'` are the local +/- directions). */
export interface SurfaceLayer {
  material: MaterialId
  /** Metres. */
  thickness: number
  faces: 'both' | '+' | '-'
}

/** Rebar of a concrete part. Plates get two perpendicular grids at mid thickness, long members (columns, beams) bars along their length. */
export interface Reinforcement {
  material: MaterialId
  /** Metres between bars (0.18). */
  spacing: number
  /** Bar diameter in metres (0.007 to 0.010). */
  diameter: number
  /** Fraction of the part's structural capacity the bare cage keeps (default 0.15). */
  residualCapacity?: number
}

/**
 * Tension steel of a concrete beam, slab, roof or stair for the bending model (`DestructionOptions.structure.flexure`), when it is not taken from the
 * `reinforcement` cage. `ratio` is the steel area over the effective section of the tension face, `As / (b * d)` (NBR 6118: at least 0.15% for
 * C25-C30; beams 0.5-1.5%, slabs 0.2-0.6%). Unlike `reinforcement` it draws no bars and does not stage the part.
 */
export interface TensionRebar {
  /** `As / (b * d)` of the tension face, 0..0.04. */
  ratio: number
  /** Yield strength of the steel in MPa (default `flexure.rebarYieldMPa`, 500 = CA-50). */
  yieldMPa?: number
  /** Concrete cover to the bar in metres (default `flexure.cover`). */
  cover?: number
}

/**
 * Deep foundation under a `foundation` part (its pile cap): `count` concrete piles of `diameter` going `length` metres down from the bottom of the
 * part, laid out in a grid under it. They carry the load by end bearing at the tip and skin friction along the shaft, from the soil layers they go
 * through (`DestructibleSpec.soil`). Without it a foundation part is a shallow footing (pad, strip or raft) that bears on the soil under it.
 */
export interface PileSpec {
  /** Metres below the bottom of the part. */
  length: number
  /** Metres. */
  diameter: number
  /** Piles under the part (default 1). */
  count?: number
  /** `bored` (cast in place, the default) or `driven` (precast): how much of the soil's resistance the pile mobilises. */
  method?: 'bored' | 'driven'
}

/** One layer of soil, from the top down. `soil` is a soil class id (`clay_soft`, `sand_dense`, `rock`...); the last layer goes on forever. */
export interface SoilLayer {
  soil: string
  /** Metres (ignored on the last layer). */
  thickness?: number
}

/** The ground under an object. Settlement, tilt and bearing failure are computed only for objects that have one. */
export interface SoilProfile {
  layers: readonly SoilLayer[]
  /** Object-local height of the ground surface (default: the top of the highest foundation part). */
  surface?: number
  /** Width a footing has at least where a part rests on a foundation tagged `terrain` (default 0.6 m, the NBR 6122 minimum). */
  footingWidth?: number
}

/** Size of one masonry unit in the part's axes (`size[2]` is along the part's thinnest axis, clamped to it) and how rows are laid. */
export interface PartUnits {
  size: Vec3
  bond: 'running' | 'stack'
  mortar: MaterialId
}

export interface PartBreach {
  /** Square metres of through damage inside the breach radius that open the part (default 0.25). */
  area?: number
}

/**
 * Damage stage of a part with `breach`/`layers`/`units`/`reinforcement`: 0 intact, 1 marked (first hole or crack), 2 breached (an opening you can
 * pass through), 3 gone (fractured or collapsed).
 */
export type DamageStage = 0 | 1 | 2 | 3

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
  /**
   * The ground the object stands on: a soil class id (one layer) or a profile. With it the foundations bear on the soil: the object settles, tilts
   * and, when the soil cannot carry it, sinks and tips over (`ObjectState.soil`, `settle` events). Without it the foundations are fixed as before.
   */
  soil?: string | SoilProfile
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Damage input
// ---------------------------------------------------------------------------------------------------------------------------------------------

export type DamageType =
  /** bullets and pellets: `energy`, `caliber`; makes holes, dents, cracks, ricochets */
  | 'ballistic'
  /** hammers, falls, thrown objects, vehicle impacts: `energy`, `radius` of contact */
  | 'blunt'
  /**
   * axes, knives, machetes: `energy`; cuts and splinters, opens fabric. A cut only goes through a slice of the part, so its cost follows the
   * cross-section, not the length: on a part longer than 1 m, slash damage is multiplied by its longest dimension in metres (at most 50).
   */
  | 'slash'
  /** blasts: `energy`, `radius`; damage and impulse fall off with distance, joints break, fragments fly */
  | 'explosive'
  /** open flame (lighter, molotov, flamethrower): `temperature`, `radius`, `duration`; ignites */
  | 'fire'
  /** heat without flame (cutting torch, hot plate): `temperature`, `radius`, `duration`; heats and melts */
  | 'heat'

/**
 * What stands between a blast and what it reaches (`blast.shelter`). Each part the line from the centre to the target crosses lets through
 * `exp(-resistance / k)` of the energy, with `resistance = hpPerKg * density * path * damageScale.shelter` (the hit points of the slab it crosses,
 * per square metre). Defaults: `k` 2800, `brokenTransmission` 0.5 (a brick wall of 20 cm lets 19%, a 4 cm wooden door 53%, 6 mm glass 83%).
 */
export interface ShelterOptions {
  /** Hit points per square metre at which a slab lets `1/e` (37%) through (default 2800). */
  k?: number
  /** Share of what a blocker held back that goes through anyway when the blocker is destroyed or breached by this same blast (default 0.5). */
  brokenTransmission?: number
  /** Shortest path through a part that counts as a crossing, in metres (default 0.005). */
  minPath?: number
}

/**
 * Fragments of a part a blast breaks, thrown as low-energy hits on what they reach (`blast.fragmentHits`). Each fragment hits with
 * `energyFactor * m * v^2 / 2` joules. Defaults: `max` 24, `energyFactor` 0.5, `hitType` blunt, `range` 6 m, `flightTime` 0.4 s, `spread` 10 deg, `aim` 40 deg.
 */
export interface FragmentHitOptions {
  /** Most fragment hits in one blast; the most energetic go first (default 24). */
  max?: number
  /** Share of the fragment's kinetic energy that lands as the hit (default 0.5). */
  energyFactor?: number
  /** `blunt` (default), or `ballistic` (the hit carries the fragment's mass in grams and a calibre from its size). */
  hitType?: 'blunt' | 'ballistic'
  /** Longest throw in metres (default 6); the throw is also limited to `speed * flightTime`. */
  range?: number
  /** Seconds of flight that set the throw range with the speed (default 0.4). */
  flightTime?: number
  /** Half angle in degrees of the seeded scatter around the aim (default 10). */
  spread?: number
  /** With `shelter`: fragments of a blocker whose line to a target is within this many degrees of their flight aim at that target (default 40). */
  aim?: number
}

/** Pressure of a blast in an enclosed volume (`blast.confinement`): `1 + gain * closed^power * clamp(radius / meanDistance, 0, 2)`, up to `max`. */
export interface ConfinementOptions {
  /** Seeded rays from the centre (default 26). */
  rays?: number
  /** The rays reach `radius * reach` (default 1.5). */
  reach?: number
  /** Default 1.5. */
  gain?: number
  /** Exponent on the closed share of the rays (default 2). */
  power?: number
  /** Largest multiplier (default 3). */
  max?: number
}

/**
 * Options of a blast, all off by default (the blast then behaves exactly as before): world defaults in `DestructionOptions.blast`, per call in
 * `world.explode(..., options)` and on the explosive `Hit`.
 */
export interface BlastOptions {
  /** Walls and other parts between the centre and the target take their share of the blast. `true` for the defaults. */
  shelter?: boolean | ShelterOptions
  /** Fragments of what the blast breaks fly on to hit what is behind. `true` for the defaults. */
  fragmentHits?: boolean | FragmentHitOptions
  /** A number is the multiplier itself (a room volume the host knows, skips the rays); `true` or options estimate it with rays. */
  confinement?: boolean | number | ConfinementOptions
}

/** What a blast did to one target (`HitResult.blast`). */
export interface BlastReport {
  /** Share of the blast that reaches the target, 0..1 (the most exposed part of an object; 1 without `shelter`). */
  shelter: number
  /** Share per part that took the blast, when `shelter` is on. */
  parts?: Record<string, number>
  /** Pressure multiplier applied to the blast energy (1 without `confinement`). */
  confinement: number
  /** Fragment hits that landed on this target. */
  fragmentHits: number
}

/**
 * How likely a round is to set flammable vapour or fuel alight when it hits a container of it, as the weapons module resolves them for the round
 * (core, jacket, incendiary or tracer composition, each with a configured chance). 0..1 each, per hit.
 */
export interface HitIgnition {
  /** Sparks from a hard core or jacket striking metal: counts only when the struck part is metal. */
  spark: number
  /** A flame the round carries (incendiary, tracer): counts whatever it hits. */
  flame: number
}

/** The ballistic fields of a `Hit` that come from the round and not from the shot geometry (see `shotExtras`). */
export type BallisticExtras = Pick<Hit, 'piercing' | 'penetration' | 'incendiary' | 'tracer' | 'ignition'>

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
  /** Projectile mass in grams (ballistic): the penetration of a body needs it, the energy alone does not say how much a bullet pushes. */
  mass?: number
  /** 0..1, how much of the blow is an edge that cuts through (slash 0.85, blunt 0, explosive 1; a bullet carries its own). */
  cut?: number
  /** A part the caller already resolved, by id (a crowd raycast against capsules); the impl then skips its own part search. */
  part?: string
  /**
   * Ballistic: how well the bullet cuts through for its energy, default 1 (a rifle FMJ). Soft lead (a slug, buckshot) deforms and goes through
   * less steel than its joules say, an armour-piercing core more: the energy that counts against the penetration of a hard material (metal, masonry) is `energy * piercing`; wood, glass and soft materials take the energy as it is.
   */
  piercing?: number
  /**
   * Ballistic: how far the projectile goes through, in millimetres, by material class (`steel`, `concrete`, `brick`, `wood`, or a material id). The world
   * takes the entry of the struck material (its `penetrationClass`, else its id, scaled by its `penetrationScale`) and the bullet goes through when it is
   * at least as thick as the part; a material with no entry falls back to the energy rule (`energy` and `piercing`). The engine reads no calibre
   * names: the weapons put the numbers here (`ammo.penetration` of `@adatechnology/game-weapons`, scaled by the energy left at the hit).
   */
  penetration?: Readonly<Record<string, number>>
  /** Ballistic: the round carries an incendiary composition (it can light flammable vapour and fuel whatever it hits). */
  incendiary?: boolean
  /** Ballistic: the round is a tracer (a burning pyrotechnic in the base). */
  tracer?: boolean
  /** Ballistic: chances that the round lights flammable vapour or fuel (see `HitIgnition`). Absent: it never does. */
  ignition?: HitIgnition
  /** Explosive: pressure multiplier the host knows (a room volume); the energy is then `energy * confinement` and the ray estimate is skipped. */
  confinement?: number
  /** Explosive: per-call blast options (see `BlastOptions`). */
  blast?: BlastOptions
  /** Explosive hit on an impl: the share of the blast that reaches it after what stood between; `energy` is already reduced by it. Informational. */
  shelter?: number
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------------------------------------------------------

export type PartStatus =
  | 'intact'
  | 'damaged'
  /** the part lost its support path to the ground and fell with its group (reported by a `collapse` event); it still exists as a piece */
  | 'collapsed'
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
   * `update` (`min(0.6, 0.12 + 0.8 * (stress - 1))` of `maxHp` per second: about 7 s at stress 1.02, 2 s at 1.5, 1.7 s above 1.7), which can cascade. Capacity is `structure.capacity`, else `compressive * section` of the
   * material, where the section is the product of the two smallest dimensions (columns, beams, roofs, stairs, foundations x10), thickness times longest dimension (slabs) or
   * thickness times horizontal length (walls). Example: a 0.3 m concrete column carries 40 t, a 0.2 m brick wall 8 t per metre, a 0.1x0.2 m softwood beam 2 t.
   */
  load?: number
  stress?: number
  /** Damage stage; only present on parts that opted in (see `PartSpec.breach`). */
  stage?: DamageStage
  /**
   * Beams, slabs, roofs and stairs of a material with `strength.tensileMPa` only: bending moment at rest over the moment the section holds (the steel's
   * when it is reinforced and holds more than the concrete's cracking moment, else the cracking moment). `stress` is the largest of this and the
   * compression ratio.
   */
  flexure?: number
  /** The tension face cracked (a blast, an impact or the load bent it past the cracking moment): the concrete no longer carries tension, the steel does. */
  cracked?: boolean
  /** Reinforced part whose concrete is gone: only the rebar cage is left (capacity x `residualCapacity`); it is still part of the structure. */
  stripped?: boolean
  /** Opening a breach left, in object-local space (stage 2). Raycasts and shots pass through it. */
  opening?: { center: Vec3; radius: number }
  /** Index into `ObjectState.groups` of the piece this part belongs to (-1 when the part is broken, melted or ash). */
  group: number
}

/** How the ground under an object is holding (`DestructibleSpec.soil`). */
export interface SoilState {
  /** Metres the foundations went down, at their centre of stiffness. */
  settlement: number
  /** Degrees the object leans from the vertical. */
  tilt: number
  /** Object-local horizontal unit vector the top leans toward (zero when it stands straight). */
  direction: Vec3
  /** Weight of the object over what its foundations can carry before the soil gives way (above 1 it sinks). */
  bearing: number
  /** Largest share of its capacity any foundation (a strip of a footing, a pile) is using, 0..1: at 1 the soil under it is yielding. */
  edge: number
  /** `stable`: at rest; `yielding`: the soil is giving way and the object is still moving; `toppled`: it tipped over. */
  status: 'stable' | 'yielding' | 'toppled'
  /**
   * The settled pose relative to the pose the host gave (`setTransform`), in object-local space: draw the object's parts under a node with this
   * transform. `ObjectState.position` and `rotation` already include it.
   */
  offset: { position: Vec3; rotation: Quat }
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
  /** Only objects with `DestructibleSpec.soil`: how the ground under it is holding. */
  soil?: SoilState
  /** Only objects that are a living body (a character, an animal): the summary the crowd and the HUD read. */
  body?: { alive: boolean; vitality: number; missing: number; limp: boolean; crawl: boolean }
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
  /** Holes the part had where this fragment came from, in the fragment's own axes: the renderer keeps them on the debris. */
  marks?: readonly FragmentMark[]
}

export interface FragmentMark {
  /** Relative to the fragment's centre, in the fragment's axes. */
  point: Vec3
  normal: Vec3
  diameter: number
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
  | (EventBase & { type: 'explode'; part: string; point: Vec3; energy: number; radius: number; effect?: string })
  /** An explosive part was set off by a bullet, fire or a nearby blast and will explode `delay` seconds from now (`explodes.chain`). */
  | (EventBase & { type: 'primed'; part: string; point: Vec3; trigger: 'shot' | 'fire' | 'explosion'; delay: number })
  /** A structural part is overloaded (`stress` > 1); throttled to once per 0.5 s per part. Brittle parts also `crack` at stress > 0.8. */
  | (EventBase & { type: 'stress'; part: string; stress: number; load: number })
  /**
   * The ground under an object moved (`DestructibleSpec.soil`): it settled or leans more, the soil started or stopped yielding, or it tipped over
   * (`status: 'toppled'`, followed by a `collapse` of everything). Throttled to once per 0.5 s while it moves. `direction` is in world space.
   */
  | (EventBase & { type: 'settle'; settlement: number; tilt: number; direction: Vec3; bearing: number; status: SoilState['status'] })
  /** A group with structural parts lost every anchored part (an anchored part exists in the object): it falls. Reported once per group. */
  | (EventBase & { type: 'collapse'; parts: string[]; mass: number })
  /** The outer coat of a layered part came off at `point` (`layer` indexes `PartSpec.layers`; `area` in m²). */
  | (EventBase & { type: 'spall'; part: string; layer: number; point: Vec3; area: number })
  /**
   * A staged part changed stage. At stage 2 `opening` is where the breach is and `fragments` the unit-sized pieces that came out (the part is not
   * removed: draw the fragments and cut the opening, do not hide the part). Stage 3 follows a `fracture` or a `collapse`.
   */
  | (EventBase & { type: 'stage'; part: string; stage: DamageStage; opening?: { center: Vec3; radius: number }; fragments?: readonly Fragment[] })
  /** Rebar of a reinforced part is bare: segments in world space. Empty `bars` means the cage is gone. */
  | (EventBase & { type: 'expose'; part: string; bars: readonly [Vec3, Vec3][] })
  /** A living body changed: a wound, a broken or severed limb, a destroyed segment, a split torso, limp, crawl, stun or death. `below` lists the parts that fall with a severed one. */
  | (EventBase & {
      type: 'body'
      part?: string
      change: 'wound' | 'broken' | 'severed' | 'destroyed' | 'split' | 'limp' | 'crawl' | 'stunned' | 'killed'
      cause?: 'head' | 'vitality' | 'bleed' | 'explosion'
      below?: string[]
      exit?: Vec3
    })
  /** A blast with `shelter`, `fragmentHits` or `confinement` on: what it did (once per blast, after its damage). `energy` is the blast energy after confinement. */
  | (EventBase & {
      type: 'blast'
      point: Vec3
      energy: number
      radius: number
      confinement: number
      shelter: Array<{ object: string; part?: string; factor: number }>
      fragmentHits: number
    })
  /** A fragment of a part the blast broke hit something (`blast.fragmentHits`); the target's own events follow. */
  | (EventBase & {
      type: 'fragment_hit'
      from: { object: string; part: string }
      target: { object: string; part?: string }
      point: Vec3
      direction: Vec3
      energy: number
      mass: number
      speed: number
    })
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
  /** Explosive hits with `shelter`, `fragmentHits` or `confinement` on: what the blast did to this target. */
  blast?: BlastReport
}

export interface RayHit {
  object: string
  part: string
  point: Vec3
  normal: Vec3
  distance: number
}
