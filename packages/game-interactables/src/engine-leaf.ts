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


/** Scratch of every leaf: a driver reads and writes a pose, a velocity pair at a time, so no pose or vector is made per frame. */
const pose = new Float64Array(7)
const linearScratch: Vec3 = [0, 0, 0]
const angularScratch: Vec3 = [0, 0, 0]
const NO_SPIN: Vec3 = [0, 0, 0]

export function createLeafDriver(spec: LeafDriverSpec): EnginePartDriver {
  const { world, leaf, frame, joint, drive } = spec
  const { axis, pivot, centre, range } = drive
  let target = 0
  let settled = true
  let broken = false
  let lastT = 0
  /** t of the leaf at rest, kept while it sleeps: nothing moves it, so the joint is not asked again. */
  let restedT: number | undefined
  const measure = (): number => {
    if (drive.isHinge) return world.jointAngles(joint).hinge / range
    world.readPose(leaf, pose, 0)
    return (((pose[0] as number) - centre[0]) * axis[0] + ((pose[1] as number) - centre[1]) * axis[1] + ((pose[2] as number) - centre[2]) * axis[2]) / range
  }
  const read = (): number => {
    if (broken) return lastT
    if (settled && world.isSleeping(leaf)) {
      restedT ??= measure()
      lastT = restedT
      return lastT
    }
    restedT = undefined
    lastT = measure()
    return lastT
  }
  const stop = (): void => {
    world.setVelocity(leaf, NO_SPIN, NO_SPIN)
    settled = true
  }
  // t per second to the leaf's own velocity: a turn about the hinge carries the centre round, a slide is a line
  const move = (rate: number): void => {
    world.wake(leaf)
    const speed = rate * range
    angularScratch[0] = axis[0] * speed
    angularScratch[1] = axis[1] * speed
    angularScratch[2] = axis[2] * speed
    if (!drive.isHinge) return world.setVelocity(leaf, angularScratch, NO_SPIN)
    world.readPose(leaf, pose, 0)
    const armX = (pose[0] as number) - pivot[0]
    const armY = (pose[1] as number) - pivot[1]
    const armZ = (pose[2] as number) - pivot[2]
    linearScratch[0] = angularScratch[1] * armZ - angularScratch[2] * armY
    linearScratch[1] = angularScratch[2] * armX - angularScratch[0] * armZ
    linearScratch[2] = angularScratch[0] * armY - angularScratch[1] * armX
    world.setVelocity(leaf, linearScratch, angularScratch)
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
      restedT = undefined
    },
    snap(t) {
      target = t
      settled = true
      restedT = undefined
      if (!broken) place(t)
    },
    update() {
      if (broken) return
      if (!world.jointExists(joint)) {
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
