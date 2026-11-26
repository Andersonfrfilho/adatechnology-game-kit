import { KIT_RAGDOLL_SOLVER } from '@adatechnology/game-physics'
import type { BodyId, JointId, PhysicsWorld, Quat, RagdollId, RagdollPart, ShapeDesc, Vec3 } from '@adatechnology/game-physics'

import { chainOfRig } from './chain'
import { ragdollOfRig } from './ragdoll'
import type { RagdollOfRigParams } from './ragdoll'
import { conjugate, rotateBy, subtract } from './rigid'
import { SEGMENT_IDS, SEGMENT_TREE } from './segment-tree'
import type { SegmentId } from './segment-tree'

export type DollTier = 'R0' | 'R1'

/** One engine body of a doll and the segments it stands for (R0: one each; R1: the torso carries the trunk and the arms, the legs both legs, the head the head and the jaw). */
export type DollPart = {
  readonly segments: readonly SegmentId[]
  readonly body: BodyId
  /** Index in the doll's `parts` (parents first), -1 for the root. */
  readonly parent: number
  readonly joint: JointId | undefined
  readonly shape: ShapeDesc
  /** What the kit means the part to weigh, kg: the sum over a character is its body mass (the engine's `stabilize` evens the real ones out a little). */
  readonly mass: number
  /** Where it was made, standing: the frame pieces drawn on it are carried from. */
  readonly made: { readonly position: Vec3; readonly rotation: Quat }
  /** Sign of the capsule's local y that points away from the joint (a cut keeps the joint's side). */
  readonly distal: 1 | -1
}

/** A body (or a piece of one) in the world: engine bodies in one engine ragdoll, parents first. Pieces torn off come back as dolls of their own. */
export type Doll = {
  readonly ragdoll: RagdollId
  readonly parts: readonly DollPart[]
  /** The 17 segments standing (`ragdollOfRig`), indexed as `SEGMENT_TREE`: what a piece drawn on a carrier is made from. */
  readonly designed: readonly RagdollPart[]
}

export type DollOfParams = {
  readonly world: PhysicsWorld
  readonly parts: readonly RagdollPart[]
  readonly segments: readonly (readonly SegmentId[])[]
  readonly designed: readonly RagdollPart[]
  readonly solverSteps?: { readonly velocity: number; readonly position: number }
  /** Default true. A piece torn off is made without it: its masses are exactly what the body gave up. */
  readonly stabilize?: boolean
}

export type CreateDollParams = RagdollOfRigParams & { readonly world: PhysicsWorld; readonly tier: DollTier }

const R1_HEAD: readonly SegmentId[] = ['head', 'jaw']
const R1_LEGS: readonly SegmentId[] = SEGMENT_TREE.filter((node) => node.region === 'legL' || node.region === 'legR').map((node) => node.id)
const R1_TRUNK: readonly SegmentId[] = SEGMENT_IDS.filter((id) => !R1_HEAD.includes(id) && !R1_LEGS.includes(id))

const SEGMENTS_OF: Record<DollTier, readonly (readonly SegmentId[])[]> = {
  R0: SEGMENT_IDS.map((id) => [id]),
  R1: [R1_TRUNK, R1_HEAD, R1_LEGS],
}

/** Which way along the capsule's local y the part runs from its joint: the side a cut keeps is the joint's. */
export const distalSignOf = (part: RagdollPart): 1 | -1 => {
  if (!part.joint) return 1
  const local = rotateBy(conjugate(part.body.rotation ?? [0, 0, 0, 1]), subtract(part.body.position, part.joint.point))
  return local[1] < 0 ? -1 : 1
}

/** The parts made as one engine ragdoll, stabilized; `segments[i]` are the segments part `i` stands for. */
export const dollOf = (params: DollOfParams): Doll => {
  const { world, parts, segments, designed, solverSteps, stabilize = true } = params
  const made = world.createRagdoll({ parts, stabilize, ...(solverSteps ? { solverSteps } : {}) })
  let jointIndex = 0
  return {
    ragdoll: made.id,
    designed,
    parts: parts.map((part, index): DollPart => ({
      segments: segments[index] ?? [],
      body: made.bodies[index] as BodyId,
      parent: part.parent,
      joint: part.joint ? made.joints[jointIndex++] : undefined,
      shape: part.body.shape,
      mass: part.body.mass ?? 0,
      made: { position: part.body.position, rotation: part.body.rotation ?? [0, 0, 0, 1] },
      distal: distalSignOf(part),
    })),
  }
}

/** A doll made as the engine's ragdoll, stabilized: R0 (17 segments, the kit's ragdoll passes) or R1 (the three-part chain). */
export const createDoll = ({ world, tier, ...params }: CreateDollParams): Doll => {
  const designed = ragdollOfRig(params).parts
  const parts = tier === 'R0' ? designed : chainOfRig(params).parts
  return dollOf({ world, parts, segments: SEGMENTS_OF[tier], designed, ...(tier === 'R0' ? { solverSteps: KIT_RAGDOLL_SOLVER } : {}) })
}
