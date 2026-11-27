import type JoltNS from 'jolt-physics/wasm-compat'

import type { BodyId, JointDesc, JointId, Layer, Material, Vec3 } from '@adatechnology/game-physics'

import type { Slab } from './seam'

export interface BodyEntry {
  readonly body: JoltNS.Body
  readonly id: JoltNS.BodyID
  /** Its `BodyId` (index and sequence), kept so the contact listener never asks Jolt for it. */
  readonly key: number
  readonly user: number
  readonly layer: Layer
  material: Material
  invMass: number
  /** The mass and moments the kit gave it (dynamic only): kept when its shape changes (`setShape`). */
  kitMass: { readonly mass: number; readonly inertia?: Vec3 } | null
  /** The kit put its centre of mass at the origin (`BodyDesc.centreAtOrigin`): kept when its shape changes. */
  readonly centred: boolean
  /** The engine ragdoll that owns it: it goes with that ragdoll (`removeRagdoll`), never alone. */
  readonly ragdoll?: number
  /** Whether it slides on what it touches (`updateFriction`): its friction is then the dynamic one, else the material's static coefficient. */
  sliding: boolean
  /** The coefficient Jolt holds for it now (`updateFriction`, `SetFriction`). */
  friction: number
  /** Its compound once `setChildShape` made it one whose children change, and the handle of each child by current index (handles do not move when another child goes). */
  /** The rectangle and height of the top face of a flat slab (a static upright box with square edges): what `isSeamContact` tests a contact against. */
  readonly slab?: Slab
  mutable?: JoltNS.MutableCompoundShape
  handles?: number[]
}

/** The contact points of a body asked for with `watchContacts`: x y z, normal, depth, as many as `POINTS_PER_BODY`, of the step in `step`. */
export interface WatchedContacts {
  readonly data: Float32Array
  n: number
  step: number
  /** Its `points` entry was made by watching, so it goes when the watch does. */
  readonly ownsPoints: boolean
}

export interface JointEntry {
  readonly constraint: JoltNS.TwoBodyConstraint
  readonly kind: JointDesc['kind']
  readonly breakImpulse: number
  readonly hinge: JoltNS.HingeConstraint | null
  readonly swing: JoltNS.SwingTwistConstraint | null
  readonly slider: JoltNS.SliderConstraint | null
  /** The ragdoll the joint is one of (added and removed with it), null for a free joint. */
  owner: RagdollEntry | null
}

export interface RagdollEntry {
  readonly ragdoll: JoltNS.Ragdoll
  readonly bodies: readonly BodyId[]
  readonly joints: readonly JointId[]
  /** Its joints taken out of the system by `removeJoint`: put back just before the ragdoll leaves, which removes every joint it made. */
  readonly severed: JoltNS.TwoBodyConstraint[]
}

export interface VehicleEntry {
  readonly body: BodyId
  readonly constraint: JoltNS.VehicleConstraint
  readonly controller: JoltNS.WheeledVehicleController | JoltNS.TrackedVehicleController
  /** A tracked vehicle reads its input as a forward and one ratio per track. */
  readonly tracked: boolean
  readonly listener: JoltNS.VehicleConstraintStepListener
  /** The wheels' friction mix (`vehicles.ts`); null in a world without the kit's JS callbacks. */
  readonly callbacks: JoltNS.VehicleConstraintCallbacksJS | null
  readonly tester: JoltNS.VehicleCollisionTester
  /** How many wheels it was made with: a motorbike has 2, and Jolt must not be asked for a third. */
  readonly wheelCount: number
  /** Seconds the vehicle has been still with no throttle and no steering (`settleVehicles`). */
  quietFor: number
  /** The last `driveVehicle` asked for a throttle or a steer. */
  driven: boolean
}

export interface JoltCharacter {
  move(vx: number, vz: number, dt: number): void
  push(impulseX: number, impulseZ: number): void
  read(out: Float32Array | Float64Array, offset: number): void
  /** Its box (min x y z, max x y z) and horizontal velocity (x z): eight numbers from `offset`. */
  bounds(out: Float64Array, offset: number): void
  teleport(x: number, y: number, z: number): void
  supported(): boolean
  dispose(): void
}
