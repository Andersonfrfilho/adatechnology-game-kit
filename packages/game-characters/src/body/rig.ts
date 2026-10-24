import type { Vec3 } from '@adatechnology/game-contracts'

import { JOINT_IDS } from './body-spec'
import type { BodySpec, JointId } from './body-spec'

/** The bones of the game's instanced body (G 65336): 0 torso and hip, 1 head, 2/3 arms, 4/5 thighs, 6 eyes, 7/8 forearms, 9/10 shins, 11 jaw. */
export const GAME_BONES = {
  torso: 0,
  head: 1,
  upperArmL: 2,
  upperArmR: 3,
  thighL: 4,
  thighR: 5,
  eyes: 6,
  forearmL: 7,
  forearmR: 8,
  shinL: 9,
  shinR: 10,
  jaw: 11,
} as const

export const JOINT_PARENTS: Readonly<Record<JointId, JointId | undefined>> = {
  hip: undefined,
  spine: 'hip',
  neck: 'spine',
  head: 'neck',
  jaw: 'head',
  shoulderL: 'spine',
  shoulderR: 'spine',
  elbowL: 'shoulderL',
  elbowR: 'shoulderR',
  wristL: 'elbowL',
  wristR: 'elbowR',
  hipL: 'hip',
  hipR: 'hip',
  kneeL: 'hipL',
  kneeR: 'hipR',
  ankleL: 'kneeL',
  ankleR: 'kneeR',
}

/** The joints of one body, scaled to its height and build. */
export type Rig = {
  readonly joints: Readonly<Record<JointId, Vec3>>
  readonly parents: Readonly<Record<JointId, JointId | undefined>>
  readonly gameBones: typeof GAME_BONES
  /** Height in metres of this body. */
  readonly height: number
}

export type CreateRigParams = { readonly body: BodySpec; readonly height: number; readonly build: number }

/** Joints of `body` scaled to `height` metres (vertical and depth) and to `build` (width). */
export const createRig = ({ body, height, build }: CreateRigParams): Rig => {
  const scale = height / body.heightMetres
  const joints = Object.fromEntries(
    JOINT_IDS.map((id) => {
      const [x, y, z] = body.joints[id]
      return [id, [x * scale * build, y * scale, z * scale] as Vec3]
    }),
  ) as Record<JointId, Vec3>
  return { joints, parents: JOINT_PARENTS, gameBones: GAME_BONES, height }
}
