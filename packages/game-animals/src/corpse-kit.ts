import type { CorpseBodyKit } from '@adatechnology/game-physics'

import { anatomyOf } from './anatomy'
import { chainOfAnimal } from './chain'
import type { RagdollOfAnimalParams } from './ragdoll'
import { ragdollOfAnimal } from './ragdoll'

/** The capsule of R2 is a little thicker than the trunk, which it covers from the tail to the tip of the head. */
const CAPSULE_RADIUS_FACTOR = 1.1
/** Parts of the ragdoll: the trunk, the head, and the front right and hind left upper legs (their middle is the middle of the four legs). */
const ANCHORS = { torso: 0, head: 2, legs: [3, 9] } as const

/**
 * The bodies of a dead quadruped in every rung of the body LOD (spec 008 T5.4), made standing at the origin: the 11-part ragdoll (R0), the three-part chain
 * (R1) and the capsule (R2) along the trunk, with the part indices that tie them. `createCorpseBodies` of `game-physics` carries them to where each one died.
 */
export const corpseBodyKitOfAnimal = (params: Omit<RagdollOfAnimalParams, 'at'>): CorpseBodyKit => {
  const anatomy = anatomyOf(params.body)
  const ragdoll = ragdollOfAnimal({ ...params, at: [0, 0, 0] })
  const chain = chainOfAnimal({ ...params, at: [0, 0, 0] })
  const radius = anatomy.trunk.radius * CAPSULE_RADIUS_FACTOR
  const tail = anatomy.trunk.start[2]
  const tip = Math.max(anatomy.trunk.end[2], anatomy.head.end[2])
  return {
    ragdoll,
    chain,
    capsule: {
      shape: { kind: 'capsule', halfHeight: Math.max(0.01, (tip - tail) / 2 - radius), radius },
      mass: chain.parts.reduce((total, part) => total + (part.body.mass ?? 0), 0),
      // the trunk's local y runs along the body, toward the head; the capsule's middle is the middle of the tail and the tip
      offset: [0, (tip + tail) / 2 - (anatomy.trunk.start[2] + anatomy.trunk.end[2]) / 2, 0],
    },
    anchors: { torso: ANCHORS.torso, head: ANCHORS.head, legs: [ANCHORS.legs[0], ANCHORS.legs[1]] },
  }
}
