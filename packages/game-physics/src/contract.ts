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
  /** `convexRadius` rounds the edges (the engine's default is a fifth of the thinnest half, up to 5 cm); 0 for a fixed box, whose seams with its neighbours would be grooves. */
  | { readonly kind: 'box'; readonly half: Vec3; readonly convexRadius?: number }
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
  | {
      readonly kind: 'compound'
      readonly children: ReadonlyArray<{ readonly shape: ShapeDesc; readonly position: Vec3; readonly rotation?: Quat; readonly tag?: number }>
      /**
       * An untagged convex child whose points a hull made earlier already has (to the bit) is that hull, not a new one: for a compound made again and again from mostly the same
       * hulls, where building a hull is what a new compound costs. The adapter holds a bounded number of them. Nothing in the kit asks for it since the solid under the ground
       * became boxes (spec 008 T3.8ag); kept, tested (`game-physics-jolt` `hull-cache.test.ts`), for a host whose compound of hulls is made again often.
       */
      readonly reuseHulls?: boolean
      /** Children can be replaced, moved and taken out later (`setChildShape`); a compound that is not is still made mutable by its first `setChildShape`. Not with `centreAtOrigin`. */
      readonly mutable?: boolean
    }
  /** A compound held by the engine (`createSharedShape`): every body made from it uses the same one, until its first `setChildShape` gives that body a copy of its own. */
  | { readonly kind: 'shared'; readonly id: SharedShapeId }

/** A rectangle of height field samples: from sample (`x`, `z`), `sizeX` by `sizeZ` of them. */
export interface HeightRegion {
  readonly x: number
  readonly z: number
  readonly sizeX: number
  readonly sizeZ: number
}

export type Motion = 'static' | 'kinematic' | 'dynamic'

/**
 * What the body is, for filtering. The adapter maps layers to its broadphase; `collides` is the default pair table (`LAYER_PAIRS`).
 * `sensor` bodies report overlap and never push.
 */
export type Layer = 'static' | 'debris' | 'prop' | 'character' | 'agent' | 'vehicle' | 'sensor' | 'corpse'
export const LAYERS: readonly Layer[] = ['static', 'debris', 'prop', 'character', 'agent', 'vehicle', 'sensor', 'corpse']

/**
 * Which layers meet (symmetric). Crowd agents (kinematic, driven by game-crowd) do not meet each other: game-crowd separates them itself. They do not meet a `vehicle`
 * either: a parked car must not stop on a person, and running one over is the host's own query (veiculos.md 7.8), not a contact. A `corpse` (a dead body of any
 * rung of the body LOD) meets the fixed world, debris, props, characters and vehicles, other corpses, and sensors, and not agents: a horde climbing a pile does not shove it.
 */
export const LAYER_PAIRS: ReadonlyArray<readonly [Layer, Layer]> = [
  ['static', 'debris'], ['static', 'prop'], ['static', 'character'], ['static', 'vehicle'],
  ['debris', 'debris'], ['debris', 'prop'], ['debris', 'character'], ['debris', 'vehicle'], ['debris', 'agent'],
  ['prop', 'prop'], ['prop', 'character'], ['prop', 'vehicle'], ['prop', 'agent'],
  ['character', 'character'], ['character', 'vehicle'], ['character', 'agent'],
  ['vehicle', 'vehicle'],
  ['sensor', 'debris'], ['sensor', 'prop'], ['sensor', 'character'], ['sensor', 'agent'], ['sensor', 'vehicle'],
  ['corpse', 'static'], ['corpse', 'debris'], ['corpse', 'prop'], ['corpse', 'character'], ['corpse', 'vehicle'], ['corpse', 'sensor'], ['corpse', 'corpse'],
]

/** Coulomb friction of a surface: static (what holds it still) and dynamic (what drags it while it slides). Mixed by geometric mean. */
export interface Material {
  readonly frictionStatic: number
  readonly frictionDynamic: number
  readonly restitution: number
  /** The surface's rolling resistance (C_rr): a round body rolling on it takes the larger of its own (`Rolling.coefficient`) and the surface's, as the softer surface decides. */
  readonly rolling?: number
  /**
   * The surface's rolling damping (1/s): a round body rolling on it loses this share of its spin per second, on top of `rolling`, as grass blades, sand and a soft body
   * drag more the faster it rolls. Added to the body's own (`Rolling.damping`): both surfaces lose energy in the contact.
   */
  readonly rollingDamping?: number
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
  /** The body's own rolling damping (1/s, `Material.rollingDamping`): while it touches something its spin decays by exp(-(own + surface's) t). Default 0. */
  readonly damping?: number
}

/** An opaque handle; the adapter owns what it points to. */
export type BodyId = number & { readonly __body: unique symbol }
export type JointId = number & { readonly __joint: unique symbol }
export type VehicleId = number & { readonly __vehicle: unique symbol }
export type CharacterId = number & { readonly __character: unique symbol }

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
  /** Born asleep (a body of a pile that was put down, a loaded game): it wakes when something touches it or `wake` is called. Default awake. */
  readonly sleeping?: boolean
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
  /** Grip along the wheel by slip ratio (0 = rolling, 1 = locked): (slip, grip coefficient) pairs, slip rising. The engine's own curve when omitted. */
  readonly longitudinalFriction?: Curve
  /** Grip across the wheel by slip angle in degrees (0 to 90): (angle, grip coefficient) pairs, angle rising. The engine's own curve when omitted. */
  readonly lateralFriction?: Curve
  /** Rotational inertia of the wheel and its spin damping (kg m^2, 1/s). */
  readonly inertia?: number
  readonly angularDamping?: number
}

/** A piecewise-linear curve: (x, y) pairs with x rising. */
export type Curve = ReadonlyArray<readonly [number, number]>

export type VehicleController = 'wheeled' | 'motorcycle' | 'tracked'

/** One differential: the two wheels it drives (indices into `wheels`; `right` -1 for a wheel alone), its gearing and how it shares and holds the torque. */
export interface DifferentialDesc {
  readonly left: number
  readonly right: number
  /** `differentialRatio` of the vehicle when omitted. */
  readonly ratio?: number
  /** How much more torque the wheel with the grip may take than the other (1 = locked together, large = open); the engine's own when omitted. */
  readonly limitedSlip?: number
  /** Share of the engine torque this differential takes, against the others' shares (they are normalised). */
  readonly torqueShare?: number
}

/** Gearbox timing; each is the engine's own when omitted. */
export interface TransmissionDesc {
  readonly shiftUpRpm?: number
  readonly shiftDownRpm?: number
  /** Seconds a shift takes, and how long the clutch takes to close after it. */
  readonly switchTime?: number
  readonly clutchReleaseTime?: number
  /** Seconds to wait after a shift before the next one. */
  readonly switchLatency?: number
  readonly clutchStrength?: number
}

/** A motorcycle's lean (`controller: 'motorcycle'`); each is the engine's own when omitted. */
export interface MotorcycleDesc {
  /** Rad. */
  readonly maxLeanAngle?: number
  readonly leanSpring?: number
  readonly leanDamping?: number
}

/** One side of a tracked vehicle: the wheels (indices) the track runs over, the one that drives it, and its grip and brake. */
export interface TrackDesc {
  readonly wheels: readonly number[]
  readonly drivenWheel: number
  readonly longitudinalFriction?: number
  readonly lateralFriction?: number
  readonly maxBrakeTorque?: number
  readonly differentialRatio?: number
}

export interface VehicleDesc {
  readonly chassis: BodyDesc
  readonly wheels: readonly WheelDesc[]
  /** The kind of controller; a car's (`wheeled`) when omitted. `tracked` takes `tracks`, reads `right` as the steer (a pivot at 0 forward) and ignores the wheels' `driven`. */
  readonly controller?: VehicleController
  /** The left track (the +x side of the chassis, forward +z and up +y), then the right one. */
  readonly tracks?: readonly [TrackDesc, TrackDesc]
  readonly motorcycle?: MotorcycleDesc
  /** Engine torque by rpm / `maxRpm`, as a fraction of `maxTorque`: (x, y) pairs. The engine's own when omitted. */
  readonly torqueCurve?: Curve
  readonly engineInertia?: number
  /** The engine's own friction (N m s/rad: torque lost per rad/s of its speed); the engine's own value is large (0.2: 85 N m at 4 000 rpm) and takes half the torque of a small engine. */
  readonly engineDamping?: number
  readonly transmission?: TransmissionDesc
  /** One per driven axle, derived from the wheels when omitted. */
  readonly differentials?: readonly DifferentialDesc[]
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

/** What `applyBuoyancy` needs of the water. */
export interface FluidDesc {
  readonly surface: Vec3
  readonly normal: Vec3
  readonly buoyancy: number
  readonly linearDrag: number
  readonly angularDrag: number
  readonly flow?: Vec3
}

/** A shape made once and held by the engine (`createSharedShape`), for bodies that stay whole to share: a parked car's hulls. */
export type SharedShapeId = number & { readonly __sharedShape: unique symbol }

/** What `readContacts` writes per point: x, y, z of the point (world), the normal (unit, out of the other body, into this one), the penetration depth (m). */
export const CONTACT_READ_STRIDE = 7

/** Where each reading of a wheel sits in what `vehicleWheels` writes: `WHEEL_READ_STRIDE` numbers per wheel, in the order the wheels were listed. */
export const WHEEL_READ = {
  /** 1 when the wheel touches something, else 0. */
  CONTACT: 0,
  /** The `BodyId` it stands on, -1 for none. */
  BODY: 1,
  /** Rolling angle (rad). */
  ANGLE: 2,
  /** Steering angle (rad). */
  STEER: 3,
  /** Spin (rad/s). */
  SPIN: 4,
  /** Suspension length now (m): between `suspensionMin` and `suspensionMax`. */
  COMPRESSION: 5,
  /** Rim speed minus ground speed along the wheel (m/s): a wheel spin or a lock. 0 off the ground. */
  SLIP_LONGITUDINAL: 6,
  /** Ground speed across the wheel (m/s). 0 off the ground. */
  SLIP_LATERAL: 7,
  /** The three impulses the solver applied in the last step (N s): the spring, the drive and brake along the wheel, the grip across it. */
  SUSPENSION_IMPULSE: 8,
  LONGITUDINAL_IMPULSE: 9,
  LATERAL_IMPULSE: 10,
} as const
export const WHEEL_READ_STRIDE = 11

/** A dynamic body's mass properties as the kit holds them: what a part that came off takes from the chassis, what a settled crash moves. */
export interface MassProperties {
  readonly mass: number
  /** Moments about the principal axes of the body's frame (kg m^2). */
  readonly inertia: Vec3
  /** The new centre of mass, in the body's frame (the frame of its shape): the body's shape stays where it is in the world. Omit to keep it. */
  readonly centreOfMass?: Vec3
}

/**
 * A walking capsule: not a body. It moves by sweeps against the world, steps up what is `stepHeight` or lower, climbs slopes up to `maxSlopeDegrees`, sticks
 * to the floor going down, falls under gravity and pushes dynamic bodies with at most `strength` N. Moved by `moveCharacter` once per fixed step, in the loop's `actors` phase.
 */
export interface CharacterDesc {
  /** Where the feet are. */
  readonly position: Vec3
  readonly radius: number
  /** Half the straight part of the capsule (its height is `2 * (halfHeight + radius)`). */
  readonly halfHeight: number
  /** What it weighs (kg): what a body that pushes back feels. */
  readonly mass: number
  /** Most force (N) it pushes a dynamic body with: 400 N moves a 30 kg crate over wood, not a wardrobe. */
  readonly strength: number
  /** Default 0.4 m. */
  readonly stepHeight?: number
  /** Default 45 degrees: steeper ground it slides down. */
  readonly maxSlopeDegrees?: number
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
  /** Bodies the query leaves out before the narrow phase (a corpse asking what is in its way does not meet its own parts). */
  readonly ignore?: readonly BodyId[]
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

/** Numbers in a row of `PhysicsWorld.readAwakeBounds`, and what its first number says the row is. */
export const AWAKE_BOUNDS_STRIDE = 10
export const AWAKE_KIND_BODY = 0
export const AWAKE_KIND_CHARACTER = 1

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
  /**
   * Static height field body only: the field's heights are now `heights` (all of them, as in `ShapeDesc` `heightfield`, origin height included) and only the samples of
   * `region` differ from what the body holds. The shape is changed in place, so it costs the region and not the field. Returns false and changes nothing when the engine
   * cannot do it so (not a height field, a region off the field, a height outside the range the field was made with): the caller then gives the body a whole new shape
   * (`setShape`).
   */
  updateHeights(id: BodyId, region: HeightRegion, heights: ArrayLike<number>): boolean
  /** A dynamic body's mass now, kg: the engine's own for a ragdoll's parts (`stabilize` evens them out), the kit's for the rest. */
  massOf(id: BodyId): number
  /** Writes x, y, z then x, y, z, w into `out` at `offset`. */
  readPose(id: BodyId, out: Float32Array | Float64Array, offset: number): void
  readVelocity(id: BodyId, out: Float32Array | Float64Array, offset: number): void
  setPose(id: BodyId, position: Vec3, rotation: Quat, wake: boolean): void
  setVelocity(id: BodyId, linear: Vec3, angular: Vec3): void
  /** Kinematic: reach this pose at the end of the next step (it pushes what it meets). */
  moveKinematic(id: BodyId, position: Vec3, rotation: Quat, dt: number): void
  addImpulse(id: BodyId, impulse: Vec3, point?: Vec3): void
  isSleeping(id: BodyId): boolean
  /** The ids of the awake rigid bodies in one crossing, into `out` (its length is set to the count; reused); returns the count. */
  readActiveBodies(out: BodyId[]): number
  wake(id: BodyId): void
  sleep(id: BodyId): void
  /** Wakes every dynamic body whose bounds touch the box (ground dug, a support removed). */
  wakeInBox(min: Vec3, max: Vec3): void
  setMaterial(id: BodyId, material: Material): void
  /** A body's rolling resistance from now on (`undefined`: none). */
  setRolling(id: BodyId, rolling: Rolling | undefined): void
  /** Dynamic <-> kinematic (a piece picked up and put down). */
  setMotion(id: BodyId, motion: 'kinematic' | 'dynamic'): void
  /** Swept collision from now on (`BodyDesc.continuous`) or discrete again: a thrown piece is fast and small. */
  setContinuous(id: BodyId, continuous: boolean): void
  /** The points (world, x y z each) where the body touched anything in the last step, into `out`; returns how many points (at most `out.length / 3`). */
  contactPoints(id: BodyId, out: Float32Array): number
  /** Whether the body touched anything in the last step. */
  touching(id: BodyId): boolean
  /** The two bodies stop meeting (true) or meet again (false): our rule handles the pair (chunks born inside each other go apart along the ground). */
  ignorePair(a: BodyId, b: BodyId, ignore: boolean): void
  createJoint(desc: JointDesc): JointId
  /** The joint goes. A ragdoll's own joint too (a limb torn off): its two sides stay bodies of that ragdoll, free of each other, and leave with it (`removeRagdoll`). */
  removeJoint(id: JointId): void
  /** Angles of a joint now (radians), for checking limits: `hinge` for hinge, fixed and ragdoll hinge joints; `swing` and `twist` for swing-twist; 0 for the rest. */
  jointAngles(id: JointId): { swing: number; twist: number; hinge: number }
  /** Whether the joint is still in the world: false once it broke (for good, unlike `brokenJoints`, which holds a frame) or was removed. */
  jointExists(id: JointId): boolean
  /** Joints whose `breakImpulse` was passed in the last step: removed by the adapter, reported once. */
  readonly brokenJoints: readonly JointId[]
  /** Its bodies (in part order) and its joints (one per part but the root, in part order), for reading poses and `jointAngles`. */
  createRagdoll(desc: RagdollDesc): { readonly id: RagdollId; readonly bodies: readonly BodyId[]; readonly joints: readonly JointId[] }
  removeRagdoll(id: RagdollId): void
  /** Disable contact between sub-ids of a group. Returns the group id. */
  createGroup(subCount: number, disabledPairs: ReadonlyArray<readonly [number, number]>): number
  /** Lets go of a group made by `createGroup` once none of its bodies is left (remove them first): the id may come back from the next `createGroup`. */
  releaseGroup(id: number): void
  createVehicle(desc: VehicleDesc): VehicleId
  driveVehicle(id: VehicleId, input: VehicleInput): void
  vehicleBody(id: VehicleId): BodyId
  removeVehicle(id: VehicleId): void
  /**
   * Makes the vehicle's constraint again over the same chassis body (a wheel lost, an axle bent): `desc.wheels` and the engine are read, `desc.chassis` is not.
   * The chassis keeps its pose, speed and shape; a wheel that was there keeps its spin. `removeVehicle` still takes everything.
   */
  rebuildVehicle(id: VehicleId, desc: VehicleDesc): void
  /** What each wheel is doing now, `WHEEL_READ_STRIDE` numbers a wheel (`WHEEL_READ`) into `out`; returns how many wheels. */
  vehicleWheels(id: VehicleId, out: Float64Array): number
  /** Holds a shape for bodies to share (`ShapeDesc` `shared`). A compound is the use of it; the engine keeps one copy however many bodies use it. */
  createSharedShape(shape: ShapeDesc): SharedShapeId
  /** Lets go of it: bodies already made from it keep it until they go. */
  releaseSharedShape(id: SharedShapeId): void
  /**
   * Replaces child `child` of a compound body (its index in the `children` the body was made with: it does not move when another child goes) by `shape`, put at `pose`
   * (the child's own if omitted), or takes it out (`null`). A body made from a shared shape gets its own copy first, so the others keep the whole one. The kit's mass and
   * inertia stay: change them with `setMassProperties`.
   */
  setChildShape(id: BodyId, child: number, shape: ShapeDesc | null, pose?: { readonly position: Vec3; readonly rotation?: Quat }): void
  /** A dynamic body's mass, inertia and (when given) centre of mass from now on. */
  setMassProperties(id: BodyId, properties: MassProperties): void
  /** Swept collision (`linearCast`: nothing gets through a thin wall) or the plain kind: a fast car, a fast part, a plane. */
  setMotionQuality(id: BodyId, quality: 'discrete' | 'linearCast'): void
  /** From the next step the body's contact points are kept with their normal and depth (`readContacts`); off again when it stops being watched. */
  watchContacts(id: BodyId, on: boolean): void
  /** The watched body's contact points of the last step (`CONTACT_READ_STRIDE` numbers each) into `out`; returns how many points (at most what `out` holds). */
  readContacts(id: BodyId, out: Float32Array): number
  createCharacter(desc: CharacterDesc): CharacterId
  /**
   * Walks it for one fixed step `dt` at the wanted horizontal velocity (m/s, world x and z; 0 stands still) plus what `pushCharacter` gave it. The caller
   * calls it before `stepFixed` (a `beforeStep` of the loop), never with the frame's `dt`.
   */
  moveCharacter(id: CharacterId, velocityX: number, velocityZ: number, dt: number): void
  /** Shoves it: `impulse` (N s, horizontal part) is a change of velocity of impulse / mass that fades in about a quarter of a second and cannot go through a wall. */
  pushCharacter(id: CharacterId, impulse: Vec3): void
  /** Feet position into `out` at `offset` (x, y, z). */
  readCharacter(id: CharacterId, out: Float32Array | Float64Array, offset: number): void
  /** Puts the feet here at once (a respawn, a loaded game, the end of a vault), with no sweep and no speed carried over. */
  teleportCharacter(id: CharacterId, position: Vec3): void
  /** Whether the feet stand on something. */
  characterSupported(id: CharacterId): boolean
  removeCharacter(id: CharacterId): void
  /**
   * Floats a body in a fluid for one fixed step: call it in a `beforeStep` while it is in the water. `surface` is a point of the water plane, `normal` its up; `buoyancy`
   * is 1 for a body that floats with its density equal to the water's, more for lighter; the drags slow it through the water; `flow` is the water's own velocity.
   * Returns false when nothing of the body is below the surface.
   */
  applyBuoyancy(id: BodyId, fluid: FluidDesc): boolean
  /** How many of the vehicle's wheels touch the ground now (a car with none is airborne: its sleep rule reads this). */
  wheelContacts(id: VehicleId): number
  /** Every hit along the ray, nearest first, into `out` (cleared); returns the count. */
  rayAll(from: Vec3, direction: Vec3, length: number, out: RayHit[], filter?: QueryFilter): number
  rayFirst(from: Vec3, direction: Vec3, length: number, filter?: QueryFilter): RayHit | null
  /** Bodies a sphere overlaps (user values into `out`); returns the count. */
  overlapSphere(center: Vec3, radius: number, out: BodyId[], filter?: QueryFilter): number
  /**
   * The bodies (all but sensors) in `filter`'s layers that a shape overlaps when put at `position` with `rotation`, into `out` (cleared; each body once); returns the count.
   * For asking before making a body: nothing is made inside what is there. Compound shapes, convex hulls and the rest of `ShapeDesc` work; a trimesh or height field does not (they do not move).
   */
  overlapShape(shape: ShapeDesc, position: Vec3, rotation: Quat, out: BodyId[], filter?: QueryFilter): number
  /**
   * The bodies this one touches now (resting contact too, which `contacts` does not report: it holds only the ones that closed fast), into `out` (cleared); returns the count.
   * A sensor is overlapped, never touched, and is not listed.
   */
  contactBodies(id: BodyId, out: BodyId[]): number
  /**
   * How deep (m) a body is inside the fixed bodies (layer `static`) where it stands now, and the way to move it out (unit, world) into `out`; 0 when it is in none.
   * The deepest overlap is reported: a host that places a body checks it, so nothing is made or put inside what does not move. `among` counts only those bodies.
   */
  penetration(id: BodyId, out: Float64Array, among?: ReadonlySet<BodyId>): number
  /** A sphere swept along the ray: every body it meets, nearest first. */
  sphereCastAll(from: Vec3, direction: Vec3, length: number, radius: number, out: RayHit[], filter?: QueryFilter): number
  /**
   * The bounds and the horizontal speed of what moves in the world, for a host that keeps ground under it: one row of `AWAKE_BOUNDS_STRIDE` numbers per awake dynamic body
   * and per character (`AWAKE_KIND_BODY` or `AWAKE_KIND_CHARACTER`, its id, min x y z, max x y z, vx, vz). A kinematic body is not listed, nor a body in `skip`.
   * Returns how many rows there are and writes only the ones that fit `out`: a caller that gets more than `out` holds grows it and reads again. A solver with
   * no such view returns 0.
   */
  readAwakeBounds(out: Float64Array, skip?: ReadonlySet<BodyId>): number
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
