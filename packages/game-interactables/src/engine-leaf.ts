import type { BodyId, JointId, Quat, SeamWorld } from '@adatechnology/game-physics'

import { clamp, rotateAxis } from './math'
import type { PartDriver } from './part-physics'
import type { Vec3 } from './types'

/** A part driver whose leaf is a body of the engine: the host draws the part where the body is, and after a break the body is all that is left. */
export interface EnginePartDriver extends PartDriver {
  readonly leaf: BodyId
}

/** Units of t per second that close a gap of one t: the leaf slows as it arrives. */
const AIM_GAIN = 8
const ARRIVED_AT = 0.004

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const axisAngle = (axis: Vec3, angle: number): Quat => {
  const size = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const k = Math.sin(angle / 2) / size
  return [axis[0] * k, axis[1] * k, axis[2] * k, Math.cos(angle / 2)]
}
const multiply = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]


export interface LeafDriverSpec {
  readonly world: SeamWorld
  readonly leaf: BodyId
  readonly frame: BodyId
  readonly ownsFrame: boolean
  readonly joint: JointId
  readonly onDispose: () => void
  readonly drive: { readonly isHinge: boolean; readonly axis: Vec3; readonly pivot: Vec3; readonly centre: Vec3; readonly range: number; readonly speed: number; readonly base: Quat }
}

const scaled = (axis: Vec3, by: number): Vec3 => [axis[0] * by, axis[1] * by, axis[2] * by]

export function createLeafDriver(spec: LeafDriverSpec): EnginePartDriver {
  const { world, leaf, frame, joint, drive } = spec
  const pose = new Float64Array(7)
  let target = 0
  let settled = true
  let broken = false
  let lastT = 0
  const read = (): number => {
    if (broken) return lastT
    if (drive.isHinge) {
      lastT = world.jointAngles(joint).hinge / drive.range
      return lastT
    }
    world.readPose(leaf, pose, 0)
    const moved: Vec3 = [(pose[0] as number) - drive.centre[0], (pose[1] as number) - drive.centre[1], (pose[2] as number) - drive.centre[2]]
    lastT = dot(moved, drive.axis) / drive.range
    return lastT
  }
  const stop = (): void => {
    world.setVelocity(leaf, [0, 0, 0], [0, 0, 0])
    settled = true
  }
  // t per second to the leaf's own velocity: a turn about the hinge carries the centre round, a slide is a line
  const move = (rate: number): void => {
    world.wake(leaf)
    const velocity = scaled(drive.axis, rate * drive.range)
    if (!drive.isHinge) return world.setVelocity(leaf, velocity, [0, 0, 0])
    world.readPose(leaf, pose, 0)
    const arm: Vec3 = [(pose[0] as number) - drive.pivot[0], (pose[1] as number) - drive.pivot[1], (pose[2] as number) - drive.pivot[2]]
    world.setVelocity(leaf, cross(velocity, arm), velocity)
  }
  const place = (t: number): void => {
    const amount = t * drive.range
    if (drive.isHinge) {
      const centre = rotateAxis([drive.centre[0] - drive.pivot[0], drive.centre[1] - drive.pivot[1], drive.centre[2] - drive.pivot[2]], drive.axis, amount)
      world.setPose(leaf, [drive.pivot[0] + centre[0], drive.pivot[1] + centre[1], drive.pivot[2] + centre[2]], multiply(axisAngle(drive.axis, amount), drive.base), true)
    } else {
      world.setPose(leaf, [drive.centre[0] + drive.axis[0] * amount, drive.centre[1] + drive.axis[1] * amount, drive.centre[2] + drive.axis[2] * amount], drive.base, true)
    }
    world.setVelocity(leaf, [0, 0, 0], [0, 0, 0])
  }
  return {
    leaf,
    aim(next) {
      if (broken) return
      target = next
      settled = false
    },
    snap(t) {
      target = t
      settled = true
      if (!broken) place(t)
    },
    update() {
      if (broken) return
      if (world.brokenJoints.includes(joint)) {
        broken = true
        settled = true
        return
      }
      if (settled) return
      const error = target - read()
      if (Math.abs(error) < ARRIVED_AT) return stop()
      move(clamp(error * AIM_GAIN, -drive.speed, drive.speed))
    },
    read,
    get settled() {
      return settled
    },
    get broken() {
      return broken
    },
    dispose() {
      spec.onDispose()
      if (!broken) world.removeJoint(joint)
      world.removeBody(leaf)
      if (spec.ownsFrame) world.removeBody(frame)
    },
  }
}
