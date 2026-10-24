import type { SegmentKind, Vec3 } from '@adatechnology/game-contracts'

import body from '../data/body.json'

/** The 17 joints of a body: one per segment, the point the segment hangs from. */
export type JointId =
  | 'hip'
  | 'spine'
  | 'neck'
  | 'head'
  | 'jaw'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR'

export const JOINT_IDS: readonly JointId[] = ['hip', 'spine', 'neck', 'head', 'jaw', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR']

/**
 * Proportions of a body: joint positions in metres for a body of `heightMetres`, standing, feet on y = 0, facing +z, left side on +x.
 * `segmentRadius` is the radius of the capsule a segment is hit through.
 */
export type BodySpec = {
  readonly id: string
  readonly heightMetres: number
  readonly joints: Readonly<Record<JointId, Vec3>>
  readonly segmentRadius: Readonly<Record<SegmentKind, number>>
}

const SEGMENT_RADIUS: Readonly<Record<SegmentKind, number>> = {
  head: 0.1,
  jaw: 0.05,
  neck: 0.06,
  torso: 0.17,
  pelvis: 0.16,
  upperArm: 0.085,
  forearm: 0.065,
  hand: 0.05,
  thigh: 0.1,
  shin: 0.08,
  foot: 0.05,
}

const { guide } = body
const shoulderX = guide.shoulderWidthMetres / 2
const shoulderY = guide.shoulderHeightMetres

/** The Elenco style guide body (1.80 m, shoulders 0.61 m at 1.475 m, head about 1/6 of the height): the default. */
export const GUIDE: BodySpec = {
  id: 'guide',
  heightMetres: guide.heightMetres,
  joints: {
    hip: [0, 0.92, 0],
    spine: [0, 1.05, 0],
    neck: [0, 1.56, 0],
    head: [0, 1.64, 0],
    jaw: [0, 1.66, 0.06],
    shoulderL: [shoulderX, shoulderY, 0],
    shoulderR: [-shoulderX, shoulderY, 0],
    elbowL: [shoulderX, shoulderY - 0.31, 0],
    elbowR: [-shoulderX, shoulderY - 0.31, 0],
    wristL: [shoulderX, shoulderY - 0.61, 0],
    wristR: [-shoulderX, shoulderY - 0.61, 0],
    hipL: [0.105, 0.9, 0],
    hipR: [-0.105, 0.9, 0],
    kneeL: [0.105, 0.48, 0],
    kneeR: [-0.105, 0.48, 0],
    ankleL: [0.105, 0.1, 0],
    ankleR: [-0.105, 0.1, 0],
  },
  segmentRadius: SEGMENT_RADIUS,
}

const J = body.teamGame.joints
const below = (point: readonly number[], drop: number): Vec3 => [point[0], point[1] - drop, point[2]]

/**
 * The game's crowd body (G 65336 `J`, shoulders ±0.24 m), kept for the goldens of the instanced path. `J` has no spine, head, jaw, wrist or
 * ankle: spine and head sit on the hip and neck bones (bones 0 and 1 of the game), the wrist and ankle one forearm and one shin below.
 */
export const TEAM_GAME: BodySpec = {
  id: 'team-game',
  heightMetres: body.teamGame.heightMetres,
  joints: {
    hip: J.quadril as Vec3,
    spine: J.quadril as Vec3,
    neck: J.pescoco as Vec3,
    head: J.pescoco as Vec3,
    jaw: [0, J.pescoco[1] + 0.08, 0.06],
    shoulderL: J.ombroE as Vec3,
    shoulderR: J.ombroD as Vec3,
    elbowL: J.cotoveloE as Vec3,
    elbowR: J.cotoveloD as Vec3,
    wristL: below(J.cotoveloE, 0.3),
    wristR: below(J.cotoveloD, 0.3),
    hipL: J.coxaE as Vec3,
    hipR: J.coxaD as Vec3,
    kneeL: J.joelhoE as Vec3,
    kneeR: J.joelhoD as Vec3,
    ankleL: below(J.joelhoE, 0.42),
    ankleR: below(J.joelhoD, 0.42),
  },
  segmentRadius: SEGMENT_RADIUS,
}

/** A body spec from `base` (default `GUIDE`) with the given fields replaced; `joints` and `segmentRadius` merge key by key. */
export const createBodySpec = (patch: Partial<BodySpec> = {}, base: BodySpec = GUIDE): BodySpec => ({
  id: patch.id ?? base.id,
  heightMetres: patch.heightMetres ?? base.heightMetres,
  joints: { ...base.joints, ...patch.joints },
  segmentRadius: { ...base.segmentRadius, ...patch.segmentRadius },
})
