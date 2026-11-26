import type JoltNS from 'jolt-physics/wasm-compat'

import type { BodyId, JointDesc, JointId, Layer, Material, Vec3 } from '@adatechnology/game-physics'

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
}

export interface JointEntry {
  readonly constraint: JoltNS.TwoBodyConstraint
  readonly kind: JointDesc['kind']
  readonly breakImpulse: number
  readonly hinge: JoltNS.HingeConstraint | null
  readonly swing: JoltNS.SwingTwistConstraint | null
  readonly slider: JoltNS.SliderConstraint | null
  /** A ragdoll's own joint: added and removed with its ragdoll. */
  readonly ragdoll: boolean
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
  readonly controller: JoltNS.WheeledVehicleController
  readonly listener: JoltNS.VehicleConstraintStepListener
  readonly tester: JoltNS.VehicleCollisionTester
  /** How many wheels it was made with: a motorbike has 2, and Jolt must not be asked for a third. */
  readonly wheelCount: number
}

export interface JoltCharacter {
  move(vx: number, vz: number, dt: number): void
  push(impulseX: number, impulseZ: number): void
  read(out: Float32Array | Float64Array, offset: number): void
  teleport(x: number, y: number, z: number): void
  supported(): boolean
  dispose(): void
}
