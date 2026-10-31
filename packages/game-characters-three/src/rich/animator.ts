import { CASCADE, animateProfile, lerpPose, stepCascade } from '@adatechnology/game-characters'
import type { CascadeJoint, GaitProfile, GaitSample, RestPose, StrideParams } from '@adatechnology/game-characters'

import type { THREE_NS } from '../three'

type Euler3 = { x: number; y: number; z: number }
type Node3 = { rotation: Euler3; position: { x: number; y: number; z: number } }

/** A limb of the rich body, as the Bestiário builds it: the group at the joint, the one below it (elbow, knee) and the rest angles. */
type RigArm = { g: Node3; el: Node3 & { userData: Record<string, unknown> }; base: number; eBase: number }
type RigLeg = { g: Node3; kn: Node3; base: number; kBase: number; lost?: boolean }

/** What `RichBodyBuilder.build` leaves in `root.userData.rig` (the page's `rig`). */
export type RichRig = {
  readonly type: string
  readonly fig: Node3
  readonly upper: Node3
  readonly headG: Node3
  /** The neck cylinder, taken by identity; absent when the head is cut off. */
  readonly neck?: Node3
  readonly arms: RigArm[]
  readonly legs: RigLeg[]
  readonly dangles: { g: Node3; el: Node3 }[]
  readonly flaps: (Node3 & { userData: Record<string, unknown> })[]
  readonly ph: number
  readonly dropBase: number
  readonly leanBase: number
  readonly hxBase: number
  /** Cascade state, made on the first call of `cascade`. */
  cur?: Map<readonly [Node3 | Euler3, string, CascadeJoint], number>
  jl?: (readonly [Node3 | Euler3, string, CascadeJoint])[]
}

/** The names a pose may set (the Bestiário's `setPose`). All are optional: a joint a pose does not name keeps what it had. */
export type PoseTargets = Partial<
  Record<'lean' | 'twist' | 'side' | 'drop' | 'headX' | 'headY' | 'headZ' | 'armR' | 'armL' | 'elbR' | 'elbL' | 'armRz' | 'armLz' | 'legL' | 'legR' | 'kneeL' | 'kneeR', number>
>

export type RigAnimatorOptions = {
  /** Gait profile by the type name the rig carries (`rig.type`); a type that is not here walks like the first type of the Bestiário (the slow one). */
  readonly gaits?: Readonly<Record<string, GaitProfile>>
  /** Cascade rates per joint. Default: the engine's `CASCADE`. */
  readonly cascade?: Readonly<Record<CascadeJoint, number>>
}

export type RigAnimator = {
  /** The pose the gait swings around (legs `lost` stay out of the swing). */
  restOf(rig: RichRig): RestPose
  /** The Bestiário's `animate0`: sets the joint rotations of one gait at `time`. `stride` ties cadence and swing to the ground speed. */
  animate0(root: THREE_NS.Object3D, time: number, stride?: StrideParams): GaitSample | undefined
  /** `animate0` plus the bits that hang loose: the dangling forearm and the flaps of torn flesh. */
  animate(root: THREE_NS.Object3D, time: number, stride?: StrideParams): void
  /** Moves every joint a fraction toward the value the animation left on it, from the hips to the head (the Bestiário's `cascade`). */
  cascade(rig: RichRig, dt: number): void
  setPose(rig: RichRig, targets: PoseTargets): void
  lerpPose: typeof lerpPose
}

const rigOf = (root: THREE_NS.Object3D): RichRig | undefined => root.userData.rig as RichRig | undefined

/** Applies the numbers a gait wrote; a field the gait left out keeps what the joint had. */
const apply = (rig: RichRig, sample: GaitSample): void => {
  if (sample.hipY !== undefined) rig.fig.position.y = sample.hipY
  if (sample.upper.x !== undefined) rig.upper.rotation.x = sample.upper.x
  if (sample.upper.y !== undefined) rig.upper.rotation.y = sample.upper.y
  if (sample.upper.z !== undefined) rig.upper.rotation.z = sample.upper.z
  if (sample.head.x !== undefined) rig.headG.rotation.x = sample.head.x
  if (sample.head.y !== undefined) rig.headG.rotation.y = sample.head.y
  rig.arms.forEach((arm, index) => {
    const target = sample.arms[index]
    if (target?.shoulder !== undefined) arm.g.rotation.x = target.shoulder
    if (target?.elbow !== undefined) arm.el.rotation.x = target.elbow
  })
  rig.legs.forEach((leg, index) => {
    const target = sample.legs[index]
    if (target?.hip !== undefined) leg.g.rotation.x = target.hip
    if (target?.knee !== undefined) leg.kn.rotation.x = target.knee
  })
}

/**
 * The rich body's animator: the Bestiário's `animate0`, `animate`, `cascade`, `setPose` and `lerpPose` over the rig the best builder leaves in
 * `root.userData.rig`. The gait maths is the engine's (`animateProfile`, pure CPU); this only reads the rest pose off the rig and writes the result back.
 */
export const createRigAnimator = (options: RigAnimatorOptions = {}): RigAnimator => {
  const gaits = options.gaits ?? {}
  const rates = options.cascade ?? CASCADE
  const restOf = (rig: RichRig): RestPose => ({
    hipY: rig.dropBase,
    lean: rig.leanBase,
    headX: rig.hxBase,
    arms: [
      { shoulder: rig.arms[0]!.base, elbow: rig.arms[0]!.eBase },
      { shoulder: rig.arms[1]!.base, elbow: rig.arms[1]!.eBase },
    ],
    legs: [
      { hip: rig.legs[0]!.base, knee: rig.legs[0]!.kBase, ...(rig.legs[0]!.lost ? { lost: true } : {}) },
      { hip: rig.legs[1]!.base, knee: rig.legs[1]!.kBase, ...(rig.legs[1]!.lost ? { lost: true } : {}) },
    ],
  })
  const animate0: RigAnimator['animate0'] = (root, time, stride) => {
    const rig = rigOf(root)
    if (!rig) return undefined
    const profile = gaits[rig.type]
    const sample = animateProfile({ ...(profile ? { profile } : {}), rest: restOf(rig), time, phase: rig.ph, ...(stride ? { stride } : {}) })
    apply(rig, sample)
    return sample
  }
  return {
    restOf,
    animate0,
    animate(root, time, stride) {
      const rig = rigOf(root)
      if (!rig) return
      animate0(root, time, stride)
      rig.dangles.forEach((arm: { g: Node3; el: Node3 }) => {
        arm.el.rotation.x = -(arm.g.rotation.x + rig.upper.rotation.x) + Math.sin(time * 3.2 + rig.ph) * 0.3
      })
      rig.flaps.forEach((flap, index) => {
        const base = (flap.userData.rx0 ??= flap.rotation.x) as number
        flap.rotation.x = base + Math.sin(time * 4 + index + rig.ph) * 0.18
      })
    },
    cascade(rig, dt) {
      if (!rig.cur) {
        const joints: (readonly [Node3 | Euler3, string, CascadeJoint])[] = [
          [rig.fig.position, 'y', 'hip'],
          [rig.upper.rotation, 'x', 'spine'],
          [rig.upper.rotation, 'y', 'spine'],
          [rig.upper.rotation, 'z', 'spine'],
          [rig.headG.rotation, 'x', 'head'],
          [rig.headG.rotation, 'y', 'head'],
          [rig.headG.rotation, 'z', 'head'],
        ]
        rig.arms.forEach((arm) => joints.push([arm.g.rotation, 'x', 'shoulder'], [arm.el.rotation, 'x', 'elbow']))
        rig.legs.forEach((leg) => joints.push([leg.g.rotation, 'x', 'leg'], [leg.kn.rotation, 'x', 'knee']))
        rig.jl = joints
        rig.cur = new Map(joints.map((joint) => [joint, (joint[0] as unknown as Record<string, number>)[joint[1]] as number]))
        return
      }
      for (const joint of rig.jl!) {
        const target = (joint[0] as unknown as Record<string, number>)[joint[1]] as number
        const value = stepCascade(rig.cur.get(joint) as number, target, dt, joint[2], rates)
        rig.cur.set(joint, value)
        ;(joint[0] as unknown as Record<string, number>)[joint[1]] = value
      }
    },
    setPose(rig, q) {
      if (q.lean != null) rig.upper.rotation.x = q.lean
      if (q.twist != null) rig.upper.rotation.y = q.twist
      if (q.side != null) rig.upper.rotation.z = q.side
      if (q.drop != null) rig.fig.position.y = rig.dropBase + q.drop
      if (q.headX != null) rig.headG.rotation.x = q.headX
      if (q.headY != null) rig.headG.rotation.y = q.headY
      if (q.headZ != null) rig.headG.rotation.z = q.headZ
      const [armR, armL] = rig.arms as [RigArm, RigArm]
      if (q.armR != null) armR.g.rotation.x = q.armR
      if (q.armL != null) armL.g.rotation.x = q.armL
      if (q.elbR != null) armR.el.rotation.x = q.elbR
      if (q.elbL != null) armL.el.rotation.x = q.elbL
      if (q.armRz != null) armR.g.rotation.z = q.armRz
      if (q.armLz != null) armL.g.rotation.z = q.armLz
      const [legL, legR] = rig.legs as [RigLeg, RigLeg]
      if (q.legL != null) legL.g.rotation.x = q.legL
      if (q.legR != null) legR.g.rotation.x = q.legR
      if (q.kneeL != null) legL.kn.rotation.x = q.kneeL
      if (q.kneeR != null) legR.kn.rotation.x = q.kneeR
    },
    lerpPose,
  }
}
