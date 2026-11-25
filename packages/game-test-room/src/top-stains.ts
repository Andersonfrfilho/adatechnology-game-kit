// What was spilt on the tops of the scenery follows the top: moved, tipped over, broken or burnt away.
import type * as THREE_NS from 'three'
import type { DestructionWorld, Quat, Vec3 } from '@adatechnology/game-destruction'
import type { FluidWorld } from '@adatechnology/game-fluids'

import type { ArenaTop } from './arena'

/** Where an object stands: its origin and its turn, in world space. */
export interface ObjectPose {
  readonly position: Vec3
  readonly rotation: Quat
}

export interface TopStainsDeps {
  readonly THREE: { Vector3: typeof THREE_NS.Vector3; Quaternion: typeof THREE_NS.Quaternion }
  readonly world: DestructionWorld
  readonly fluids: FluidWorld
  readonly tops: readonly ArenaTop[]
  /** The objects of the tops where the room laid them. */
  readonly objects: readonly { readonly id: string; readonly position: Vec3; readonly rotationY: number }[]
  /** The drawn root of an object (the piece it became, once it moves), or undefined when it is not drawn. */
  readonly rootOf: (objectId: string) => THREE_NS.Object3D | undefined
}

export interface TopStains {
  /** Once a step: moves the surface of each top with its object and lets go what was on a top that is gone. */
  update(): void
  /** The room was put back: every top stands again where it was laid. */
  reset(): void
}

/** Below this (m, rad) the pose of a top is the one it already has. */
const POSE_EPSILON = 1e-5
const REST_POSE: ObjectPose = { position: [0, 0, 0], rotation: [0, 0, 0, 1] }

const conjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]
const multiply = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const rotate = (q: Quat, v: Vec3): Vec3 => {
  const [x, y, z, w] = q
  const ix = w * v[0] + y * v[2] - z * v[1]
  const iy = w * v[1] + z * v[0] - x * v[2]
  const iz = w * v[2] + x * v[1] - y * v[0]
  const iw = -x * v[0] - y * v[1] - z * v[2]
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]
}

/** The move from `rest` to `now`, as `game-fluids` takes it: `x' = rotation · x + position`. */
export function poseFromRest(rest: ObjectPose, now: ObjectPose): ObjectPose {
  const rotation = multiply(now.rotation, conjugate(rest.rotation))
  const turned = rotate(rotation, rest.position)
  return { position: [now.position[0] - turned[0], now.position[1] - turned[1], now.position[2] - turned[2]], rotation }
}

const samePose = (a: ObjectPose, b: ObjectPose): boolean =>
  a.position.every((v, i) => Math.abs(v - b.position[i]!) < POSE_EPSILON) && a.rotation.every((v, i) => Math.abs(v - b.rotation[i]!) < POSE_EPSILON)

/**
 * A stain lies on the top it was spilt on. The top pushed, knocked or tipped over carries it (and a top turned over sheds the pool: `game-fluids`
 * `setSurfacePose`); when the top or one of its boards breaks, melts or burns away, the pool on it falls to what is under it instead of staying in the air,
 * and a top that is gone takes no more liquid.
 */
export function createTopStains(deps: TopStainsDeps): TopStains {
  const { world, fluids, tops } = deps
  const fallen = new Set<string>()
  const posed = new Map<string, ObjectPose>()
  const rests = new Map<string, ObjectPose>(deps.objects.map((o) => [o.id, { position: o.position, rotation: [0, Math.sin(o.rotationY / 2), 0, Math.cos(o.rotationY / 2)] }]))
  const at = new deps.THREE.Vector3()
  const turn = new deps.THREE.Quaternion()
  const size = new deps.THREE.Vector3()
  const poseOf = (objectId: string): ObjectPose | undefined => {
    const root = deps.rootOf(objectId)
    if (!root) return undefined
    root.updateWorldMatrix(true, false)
    root.matrixWorld.decompose(at, turn, size)
    return { position: [at.x, at.y, at.z], rotation: [turn.x, turn.y, turn.z, turn.w] }
  }

  const lost = (object: string, part: string): boolean => {
    const p = world.part(object, part)
    return !p || p.status === 'broken' || p.status === 'melted' || p.status === 'ashes'
  }
  /** The pool of the stains in `inside` falls from where it lay; their soaked part went with what broke. */
  const pourOff = (surface: string, inside: (center: Vec3) => boolean): void => {
    for (const st of fluids.stains()) {
      if (st.surface !== surface || !inside(st.center)) continue
      fluids.clearStains(st.center, 1e-3)
      if (st.liters > 0) fluids.splash(st.liquid, st.center, st.liters)
    }
  }
  const follow = (t: ArenaTop): void => {
    const rest = rests.get(t.id)
    const now = poseOf(t.id)
    if (!rest || !now) return
    const pose = poseFromRest(rest, now)
    if (samePose(posed.get(t.id) ?? REST_POSE, pose)) return
    posed.set(t.id, pose)
    fluids.setSurfacePose(t.id, pose)
  }

  return {
    update() {
      for (const t of tops) {
        if (fallen.has(t.id)) continue
        if (t.boards ? t.boards.every((b) => lost(t.id, b.part)) : lost(t.id, t.topPart)) {
          fallen.add(t.id)
          const stains = fluids.stains().filter((s) => s.surface === t.id)
          fluids.removeSurface(t.id)
          for (const st of stains) if (st.liters > 0) fluids.splash(st.liquid, st.center, st.liters)
          continue
        }
        follow(t)
        if (!t.boards) continue
        const gone = t.boards.filter((b) => lost(t.id, b.part))
        if (gone.length > 0) pourOff(t.id, ([x, , z]) => gone.some((b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ))
      }
    },
    reset() {
      fallen.clear()
      posed.clear()
    },
  }
}
