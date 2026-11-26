import type { CorpseBodyKit } from '@adatechnology/game-physics'

import { chainOfRig } from './chain'
import type { RagdollOfRigParams } from './ragdoll'
import { ragdollOfRig } from './ragdoll'
import { SEGMENT_TREE } from './segment-tree'
import type { SegmentId } from './segment-tree'

const GUIDE_HEIGHT_METRES = 1.8
/** The capsule of R2 runs from the feet to the top of the head, as thick as the torso of the chain. */
const CAPSULE_RADIUS = 0.17
const CAPSULE_LENGTH = 1.8
/** Where the capsule's centre is, standing, against the chain's torso (torso centre 1.25 m, capsule centre 0.9 m). */
const CAPSULE_OFFSET_Y = -0.35

const indexOfSegment = (id: SegmentId): number => SEGMENT_TREE.findIndex((node) => node.id === id)

/**
 * The bodies of a dead person in every rung of the body LOD (spec 008 T5.4), made standing at the origin: the 17-segment ragdoll (R0), the three-part chain (R1) and the
 * capsule (R2), with the part indices that tie them (the torso, the head and both thighs). `createCorpseBodies` of `game-physics` carries them to where each one died.
 */
export const corpseBodyKit = (params: Omit<RagdollOfRigParams, 'at'>): CorpseBodyKit => {
  const ragdoll = ragdollOfRig({ ...params, at: [0, 0, 0] })
  const chain = chainOfRig({ ...params, at: [0, 0, 0] })
  const scale = params.rig.height / GUIDE_HEIGHT_METRES
  const radius = CAPSULE_RADIUS * scale
  return {
    ragdoll,
    chain,
    capsule: {
      shape: { kind: 'capsule', halfHeight: (CAPSULE_LENGTH * scale) / 2 - radius, radius },
      mass: chain.parts.reduce((total, part) => total + (part.body.mass ?? 0), 0),
      offset: [0, CAPSULE_OFFSET_Y * scale, 0],
    },
    anchors: { torso: indexOfSegment('torso'), head: indexOfSegment('head'), legs: [indexOfSegment('thighL'), indexOfSegment('thighR')] },
  }
}
