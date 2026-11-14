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
  /** A ragdoll's own joint: added and removed with its ragdoll. */
  readonly ragdoll: boolean
}

export interface RagdollEntry {
  readonly ragdoll: JoltNS.Ragdoll
  readonly bodies: readonly BodyId[]
  readonly joints: readonly JointId[]
}

export interface VehicleEntry {
  readonly body: BodyId
  readonly constraint: JoltNS.VehicleConstraint
  readonly controller: JoltNS.WheeledVehicleController
  readonly listener: JoltNS.VehicleConstraintStepListener
  readonly tester: JoltNS.VehicleCollisionTester
}

export interface JoltCharacter {
  update(dt: number, vx: number, vz: number): void
  position(out: Float64Array): void
  supported(): boolean
  dispose(): void
}
