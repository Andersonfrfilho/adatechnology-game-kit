/**
 * @adatechnology/game-physics (spike): the rigid-body contract every package of the kit steps its bodies through, whatever engine sits under it.
 * Types plus tiny helpers. Our own domain layers (materials, damage, fracture, load path, ballistics) stay on top of it.
 */

export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]

/** A shape, in the frame of its body (`offset`, `rotation`). */
export type ShapeDesc =
  | { readonly kind: 'box'; readonly half: Vec3 }
  | { readonly kind: 'sphere'; readonly radius: number }
  /** Along the local y axis: `halfHeight` of the straight part. */
  | { readonly kind: 'capsule'; readonly halfHeight: number; readonly radius: number }
  | { readonly kind: 'cylinder'; readonly halfHeight: number; readonly radius: number }
  | { readonly kind: 'convex'; readonly points: Float32Array }
  | { readonly kind: 'trimesh'; readonly vertices: Float32Array; readonly indices: Uint32Array }
  /** A square grid of `cells` x `cells` over `size` (m), centred on the collider's offset; `heights[iz + ix * (cells + 1)]`, solid below. */
  | { readonly kind: 'heightfield'; readonly cells: number; readonly size: number; readonly heights: Float32Array }

/**
 * The surface of a collider. Engines with one friction coefficient use `dynamic` in the solver; `static` is kept for the kit's own rule on top (a contact slower than
 * the slip speed is held by the static cone), see `PhysicsWorld.frictionModel`.
 */
export interface SurfaceDesc {
  readonly friction: { readonly static: number; readonly dynamic: number }
  readonly restitution: number
}

export interface ColliderDesc {
  readonly shape: ShapeDesc
  readonly offset?: Vec3
  readonly rotation?: Quat
  readonly surface?: SurfaceDesc
  /** A volume that reports overlaps and blocks nothing (smoke, a trigger). */
  readonly sensor?: boolean
  /** Bit of the layer it is on, and the layers it meets (16 bits each). */
  readonly layer?: number
  readonly meets?: number
  /** Ours: who it is in the kit (object and part), handed back by queries and events. */
  readonly tag: number
  /** Reports contacts whose force is over this (N); undefined: no events. */
  readonly contactForceOver?: number
}

export type BodyKind = 'dynamic' | 'fixed' | 'kinematic'

export interface BodyDesc {
  readonly kind: BodyKind
  readonly position: Vec3
  readonly rotation?: Quat
  readonly velocity?: Vec3
  readonly spin?: Vec3
  /** Mass (kg) and principal inertia (kg m^2) about the centre of mass at the body origin; without them the colliders' volume at 1000 kg/m^3. */
  readonly mass?: number
  readonly inertia?: Vec3
  readonly ccd?: boolean
  readonly canSleep?: boolean
  readonly linearDamping?: number
  readonly angularDamping?: number
  readonly colliders: readonly ColliderDesc[]
}

/** Angular limits (rad) about the joint's own axes: x the twist axis, y and z the two swings. */
export interface JointLimits {
  readonly twist?: readonly [number, number]
  readonly swingY?: readonly [number, number]
  readonly swingZ?: readonly [number, number]
}

export interface JointDesc {
  readonly kind: 'fixed' | 'hinge' | 'ball' | 'slider' | 'rope'
  readonly a: number
  readonly b: number
  /** Anchors in each body's frame. */
  readonly anchorA: Vec3
  readonly anchorB: Vec3
  /** The hinge's or slider's axis (body a's frame), the twist axis of a ball. */
  readonly axis?: Vec3
  /** A hinge's or slider's range; a ball's per-axis ranges. */
  readonly range?: readonly [number, number]
  readonly limits?: JointLimits
  readonly length?: number
  /** Whether the two bodies still collide with each other. */
  readonly contacts?: boolean
}

export interface RayHit {
  tag: number
  body: number
  /** Distance along the (unit) direction. */
  distance: number
  normal: Vec3
}

export interface ContactForce {
  readonly tagA: number
  readonly tagB: number
  readonly bodyA: number
  readonly bodyB: number
  /** Total force magnitude of the pair in the step (N), and its direction. */
  readonly force: number
  readonly direction: Vec3
}

export interface QueryFilter {
  /** Layers to hit (bits); default all. */
  readonly layers?: number
  readonly skipSensors?: boolean
  readonly excludeBody?: number
}

export interface PhysicsWorld {
  readonly engine: string
  createBody(desc: BodyDesc): number
  removeBody(body: number): void
  /** Centre of mass position and rotation, written into `out` (x, y, z, qx, qy, qz, qw). */
  readPose(body: number, out: Float64Array, at?: number): void
  readVelocity(body: number, out: Float64Array, at?: number): void
  setPose(body: number, position: Vec3, rotation: Quat): void
  setVelocity(body: number, velocity: Vec3, spin: Vec3): void
  /** For kinematic bodies: where it is at the end of the next step. */
  moveKinematic(body: number, position: Vec3, rotation: Quat): void
  applyImpulse(body: number, impulse: Vec3, point?: Vec3): void
  isSleeping(body: number): boolean
  sleep(body: number): void
  wake(body: number): void
  createJoint(desc: JointDesc): number
  removeJoint(joint: number): void
  /** Fixed step (s): `dt` is split into steps no longer than `maxStep`. */
  step(dt: number): void
  /** Every hit along the ray, nearest first, up to `out.length`; returns how many. Allocates nothing when `out` is reused. */
  rayAll(origin: Vec3, direction: Vec3, maxDistance: number, out: RayHit[], filter?: QueryFilter): number
  /** The nearest hit along the ray, written into `out`; false when nothing. */
  rayFirst(origin: Vec3, direction: Vec3, maxDistance: number, out: RayHit, filter?: QueryFilter): boolean
  /** The first thing a sphere of `radius` meets moving along the ray. */
  sphereCast(origin: Vec3, direction: Vec3, radius: number, maxDistance: number, filter?: QueryFilter): RayHit | null
  /** Tags of everything overlapping a sphere; returns how many. */
  overlapSphere(centre: Vec3, radius: number, out: Int32Array, filter?: QueryFilter): number
  /** Contact forces of the last step over each collider's threshold. The callback's object is reused: copy what you keep. */
  drainContactForces(f: (e: ContactForce) => void): void
  /** Sensors entered/left in the last step. */
  drainSensorEvents(f: (sensorTag: number, otherTag: number, entered: boolean) => void): void
  /** The friction coefficient every collider of the body brings to its contacts now (mixed by geometric mean with the other side). */
  setFriction(body: number, mu: number): void
  /** Lets two bodies pass through each other (false) or meet again (true). */
  setPairContacts(a: number, b: number, enabled: boolean): void
  /** Whether any collider of the body has a contact point now. */
  touching(body: number): boolean
  snapshot(): Uint8Array
  restore(bytes: Uint8Array): void
  readonly frictionModel: 'single-coefficient' | 'static-dynamic'
  dispose(): void
}

export interface WorldOptions {
  readonly gravity: Vec3
  readonly maxStep?: number
  readonly solverIterations?: number
  /** Inner relaxation passes per solver iteration (Rapier: internal PGS iterations), cheaper than more iterations for stiff joints. */
  readonly innerIterations?: number
}

export interface PhysicsEngine {
  readonly name: string
  readonly deterministic: boolean
  createWorld(options: WorldOptions): PhysicsWorld
}

/** Packs an object index and a part index into a collider tag (22 + 9 bits). */
export const packTag = (object: number, part: number): number => (object << 9) | (part & 511)
export const tagObject = (tag: number): number => tag >>> 9
export const tagPart = (tag: number): number => tag & 511

/** Energy height of a body (m): y of the centre of mass plus (|v|^2 + w.Iw/m) / 2g. Constant in free flight; contact with the ground only lowers it. */
export const energyHeight = (y: number, v: Vec3, w: Vec3, inertia: Vec3, mass: number, gravity: number): number =>
  y + (v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + (inertia[0] * w[0] * w[0] + inertia[1] * w[1] * w[1] + inertia[2] * w[2] * w[2]) / mass) / (2 * gravity)
