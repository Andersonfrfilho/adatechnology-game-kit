import type { RagdollDesc, RagdollPart, Vec3 } from '@adatechnology/game-physics'

import type { RagdollOfRigParams } from './ragdoll'

const GUIDE_HEIGHT_METRES = 1.8
/** The same joint friction (N m) as the 17-segment body's (`ragdoll.ts`): a joint with none lets a head swing for minutes and keeps the whole pile's island awake. */
const JOINT_FRICTION = 2

/** The cheap body measured in the spike, for the 1.80 m guide, standing (heights above the feet): torso, head, both legs as one capsule. */
const CHAIN = {
  torso: { halfHeight: 0.25, radius: 0.17, massKg: 40, centreY: 1.25 },
  head: { radius: 0.11, massKg: 5, centreY: 1.75 },
  legs: { halfHeight: 0.3, radius: 0.15, massKg: 25, centreY: 0.45 },
  neckY: 1.62,
  hipY: 0.92,
} as const

/**
 * The cheap body (R1 of spec 008): torso, head and both legs as one capsule, three parts on two swing-twist joints (neck and hip), made
 * standing at `at`, scaled to the rig's height and build. Use it with `stabilize`.
 */
export const chainOfRig = ({ rig, body, build, at = [0, 0, 0], user = 0 }: RagdollOfRigParams): RagdollDesc => {
  const scale = rig.height / GUIDE_HEIGHT_METRES
  const massScale = (rig.height / body.heightMetres) ** 3 * build
  const place = (height: number): Vec3 => [at[0], at[1] + height * scale, at[2]]
  // the surface of R0 and R2 too: with the engine's default the chain bounced four times as much and gripped less
  const common = { layer: 'character', user, material: { frictionStatic: 0.8, frictionDynamic: 0.6, restitution: 0.05 } } as const
  const parts: RagdollPart[] = [
    {
      body: { shape: { kind: 'capsule', halfHeight: CHAIN.torso.halfHeight * scale, radius: CHAIN.torso.radius * scale }, mass: CHAIN.torso.massKg * massScale, position: place(CHAIN.torso.centreY), ...common },
      parent: -1,
    },
    {
      body: { shape: { kind: 'sphere', radius: CHAIN.head.radius * scale }, mass: CHAIN.head.massKg * massScale, position: place(CHAIN.head.centreY), ...common },
      parent: 0,
      joint: { kind: 'swingTwist', point: place(CHAIN.neckY), twistAxis: [0, 1, 0], planeAxis: [0, 0, 1], normalHalfCone: 0.5, planeHalfCone: 0.5, twistMin: -0.5, twistMax: 0.5, friction: JOINT_FRICTION },
    },
    {
      body: { shape: { kind: 'capsule', halfHeight: CHAIN.legs.halfHeight * scale, radius: CHAIN.legs.radius * scale }, mass: CHAIN.legs.massKg * massScale, position: place(CHAIN.legs.centreY), ...common },
      parent: 0,
      joint: { kind: 'swingTwist', point: place(CHAIN.hipY), twistAxis: [0, -1, 0], planeAxis: [0, 0, 1], normalHalfCone: 1.2, planeHalfCone: 1.0, twistMin: -0.4, twistMax: 0.4, friction: JOINT_FRICTION },
    },
  ]
  return { parts }
}
