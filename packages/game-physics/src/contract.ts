/**
 * @adatechnology/game-physics: the rigid-body contract the kit talks to, whatever engine sits under it. Types plus tiny helpers.
 * Our own layers (materials and mass, damage, fracture, load path, ballistics, blast, CLAUDE.md §12) sit on top of it; an adapter
 * (`game-physics-<engine>`) implements it. Units: metres, kilograms, seconds; y up.
 */

export type Vec3 = readonly [number, number, number]
/** x, y, z, w. */
export type Quat = readonly [number, number, number, number]

export const IDENTITY: Quat = [0, 0, 0, 1]

/** A shape in the body's frame. Capsules and cylinders run along local y. */
export type ShapeDesc =
  | { readonly kind: 'box'; readonly half: Vec3 }
  | { readonly kind: 'sphere'; readonly radius: number }
  | { readonly kind: 'capsule'; readonly halfHeight: number; readonly radius: number }
  | { readonly kind: 'cylinder'; readonly halfHeight: number; readonly radius: number }
  | { readonly kind: 'convex'; readonly points: ArrayLike<number> }
  /** Static (or kinematic) only: triangles as drawn. `vertices` x,y,z; `indices` three per triangle. */
  | { readonly kind: 'trimesh'; readonly vertices: ArrayLike<number>; readonly indices: ArrayLike<number> }
  /**
   * Static only: `size` x `size` samples, `cell` metres apart, from `origin` (x, z of sample 0; y added to every height), x fastest
   * (`heights[iz * size + ix]`). Smooth terrain; a hard step (a slab edge) must be a box beside it: a height field turns it into a ramp one cell wide.
   */
  | { readonly kind: 'heightfield'; readonly origin: Vec3; readonly cell: number; readonly size: number; readonly heights: ArrayLike<number> }
  /** Children placed in the body's frame; `tag` (our part id) comes back on queries and contacts, -1 for a child without one and for a plain shape. */
  | { readonly kind: 'compound'; readonly children: ReadonlyArray<{ readonly shape: ShapeDesc; readonly position: Vec3; readonly rotation?: Quat; readonly tag?: number }> }

export type Motion = 'static' | 'kinematic' | 'dynamic'

/**
 * What the body is, for filtering. The adapter maps layers to its broadphase; `collides` is the default pair table (`LAYER_PAIRS`).
 * `sensor` bodies report overlap and never push.
 */
export type Layer = 'static' | 'debris' | 'prop' | 'character' | 'agent' | 'vehicle' | 'sensor'
export const LAYERS: readonly Layer[] = ['static', 'debris', 'prop', 'character', 'agent', 'vehicle', 'sensor']

/** Which layers meet (symmetric). Crowd agents (kinematic, driven by game-crowd) do not meet each other: game-crowd separates them itself. */
export const LAYER_PAIRS: ReadonlyArray<readonly [Layer, Layer]> = [
  ['static', 'debris'], ['static', 'prop'], ['static', 'character'], ['static', 'vehicle'],
  ['debris', 'debris'], ['debris', 'prop'], ['debris', 'character'], ['debris', 'vehicle'], ['debris', 'agent'],
  ['prop', 'prop'], ['prop', 'character'], ['prop', 'vehicle'], ['prop', 'agent'],
  ['character', 'character'], ['character', 'vehicle'], ['character', 'agent'],
  ['vehicle', 'vehicle'], ['vehicle', 'agent'],
  ['sensor', 'debris'], ['sensor', 'prop'], ['sensor', 'character'], ['sensor', 'agent'], ['sensor', 'vehicle'],
]

/** Coulomb friction of a surface: static (what holds it still) and dynamic (what drags it while it slides). Mixed by geometric mean. */
export interface Material {
  readonly frictionStatic: number
  readonly frictionDynamic: number
  readonly restitution: number
  /** The surface's rolling resistance (C_rr): a round body rolling on it takes the larger of its own (`Rolling.coefficient`) and the surface's, as the softer surface decides. */
  readonly rolling?: number
}

export const DEFAULT_MATERIAL: Material = { frictionStatic: 0.7, frictionDynamic: 0.6, restitution: 0.2 }

export interface BodyDesc {
  readonly shape: ShapeDesc
  readonly motion: Motion
  readonly position: Vec3
  readonly rotation?: Quat
  /** Dynamic only: the mass; inertia from the shape scaled to it. */
  readonly mass?: number
  /** Dynamic only, with `mass`: the moments of inertia about the body's own axes (kg m^2), in place of the shape's (a can whose contents roll with it or not). */
  readonly inertia?: Vec3
  /** Dynamic only, with `mass`: the body's origin is its centre of mass, wherever the shape's own centroid is (a piece whose parts are thin plates at one end): the engine turns it about the origin, so a pose and a velocity name the same point. */
  readonly centreAtOrigin?: boolean
  readonly material?: Material
  readonly layer?: Layer
  /** Bodies of one group whose sub-ids are in `disabledPairs` of that group do not meet (a ragdoll's neighbouring segments). */
  readonly group?: { readonly id: number; readonly sub: number }
  readonly linearDamping?: number
  readonly angularDamping?: number
  /** Fast and small (fragments, a thrown can): swept so it does not tunnel. */
  readonly continuous?: boolean
  readonly sleeping?: boolean
  readonly allowSleep?: boolean
  /** Ours: an index into the host's own table (a piece, a part, an agent). Comes back on queries and contacts. */
  readonly user: number
  readonly linearVelocity?: Vec3
  readonly angularVelocity?: Vec3
  /** Dynamic only: a round body's rolling resistance (engines have none; a ball would roll for ever). See `Rolling`. */
  readonly rolling?: Rolling
}

/**
 * Rolling resistance of a round body (a can, a ball, a casing): while it touches something, a moment `coefficient` (C_rr) x its weight x `radius` (its rolling
 * radius, m) opposes its spin, so it rolls to a stop as a real one does (C_rr 0.01-0.02 for a can on wood or concrete). It never turns the spin around.
 */
export interface Rolling {
  readonly coefficient: number
  readonly radius: number
}

/** An opaque handle; the adapter owns what it points to. */
export type BodyId = number & { readonly __body: unique symbol }
export type JointId = number & { readonly __joint: unique symbol }
export type VehicleId = number & { readonly __vehicle: unique symbol }

export type JointDesc =
  | { readonly kind: 'fixed'; readonly a: BodyId; readonly b: BodyId; readonly point: Vec3; readonly breakImpulse?: number }
  /** Rotates about `axis` (world, at creation) through `point`; angle of b against a in [min, max] radians. A knee, an elbow, a door. */
  | {
      readonly kind: 'hinge'; readonly a: BodyId; readonly b: BodyId; readonly point: Vec3; readonly axis: Vec3; readonly normal: Vec3
      readonly min: number; readonly max: number; readonly friction?: number; readonly breakImpulse?: number
    }
  /** Cone about `twistAxis` (half angles across `planeAxis` and the third axis) and a twist range. Shoulder, hip, neck. */
  | {
      readonly kind: 'swingTwist'; readonly a: BodyId; readonly b: BodyId; readonly point: Vec3; readonly twistAxis: Vec3; readonly planeAxis: Vec3
      readonly normalHalfCone: number; readonly planeHalfCone: number; readonly twistMin: number; readonly twistMax: number; readonly friction?: number
      readonly breakImpulse?: number
    }
  /**
   * Slides along `axis` (world, at creation) through `point`; the distance of b from where it was made, along the axis, is held in [min, max] metres
   * (min <= 0 <= max). A drawer, a rail. `friction` is the most force (N) that holds it still against the slide.
   */
  | {
      readonly kind: 'slider'; readonly a: BodyId; readonly b: BodyId; readonly point: Vec3; readonly axis: Vec3
      readonly min: number; readonly max: number; readonly friction?: number; readonly breakImpulse?: number
    }

/** A joint of a ragdoll part to its parent: a hinge or swing-twist as in `JointDesc`, the bodies being the part and its parent. */
export type RagdollJoint = Omit<Extract<JointDesc, { kind: 'hinge' }>, 'a' | 'b' | 'breakImpulse'> | Omit<Extract<JointDesc, { kind: 'swingTwist' }>, 'a' | 'b' | 'breakImpulse'>

/** One body of a ragdoll: a dynamic body, the index of its parent part (-1 for the root, which comes first) and its joint to it. */
export interface RagdollPart {
  readonly body: Omit<BodyDesc, 'motion' | 'group'>
  readonly parent: number
  readonly joint?: RagdollJoint
}

/**
 * A ragdoll as one engine object (the engine's own ragdoll, not loose bodies and joints): parts ordered parents first. `stabilize` lets the engine even out
 * mass and inertia between neighbouring parts (a 1 kg hand on a 3 kg forearm on a 30 kg torso) so its joints hold their limits; the masses then are the
 * engine's. Neighbouring parts, and parts that touch in the pose they are made in, do not collide.
 */
export interface RagdollDesc {
  readonly parts: readonly RagdollPart[]
  readonly stabilize?: boolean
  /** Solver passes for its bodies and joints in place of the world's (velocity, position): more holds the limits through a hard landing. */
  readonly solverSteps?: { readonly velocity: number; readonly position: number }
}

export type RagdollId = number & { readonly __ragdoll: unique symbol }

export interface WheelDesc {
  /** Attachment in the chassis frame (top of the suspension travel). */
  readonly position: Vec3
  readonly radius: number
  readonly width: number
  readonly suspensionMin: number
  readonly suspensionMax: number
  /** Hz and damping ratio of the spring. */
  readonly frequency: number
  readonly damping: number
  readonly maxSteer: number
  readonly driven: boolean
  readonly maxBrakeTorque: number
  readonly maxHandBrakeTorque: number
}

export interface VehicleDesc {
  readonly chassis: BodyDesc
  readonly wheels: readonly WheelDesc[]
  /** Engine torque (N m) and rpm range. */
  readonly maxTorque: number
  readonly minRpm: number
  readonly maxRpm: number
  /** Gear ratios, forward then reverse (negative). */
  readonly gears: readonly number[]
  readonly reverseGears: readonly number[]
  readonly differentialRatio: number
  readonly antiRoll?: number
}

export interface VehicleInput {
  readonly forward: number
  readonly right: number
  readonly brake: number
  readonly handBrake: number
}

export interface RayHit {
  readonly body: BodyId
  readonly user: number
  /** The compound child's `tag` (a part), or -1. */
  readonly tag: number
  readonly distance: number
}

/** Bodies the queries skip (by layer), or only these layers. */
export interface QueryFilter {
  readonly layers?: readonly Layer[]
}

/**
 * Contacts of the last step, struct of arrays, reused every step (no allocation per contact). `count` rows; row i: bodies `a[i]`, `b[i]`, users,
 * point (3 per row), normal from a to b, the speed they closed at along it (m/s), and the impulse of a new contact as the engine estimates it (N s).
 */
export interface ContactBuffer {
  readonly count: number
  readonly a: Int32Array
  readonly b: Int32Array
  readonly userA: Int32Array
  readonly userB: Int32Array
  readonly tagA: Int32Array
  readonly tagB: Int32Array
  readonly point: Float32Array
  readonly normal: Float32Array
  readonly approach: Float32Array
  readonly impulse: Float32Array
  /** Contacts that closed faster than `contactReportSpeed` (they would have been rows) but found no room past `maxContacts`; reset with the events. */
  readonly dropped: number
}

export interface SensorEvent {
  readonly sensor: BodyId
  readonly other: BodyId
  readonly entered: boolean
}

export interface WorldDesc {
  readonly gravity?: Vec3
  /** Fixed step (s); `step(dt)` runs as many as fit and keeps the rest. */
  readonly fixedStep?: number
  readonly maxBodies?: number
  /** Seconds still before a body sleeps and how slow is still (m/s of any point). */
  readonly sleepAfter?: number
  readonly sleepSpeed?: number
  /** Solver iterations per step. */
  readonly velocityIterations?: number
  readonly positionIterations?: number
  /** How deep (m) two bodies may sink into each other before they are pushed apart: what a resting box sinks into the floor. */
  readonly penetrationSlop?: number
  /** Most (m) the position solver moves two bodies apart per iteration: how fast what was made inside something comes out of it (a launch is that speed at most). */
  readonly maxPushOut?: number
  /** Coulomb static/dynamic friction per body (§12): a body whose foot moves against what it touches slower than this (m/s) holds with the static coefficient. */
  readonly slipSpeed?: number
  /** Report only contacts that closed faster than this (m/s), and at most `maxContacts` per step. */
  readonly contactReportSpeed?: number
  readonly maxContacts?: number
}

/** The kit's world (what spec 008 conditions 1-3 measured; owner decision 2026-11-14: 32 velocity passes, the least that keeps a 20:1 mass stack from making energy): 120 Hz, 32/2 solver passes, sleep after 0.5 s under 8 cm/s, 2 mm slop and push-out. Game, room and tests start from it. */
export const KIT_WORLD: WorldDesc = {
  fixedStep: 1 / 120,
  velocityIterations: 32,
  positionIterations: 2,
  sleepAfter: 0.5,
  sleepSpeed: 0.08,
  penetrationSlop: 0.002,
  maxPushOut: 0.002,
  slipSpeed: 0.02,
  contactReportSpeed: 0.5,
  maxContacts: 4096,
  maxBodies: 8192,
}

/** Solver passes of a ragdoll's own bodies and joints (condition 2): more than the world's, so its joints hold their limits through a hard landing. */
export const KIT_RAGDOLL_SOLVER: { readonly velocity: number; readonly position: number } = { velocity: 20, position: 8 }

export interface PhysicsWorld {
  readonly engine: string
  /** The fixed step (s) the world runs at: `PhysicsLoop` steps by it. */
  readonly fixedStep: number
  /** The body still exists (contact rows may name a body removed since: check before using it). */
  has(id: BodyId): boolean
  createBody(desc: BodyDesc): BodyId
  removeBody(id: BodyId): void
  /** Many at once (a blast breaking a wall): one broadphase insert. */
  createBodies(descs: readonly BodyDesc[]): BodyId[]
  /** A new shape on the same body; a dynamic one keeps the kit's mass (`mass`, else the one it was made with), its inertia from the new shape (or `mass.inertia`). */
  setShape(id: BodyId, shape: ShapeDesc, mass?: { readonly mass: number; readonly inertia?: Vec3 }): void
  /** Writes x, y, z then x, y, z, w into `out` at `offset`. */
  readPose(id: BodyId, out: Float32Array | Float64Array, offset: number): void
  readVelocity(id: BodyId, out: Float32Array | Float64Array, offset: number): void
  setPose(id: BodyId, position: Vec3, rotation: Quat, wake: boolean): void
  setVelocity(id: BodyId, linear: Vec3, angular: Vec3): void
  /** Kinematic: reach this pose at the end of the next step (it pushes what it meets). */
  moveKinematic(id: BodyId, position: Vec3, rotation: Quat, dt: number): void
  addImpulse(id: BodyId, impulse: Vec3, point?: Vec3): void
  isSleeping(id: BodyId): boolean
  wake(id: BodyId): void
  sleep(id: BodyId): void
  /** Wakes every dynamic body whose bounds touch the box (ground dug, a support removed). */
  wakeInBox(min: Vec3, max: Vec3): void
  setMaterial(id: BodyId, material: Material): void
  /** A body's rolling resistance from now on (`undefined`: none). */
  setRolling(id: BodyId, rolling: Rolling | undefined): void
  /** Dynamic <-> kinematic (a piece picked up and put down). */
  setMotion(id: BodyId, motion: 'kinematic' | 'dynamic'): void
  /** The points (world, x y z each) where the body touched anything in the last step, into `out`; returns how many points (at most `out.length / 3`). */
  contactPoints(id: BodyId, out: Float32Array): number
  /** Whether the body touched anything in the last step. */
  touching(id: BodyId): boolean
  /** The two bodies stop meeting (true) or meet again (false): our rule handles the pair (chunks born inside each other go apart along the ground). */
  ignorePair(a: BodyId, b: BodyId, ignore: boolean): void
  createJoint(desc: JointDesc): JointId
  removeJoint(id: JointId): void
  /** Angles of a joint now (radians), for checking limits: `hinge` for hinge, fixed and ragdoll hinge joints; `swing` and `twist` for swing-twist; 0 for the rest. */
  jointAngles(id: JointId): { swing: number; twist: number; hinge: number }
  /** Joints whose `breakImpulse` was passed in the last step: removed by the adapter, reported once. */
  readonly brokenJoints: readonly JointId[]
  /** Its bodies (in part order) and its joints (one per part but the root, in part order), for reading poses and `jointAngles`. */
  createRagdoll(desc: RagdollDesc): { readonly id: RagdollId; readonly bodies: readonly BodyId[]; readonly joints: readonly JointId[] }
  removeRagdoll(id: RagdollId): void
  /** Disable contact between sub-ids of a group. Returns the group id. */
  createGroup(subCount: number, disabledPairs: ReadonlyArray<readonly [number, number]>): number
  createVehicle(desc: VehicleDesc): VehicleId
  driveVehicle(id: VehicleId, input: VehicleInput): void
  vehicleBody(id: VehicleId): BodyId
  removeVehicle(id: VehicleId): void
  /** How many of the vehicle's wheels touch the ground now (a car with none is airborne: its sleep rule reads this). */
  wheelContacts(id: VehicleId): number
  /** Every hit along the ray, nearest first, into `out` (cleared); returns the count. */
  rayAll(from: Vec3, direction: Vec3, length: number, out: RayHit[], filter?: QueryFilter): number
  rayFirst(from: Vec3, direction: Vec3, length: number, filter?: QueryFilter): RayHit | null
  /** Bodies a sphere overlaps (user values into `out`); returns the count. */
  overlapSphere(center: Vec3, radius: number, out: BodyId[], filter?: QueryFilter): number
  /**
   * How deep (m) a body is inside the fixed bodies (layer `static`) where it stands now, and the way to move it out (unit, world) into `out`; 0 when it is in none.
   * The deepest overlap is reported: a host that places a body checks it, so nothing is made or put inside what does not move. `among` counts only those bodies.
   */
  penetration(id: BodyId, out: Float64Array, among?: ReadonlySet<BodyId>): number
  /** A sphere swept along the ray: every body it meets, nearest first. */
  sphereCastAll(from: Vec3, direction: Vec3, length: number, radius: number, out: RayHit[], filter?: QueryFilter): number
  readonly contacts: ContactBuffer
  readonly sensorEvents: readonly SensorEvent[]
  /**
   * Single-system callers: runs every whole fixed step in `dt` (the rest waits) after clearing `contacts`, `sensorEvents` and `brokenJoints`, so they hold
   * those steps' events. Under a `PhysicsLoop` nobody calls this: the loop uses `stepFixed`.
   */
  step(dt: number): void
  /** Exactly one step of `h` (the world's `fixedStep`), no accumulator, events kept: they pile up until `clearEvents`. The loop's step; not in `SeamWorld`. */
  stepFixed(h: number): void
  /** Empties `contacts`, `sensorEvents` and `brokenJoints` (and `contacts.dropped`): the loop does it once per frame. */
  clearEvents(): void
  /**
   * The world's exact state as bytes: bodies, velocities, sleep, contact cache and what the adapter keeps that changes contact (friction, partners, pending
   * time, ignored pairs, rolling, step count), maps written in key order so save, restore, save gives the same bytes. Scope: it holds no description of
   * which bodies, joints and vehicles exist, so `restoreState` is only valid on a world with the same ones, created in the same order. Saving a game is the
   * host's own description plus these bytes.
   */
  saveState(): Uint8Array
  /** Puts a `saveState` back (same bodies, same order, see there); false when the bytes do not fit. */
  restoreState(data: Uint8Array): boolean
  readonly bodyCount: number
  readonly activeCount: number
  /** Bytes the engine holds (its heap), for leak checks. */
  memoryInUse(): number
  dispose(): void
}

/** An adapter: an async load (wasm) then a sync world factory. */
export interface PhysicsEngine {
  readonly name: string
  createWorld(desc?: WorldDesc): PhysicsWorld
}

/** Mixed friction of two surfaces (geometric mean), as the kit has always mixed it. */
export const mixFriction = (a: number, b: number): number => Math.sqrt(a * b)

/** The world without the calls only the loop (or the owner) makes: what the seams (`engine-*.ts` of the domain packages) are handed. */
export type SeamWorld = Omit<PhysicsWorld, 'step' | 'stepFixed' | 'clearEvents' | 'dispose' | 'saveState' | 'restoreState'>
