import type { RagdollDesc, RagdollPart } from '@adatechnology/game-physics'

import { anatomyOf } from './anatomy'
import type { Bone } from './anatomy'
import { bodyOfBone, bodyOfBox, massOfBone } from './bone-body'
import { ANIMAL_RAGDOLL_LIMITS } from './ragdoll'
import type { RagdollOfAnimalParams } from './ragdoll'

const JOINT_FRICTION = 2

/**
 * The cheap quadruped (R1 of spec 008): trunk, neck and head as one bone, and the four legs as one box under the trunk, three parts on two swing-twist
 * joints (the neck and the hips), made standing at `at` with the same total mass as the ragdoll. The same three parts as a person's chain: the trunk, the
 * head and the legs. Use it with `stabilize`.
 */
export const chainOfAnimal = ({ body, at = [0, 0, 0], user = 0 }: RagdollOfAnimalParams): RagdollDesc => {
  const anatomy = anatomyOf(body)
  const headAndNeck: Bone = { start: anatomy.neck.start, end: anatomy.head.end, radius: Math.max(anatomy.neck.radius, anatomy.head.radius * 0.8) }
  const neck = ANIMAL_RAGDOLL_LIMITS.neck
  const hip = ANIMAL_RAGDOLL_LIMITS.hip
  const neckDirection = [0, anatomy.neck.end[1] - anatomy.neck.start[1], anatomy.neck.end[2] - anatomy.neck.start[2]] as const
  const neckLength = Math.hypot(neckDirection[1], neckDirection[2]) || 1
  const twistAxis: [number, number, number] = [0, neckDirection[1] / neckLength, neckDirection[2] / neckLength]
  const point = (x: number, y: number, z: number): [number, number, number] => [at[0] + x, at[1] + y, at[2] + z]
  const hipHeight = (anatomy.frontHipHeight + anatomy.hindHipHeight) / 2
  const legsMass = anatomy.legs.reduce((sum, leg) => sum + massOfBone(leg.upper) + massOfBone(leg.lower), 0)
  const halfWidth = Math.max(...anatomy.legs.map((leg) => Math.abs(leg.upper.start[0]))) + body.leg.r
  const parts: RagdollPart[] = [
    { body: bodyOfBone(anatomy.trunk, massOfBone(anatomy.trunk), at, user), parent: -1 },
    {
      body: bodyOfBone(headAndNeck, massOfBone(anatomy.neck) + massOfBone(anatomy.head), at, user),
      parent: 0,
      joint: { kind: 'swingTwist', point: point(...anatomy.neck.start), twistAxis, planeAxis: [0, -twistAxis[2], twistAxis[1]], normalHalfCone: neck.sagittal, planeHalfCone: neck.lateral, twistMin: -neck.twist, twistMax: neck.twist, friction: JOINT_FRICTION },
    },
    {
      body: bodyOfBox([halfWidth, hipHeight / 2, anatomy.span / 2 + body.leg.r], [0, hipHeight / 2, 0], legsMass, at, user),
      parent: 0,
      joint: { kind: 'swingTwist', point: point(0, hipHeight, 0), twistAxis: [0, -1, 0], planeAxis: [0, 0, 1], normalHalfCone: hip.sagittal, planeHalfCone: hip.lateral, twistMin: -hip.twist, twistMax: hip.twist, friction: JOINT_FRICTION },
    },
  ]
  return { parts }
}
