import type * as THREE_NS from 'three'
import type { BodyId, PhysicsWorld, Quat, ShapeDesc, Vec3 } from '@adatechnology/game-physics'

import { boxInertia, multiplyQuat, rotateBy } from './crash-parts-math'
import type { BodyMass } from './crash-parts-math'

type Three = typeof THREE_NS

/** Steps between looks at whether a part is clear of the car it came off (it does not meet the car until it is). */
const CLEAR_CHECK_STEPS = 30
/** Times a part found inside the fixed world is moved out along the way the engine gives. */
const PUSH_OUT_PASSES = 3

/** A drawn holder that follows the part's body: where it sits against the body's origin and how it is turned against the frame, both fixed when the part came off. */
interface Follower {
  readonly holder: THREE_NS.Object3D
  readonly offset: Vec3
  readonly turn: Quat
}

export interface PartBody {
  readonly id: BodyId
  readonly partIndex: number
  readonly shape: ShapeDesc
  /** Where the first drawn holder was: the origin the others are placed against. */
  readonly extent: PartExtent
  readonly followers: Follower[]
  /** Still not meeting the car it came off. */
  isIgnoring: boolean
}

/** Where a part sits in the frame: the centre and size of the box round its drawn meshes (the frame's axes). */
export interface PartExtent {
  readonly centre: Vec3
  readonly size: Vec3
}

export interface PartBodies {
  /** The part's box in the frame, from what is drawn on `holder`. */
  extentOf(holder: THREE_NS.Object3D): PartExtent
  /** Makes the part's body from `hulls` (frame points) at `extent`, thrown with the point's speed of the chassis; its holder follows from now on. */
  create(options: { readonly partIndex: number; readonly mass: number; readonly hulls: readonly ArrayLike<number>[]; readonly extent: PartExtent; readonly holder: THREE_NS.Object3D; readonly chassis: BodyId; readonly chassisMass: BodyMass }): PartBody
  /** Another drawn holder of a part that already has its body. */
  follow(body: PartBody, holder: THREE_NS.Object3D, extent: PartExtent): void
  /** Holders onto their bodies; releases the parts that are clear of the car. Once a step. */
  step(chassis: BodyId): void
  /** Takes every body out of the world. */
  dispose(): void
  readonly bodies: ReadonlyMap<number, PartBody>
  readonly pushedOut: () => number
}

export const createPartBodies = (THREE: Three, world: PhysicsWorld, frame: THREE_NS.Object3D): PartBodies => {
  const bodies = new Map<number, PartBody>()
  const pose = new Float64Array(7)
  const speed = new Float64Array(6)
  const clearOut: BodyId[] = []
  const push = new Float64Array(3)
  const scratch = { box: new THREE.Box3(), corner: new THREE.Vector3(), position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), parent: new THREE.Quaternion() }
  let steps = 0
  let pushed = 0

  const extentOf = (holder: THREE_NS.Object3D): PartExtent => {
    holder.updateWorldMatrix(true, true)
    frame.updateWorldMatrix(true, false)
    const { box, corner } = scratch
    box.setFromObject(holder)
    const low = [Infinity, Infinity, Infinity]
    const high = [-Infinity, -Infinity, -Infinity]
    for (let k = 0; k < 8; k++) {
      corner.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z)
      frame.worldToLocal(corner)
      low[0] = Math.min(low[0]!, corner.x); low[1] = Math.min(low[1]!, corner.y); low[2] = Math.min(low[2]!, corner.z)
      high[0] = Math.max(high[0]!, corner.x); high[1] = Math.max(high[1]!, corner.y); high[2] = Math.max(high[2]!, corner.z)
    }
    return { centre: [(low[0]! + high[0]!) / 2, (low[1]! + high[1]!) / 2, (low[2]! + high[2]!) / 2], size: [high[0]! - low[0]!, high[1]! - low[1]!, high[2]! - low[2]!] }
  }

  const holderTurn = (holder: THREE_NS.Object3D): Quat => {
    holder.getWorldQuaternion(scratch.quaternion)
    frame.getWorldQuaternion(scratch.parent)
    const turn = scratch.parent.clone().invert().multiply(scratch.quaternion)
    return [turn.x, turn.y, turn.z, turn.w]
  }

  const follower = (holder: THREE_NS.Object3D, offset: Vec3): Follower => ({ holder, offset, turn: holderTurn(holder) })

  const pushOutOfTheFixedWorld = (body: PartBody): void => {
    for (let pass = 0; pass < PUSH_OUT_PASSES; pass++) {
      const depth = world.penetration(body.id, push)
      if (depth <= 0) return
      world.readPose(body.id, pose, 0)
      world.setPose(body.id, [pose[0]! + push[0]! * depth, pose[1]! + push[1]! * depth, pose[2]! + push[2]! * depth], [pose[3]!, pose[4]!, pose[5]!, pose[6]!], true)
      pushed++
    }
  }

  const create: PartBodies['create'] = ({ partIndex, mass, hulls, extent, holder, chassis, chassisMass }) => {
    world.readPose(chassis, pose, 0)
    world.readVelocity(chassis, speed, 0)
    const rotation: Quat = [pose[3]!, pose[4]!, pose[5]!, pose[6]!]
    const lever = rotateBy(rotation, [extent.centre[0] - chassisMass.centre[0], extent.centre[1] - chassisMass.centre[1], extent.centre[2] - chassisMass.centre[2]])
    const around: Vec3 = [speed[3]!, speed[4]!, speed[5]!]
    const linear: Vec3 = [speed[0]! + around[1] * lever[2] - around[2] * lever[1], speed[1]! + around[2] * lever[0] - around[0] * lever[2], speed[2]! + around[0] * lever[1] - around[1] * lever[0]]
    const origin = rotateBy(rotation, extent.centre)
    const shape: ShapeDesc = {
      kind: 'compound',
      children: hulls.map((points) => ({ shape: { kind: 'convex', points: shifted(points, extent.centre) } as ShapeDesc, position: [0, 0, 0] as Vec3, tag: partIndex })),
    }
    const id = world.createBody({
      shape, motion: 'dynamic', mass, inertia: boxInertia(mass, extent.size), centreAtOrigin: true, continuous: true, layer: 'debris', user: partIndex,
      position: [pose[0]! + origin[0], pose[1]! + origin[1], pose[2]! + origin[2]], rotation, linearVelocity: linear, angularVelocity: around,
    })
    const body: PartBody = { id, partIndex, shape, extent, followers: [follower(holder, [0, 0, 0])], isIgnoring: true }
    world.ignorePair(id, chassis, true)
    pushOutOfTheFixedWorld(body)
    bodies.set(partIndex, body)
    return body
  }

  const follow: PartBodies['follow'] = (body, holder, extent) => {
    const base = body.extent.centre
    body.followers.push(follower(holder, [extent.centre[0] - base[0], extent.centre[1] - base[1], extent.centre[2] - base[2]]))
  }

  const place = (body: PartBody): void => {
    world.readPose(body.id, pose, 0)
    const rotation: Quat = [pose[3]!, pose[4]!, pose[5]!, pose[6]!]
    for (const { holder, offset, turn } of body.followers) {
      const at = rotateBy(rotation, offset)
      scratch.position.set(pose[0]! + at[0], pose[1]! + at[1], pose[2]! + at[2])
      const turned = multiplyQuat(rotation, turn)
      const parent = holder.parent
      if (parent) parent.worldToLocal(scratch.position)
      holder.position.copy(scratch.position)
      scratch.quaternion.set(turned[0], turned[1], turned[2], turned[3])
      if (parent) {
        parent.getWorldQuaternion(scratch.parent)
        scratch.quaternion.premultiply(scratch.parent.invert())
      }
      holder.quaternion.copy(scratch.quaternion)
      holder.updateMatrix()
    }
  }

  const release = (body: PartBody, chassis: BodyId): void => {
    world.readPose(body.id, pose, 0)
    // the part's box, not its hulls: the engine holds a query shape by its dimensions, and a compound of hulls is a new one for every body
    world.overlapShape({ kind: 'box', half: [body.extent.size[0] / 2, body.extent.size[1] / 2, body.extent.size[2] / 2] }, [pose[0]!, pose[1]!, pose[2]!], [pose[3]!, pose[4]!, pose[5]!, pose[6]!], clearOut, { layers: ['vehicle'] })
    if (clearOut.includes(chassis)) return
    world.ignorePair(body.id, chassis, false)
    body.isIgnoring = false
  }

  return {
    extentOf, create, follow, bodies,
    pushedOut: () => pushed,
    step: (chassis) => {
      steps++
      const check = steps % CLEAR_CHECK_STEPS === 0
      for (const body of bodies.values()) {
        place(body)
        if (check && body.isIgnoring) release(body, chassis)
      }
    },
    dispose: () => {
      for (const body of bodies.values()) if (world.has(body.id)) world.removeBody(body.id)
      bodies.clear()
    },
  }
}

const shifted = (points: ArrayLike<number>, by: Vec3): Float32Array => {
  const out = new Float32Array(points.length)
  for (let i = 0; i < out.length; i += 3) {
    out[i] = points[i]! - by[0]
    out[i + 1] = points[i + 1]! - by[1]
    out[i + 2] = points[i + 2]! - by[2]
  }
  return out
}
