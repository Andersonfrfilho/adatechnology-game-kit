import type { Motion, World } from '@adatechnology/game-interactables'
import type { ThreeLib, Vec3 } from './types'

/** Pure pose of a part at `t`, in the part's own frame (the frame at rest: pivot at the origin, already turned by the part's `ry`). */
export interface Pose {
  /** Translation, part frame. */
  position: Vec3
  /** Rotation as a quaternion [x, y, z, w], part frame. */
  quaternion: [number, number, number, number]
  /** Scale per local axis. */
  scale: Vec3
}

const DEFAULTS = { hinge: Math.PI / 2, rocker: 0.35, knob: Math.PI * 1.5, slide: 0.3, scale: 0.2 }

function normalized(axis: Vec3 | undefined): Vec3 {
  const [x, y, z] = axis ?? [0, 1, 0]
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

/**
 * Local equivalent of the pose math of the interactables package. `t` is clamped to [0, 1]:
 * hinge / rocker / knob rotate `angle` around `axis`, slide translates `distance` along `axis`,
 * scale goes from 1 to `scale` along `axis`.
 */
export function poseOf(motion: Motion, t: number): Pose {
  const k = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  const axis = normalized(motion.axis)
  const pose: Pose = { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }
  switch (motion.kind) {
    case 'hinge':
    case 'rocker':
    case 'knob': {
      const a = (motion.angle ?? DEFAULTS[motion.kind]) * k
      const s = Math.sin(a / 2)
      pose.quaternion = [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(a / 2)]
      break
    }
    case 'slide': {
      const d = (motion.distance ?? DEFAULTS.slide) * k
      pose.position = [axis[0] * d, axis[1] * d, axis[2] * d]
      break
    }
    case 'scale': {
      const f = ((motion.scale ?? DEFAULTS.scale) - 1) * k
      pose.scale = [1 + f * Math.abs(axis[0]), 1 + f * Math.abs(axis[1]), 1 + f * Math.abs(axis[2])]
      break
    }
  }
  return pose
}

interface Rest {
  position: Vec3
  quaternion: [number, number, number, number]
  scale: Vec3
}

/** Remembers the rest transform of a part group in `userData.rest` (once). */
export function rememberRest(group: { position: any; quaternion: any; scale: any; userData: Record<string, any> }): Rest {
  let rest = group.userData.rest as Rest | undefined
  if (!rest) {
    const p = group.position
    const q = group.quaternion
    const s = group.scale
    rest = { position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w], scale: [s.x, s.y, s.z] }
    group.userData.rest = rest
  }
  return rest
}

/**
 * Poses `group` for a motion at `t`. The rest pose (position at the pivot, rotation `ry`) is saved in `group.userData.rest` the first
 * time, so calling this every frame never drifts. The motion axis lives in the part frame (after `ry`).
 */
export function applyPose<G extends import('three').Object3D>(THREE: ThreeLib, group: G, motion: Motion, t: number): G {
  const rest = rememberRest(group)
  const pose = poseOf(motion, t)
  const restQ = new THREE.Quaternion(rest.quaternion[0], rest.quaternion[1], rest.quaternion[2], rest.quaternion[3])
  const delta = new THREE.Quaternion(pose.quaternion[0], pose.quaternion[1], pose.quaternion[2], pose.quaternion[3])
  group.quaternion.copy(restQ).multiply(delta)
  const offset = new THREE.Vector3(pose.position[0], pose.position[1], pose.position[2]).applyQuaternion(restQ)
  group.position.set(rest.position[0] + offset.x, rest.position[1] + offset.y, rest.position[2] + offset.z)
  group.scale.set(rest.scale[0] * pose.scale[0], rest.scale[1] * pose.scale[1], rest.scale[2] * pose.scale[2])
  group.updateMatrix()
  return group
}

export interface SyncOptions {
  /** Seconds, drives the idle flutter of sway shaders. Default 0. */
  time?: number
}

/**
 * Per-frame sync of one world object: every part group takes the motion of its `PartSpec` at the world's current t,
 * and every soft volume swings. A soft volume drives the group in `parts` under its `part` (or, failing that, its own id):
 * meshes patched with `attachSway` get the swing through their shader uniforms (so shadows follow), any other group is rotated
 * around the anchor line.
 */
export function syncObject(THREE: ThreeLib, world: World, objectId: string, parts: Record<string, import('three').Object3D>, options: SyncOptions = {}): void {
  const obj = world.get(objectId)
  if (!obj) return
  const motionOf = new Map<string, Motion>()
  for (const p of obj.spec.parts ?? []) {
    motionOf.set(p.id, p.motion)
    const g = parts[p.id]
    if (g) applyPose(THREE, g, p.motion, world.partT(objectId, p.id))
  }
  for (const soft of obj.spec.soft ?? []) {
    const key = soft.part ?? soft.id
    const g = parts[key] ?? parts[soft.id]
    if (!g) continue
    const { ax, az } = world.sway(objectId, soft.id)
    let shaded = false
    g.traverse((o) => {
      const sway = o.userData.sway as { set(ax: number, az: number, time?: number): void } | undefined
      if (sway) {
        sway.set(ax, az, options.time)
        shaded = true
      }
    })
    if (shaded) continue
    rememberRest(g)
    // rotate around the anchor line: the part's pose (if it has a motion) is already applied above
    if (!motionOf.has(key)) applyPose(THREE, g, { kind: 'hinge', angle: 0 }, 0)
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(ax, 0, az, 'XYZ'))
    const anchor = new THREE.Vector3(soft.anchor[0], soft.anchor[1], soft.anchor[2])
    g.position.sub(anchor).applyQuaternion(rot).add(anchor)
    g.quaternion.premultiply(rot)
    g.updateMatrix()
  }
}
