import gait from '../data/gait.json'

/** How a body type walks: offsets over its rest pose (the Bestiário's `GAIT`). `f` cycles per second, `a` thigh swing, `k` knee bend, `arm` arm swing. */
export type GaitProfile = {
  readonly f: number
  readonly a?: number
  readonly k?: number
  readonly arm?: number
  readonly bob?: number
  readonly sway?: number
  readonly drag?: boolean
  readonly crawl?: boolean
  readonly idle?: boolean
  readonly eat?: boolean
  readonly leap?: boolean
  readonly listen?: boolean
  readonly stalk?: boolean
  readonly sniff?: boolean
}

export type JointAngles = { readonly shoulder: number; readonly elbow: number }
export type LegAngles = { readonly hip: number; readonly knee: number; readonly lost?: boolean }

/**
 * The pose the gait swings around. `arms[0]` is the right arm and `arms[1]` the left; `legs[0]` is the left leg and `legs[1]` the right
 * (the order the Bestiário builds them in). `hipY` is the rest height of the hips.
 */
export type RestPose = {
  readonly hipY: number
  readonly lean: number
  readonly headX: number
  readonly arms: readonly [JointAngles, JointAngles]
  readonly legs: readonly [LegAngles, LegAngles]
}

/** What a gait sets this frame; a field the gait does not write stays `undefined` and the joint keeps what it had. */
export type GaitSample = {
  hipY?: number
  upper: { x?: number; y?: number; z?: number }
  head: { x?: number; y?: number }
  arms: { shoulder?: number; elbow?: number }[]
  legs: { hip?: number; knee?: number }[]
}

export const emptySample = (): GaitSample => ({ upper: {}, head: {}, arms: [{}, {}], legs: [{}, {}] })

export type CascadeJoint = keyof typeof gait.cascade

/** Cascade rates per joint (1/s): each joint reaches its target with a delay, from the hips to the head (Bestiário 12.3). */
export const CASCADE: Readonly<Record<CascadeJoint, number>> = gait.cascade

/** The 8 poses of the instanced body, in the order of the game's `iB.w`. */
export const INSTANCE_POSES = ['walk', 'crawl', 'fallen', 'attack', 'scream', 'crouch', 'leap', 'eat'] as const
export type InstancePose = (typeof INSTANCE_POSES)[number]

const MIN_HEIGHT = -2
const MAX_HEIGHT = 8
const HEIGHT_STEPS = 1000
const POSE_SLOTS = 16

/** `iB.w` of the instanced body: the pose plus 16 times the ground height in millimetres (a pile of bodies, a jump). */
export const encodePoseHeight = (pose: InstancePose, height = 0): number =>
  INSTANCE_POSES.indexOf(pose) + POSE_SLOTS * Math.round((Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)) - MIN_HEIGHT) * HEIGHT_STEPS)

export const decodePoseHeight = (encoded: number): { readonly pose: InstancePose; readonly height: number } => {
  const height = Math.floor(encoded / POSE_SLOTS) / HEIGHT_STEPS + MIN_HEIGHT
  return { pose: INSTANCE_POSES[encoded - Math.floor(encoded / POSE_SLOTS) * POSE_SLOTS] as InstancePose, height }
}
