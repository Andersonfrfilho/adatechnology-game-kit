/**
 * @adatechnology/game-physics (spike): the rigid-body contract the kit talks to, whatever engine sits under it. Types plus tiny helpers.
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
   * Static only: `size` x `size` samples, `cell` metres apart, from `origin` (x, z of sample 0; y added to every height). Smooth terrain; a hard
   * step (a slab edge) must be a trimesh or a box: a height field turns it into a ramp one cell wide.
   */
  | { readonly kind: 'heightfield'; readonly origin: Vec3; readonly cell: number; readonly size: number; readonly heights: ArrayLike<number> }
  /** Children placed in the body's frame; `tag` comes back on queries and contacts (our part id). */
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
  /** Coulomb static/dynamic friction per contact (§12): a contact slower than this (m/s) along the surface holds with the static coefficient. */
  readonly slipSpeed?: number
  /** Report only contacts that closed faster than this (m/s), and at most `maxContacts` per step. */
  readonly contactReportSpeed?: number
  readonly maxContacts?: number
}

export interface PhysicsWorld {
  readonly engine: string
  createBody(desc: BodyDesc): BodyId
  removeBody(id: BodyId): void
  /** Many at once (a blast breaking a wall): one broadphase insert. */
  createBodies(descs: readonly BodyDesc[]): BodyId[]
  setShape(id: BodyId, shape: ShapeDesc): void
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
  /** Joints whose `breakImpulse` was passed in the last step: removed by the adapter, reported once. */
  readonly brokenJoints: readonly JointId[]
  /** Disable contact between sub-ids of a group. Returns the group id. */
  createGroup(subCount: number, disabledPairs: ReadonlyArray<readonly [number, number]>): number
  createVehicle(desc: VehicleDesc): VehicleId
  driveVehicle(id: VehicleId, input: VehicleInput): void
  vehicleBody(id: VehicleId): BodyId
  removeVehicle(id: VehicleId): void
  /** Every hit along the ray, nearest first, into `out` (cleared); returns the count. */
  rayAll(from: Vec3, direction: Vec3, length: number, out: RayHit[], filter?: QueryFilter): number
  rayFirst(from: Vec3, direction: Vec3, length: number, filter?: QueryFilter): RayHit | null
  /** Bodies a sphere overlaps (user values into `out`); returns the count. */
  overlapSphere(center: Vec3, radius: number, out: BodyId[], filter?: QueryFilter): number
  /** A sphere swept along the ray: every body it meets, nearest first. */
  sphereCastAll(from: Vec3, direction: Vec3, length: number, radius: number, out: RayHit[], filter?: QueryFilter): number
  readonly contacts: ContactBuffer
  readonly sensorEvents: readonly SensorEvent[]
  step(dt: number): void
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
