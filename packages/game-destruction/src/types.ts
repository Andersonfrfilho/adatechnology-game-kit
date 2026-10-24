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

import type {
  DamageType,
  DebrisKind,
  DestructibleImpl,
  DestructibleSpec,
  DestructionEvent,
  DestructionEventType,
  FractureStyle,
  JointState,
  MaterialId,
  ObjectState,
  PartState,
  Quat,
  RayHit,
  HitResult,
  Hit,
  ToolKind,
  Vec3,
} from '@adatechnology/game-contracts'

// The contract types live in @adatechnology/game-contracts; they are re-exported so that no import from this package breaks.
export type {
  ChainDelay,
  Crack,
  DamageStage,
  DamageType,
  DebrisKind,
  Dent,
  DestructibleImpl,
  DestructibleSpec,
  DestructionEvent,
  DestructionEventType,
  ExplosionChain,
  FluidKind,
  Fragment,
  FragmentMark,
  FractureStyle,
  Hit,
  HitResult,
  Hole,
  ImpactContract,
  JointKind,
  JointSpec,
  JointState,
  MaterialId,
  ObjectState,
  PartBreach,
  PartShape,
  PartSpec,
  PartState,
  PartStatus,
  PartUnits,
  Quat,
  RayHit,
  Reinforcement,
  StructureRole,
  SurfaceLayer,
  ToolKind,
  Vec3,
} from '@adatechnology/game-contracts'

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
  /**
   * Load a structural part of this material carries per square metre of cross-section, in kg (game-tuned: concrete 444 000, brick 40 000,
   * softwood 100 000, steel 2 000 000). Default 20 000. See `PartSpec.structure`.
   */
  compressive?: number
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

export interface SizeStructureOptions {
  /** Stress every structural part has at rest after sizing (`load / capacity`), 0..1 (default 0.65). */
  safety?: number
  /**
   * Redundancy target: when set, the capacity of a part is raised (never lowered) until losing any single `column` leaves every other
   * structural part at this stress or below, e.g. 0.97 (an N-1 design: the building stands with one column gone). Omit to skip the check.
   * Should be above `safety` and, to let the structure fall when a second column goes, below 1.
   */
  redundancy?: number
  /** Extra or overriding materials, the same list given to `createDestruction`. */
  materials?: MaterialDef[]
}

/*
 * Notes on behaviour that the types cannot express:
 * - `leak` events carry the hole's world point, the outward normal as `direction`, and `rate` in litres per second; `PartState.liters` drops
 *   in `update` while the part has through holes.
 * - `state()` and `part()` return live views owned by the world. Do not mutate them; copy them if you need a snapshot.
 * - A part with `explodes` can be destroyed even if its material never fractures (`fracture: 'none'`); it then fractures as `snap`.
 */

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
  /**
   * Host an object whose behaviour a game module owns (see `DestructibleImpl`) next to the world's own objects. Returns its id (`options.id`, else
   * `impl.id`). Raycast, shoot, explode, hit, disassemble, extinguish, update, state, reset, remove and `on` route to it; its events go through the
   * same listeners in order. `splitGroup` on it throws.
   */
  register(impl: DestructibleImpl, options?: AddOptions): string
  remove(id: string): void
  has(id: string): boolean
  ids(): string[]
  /** Move an object (the renderer or physics owns transforms; keep the world in sync so world-space hits land). */
  setTransform(id: string, position: Vec3, rotation: Quat): void
  /**
   * Move a part's collision shape (raycast, hits, blast and joint distance) to an object-local pose; the part's spec is unchanged. Animations are
   * visual, so a host that plays a clip calls this every frame with `rest + clip offset`. `rotation` is Euler XYZ (radians), default none. For a
   * registered impl it forwards to the optional `DestructibleImpl.setPartPose` and otherwise only moves the world's raycast shape. Dents and holes
   * stay in object space.
   */
  setPartPose(objectId: string, partId: string, position: Vec3, rotation?: Vec3): void
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
  /**
   * Joint nearest to a world point (for "aim at the screw"). With `tool`, the nearest open-able joint that tool can undo within `maxDistance`
   * wins; only when none qualifies does it fall back to the nearest joint of any kind.
   */
  nearestJoint(objectId: string, point: Vec3, maxDistance?: number, tool?: ToolKind): JointState | null
  /** Put out fire on a part or the whole object, and cool it by `coolC` (default 200). */
  extinguish(objectId: string, partId?: string, coolC?: number): void
  /** Advance fire, heat transfer, cooling, melting, leaks and delayed explosions. */
  update(dt: number): DestructionEvent[]
  /**
   * The object's LIVE state: the same object the world mutates every update (parts, joints, groups). Treat it as read-only and change the world only
   * through the API (`hit`, `disassemble`, `setLiters`...). Do not keep it across frames to compare "before" and "after": use `snapshot`.
   */
  state(id: string): ObjectState | null
  /** The part's LIVE state (see `state`): read-only, mutated by the world. */
  part(id: string, partId: string): PartState | null
  /** A deep copy of the object's state at this moment: safe to keep, compare and mutate. Null for an unknown id. */
  snapshot(id: string): ObjectState | null
  /** Repair an object to its spec (test benches use it for "reset"). */
  reset(id: string): void
  on(type: DestructionEventType | '*', fn: (event: DestructionEvent) => void): () => void
  /** Plain JSON of every object (spec + state + transform) and the rng state. */
  serialize(): DestructionSnapshot
  load(snapshot: DestructionSnapshot): void
  /**
   * Fill or empty a container part (`PartSpec.contains`); `liters` is clamped to `[0, contains.liters]` of its spec. Used by fluid simulations
   * that drain or refill the part. Does nothing when the part has no `contains`.
   */
  setLiters(objectId: string, partId: string, liters: number): void
  /** Seconds since creation. */
  readonly time: number
}

/** Internal bookkeeping of a part that is saved with the world so that a loaded world continues identically. Treat as opaque. */
export interface PartRuntime {
  /** Last melt fraction reported in a `melt` event. */
  meltEmitted: number
  /** Seconds since the last `drip`. */
  dripT: number
  /** Temperature at the end of the previous update (thermal shock). */
  prevTemp: number
  /** Seconds left before another thermal crack is allowed. */
  shockT: number
  /** A leaking flammable fluid is burning on this part. */
  jet: boolean
  /** Seconds left before the next `stress` event. */
  stressT?: number
  /** World time at which a primed explosive part goes off (`explodes.chain`). */
  chainDue?: number
}

/** Opaque bookkeeping of an object (see `PartRuntime`). `joints` holds the last disassembly step reported per joint id. */
export interface ObjectRuntime {
  parts: Record<string, PartRuntime>
  joints: Record<string, number>
  /** Parts of groups that already reported a `collapse`. */
  collapsed?: string[]
}

export interface DestructionSnapshot {
  version: 1
  time: number
  rng: number
  /** Counter for generated object ids (`obj_1`...). */
  counter?: number
  objects: Array<{ id: string; spec: DestructibleSpec; state: ObjectState; runtime?: ObjectRuntime }>
  /** Registered impls: transform and `serialize()` data. `load` restores them into impls registered under the same ids. */
  impls?: Array<{ id: string; position: Vec3; rotation: Quat; data?: unknown }>
}
