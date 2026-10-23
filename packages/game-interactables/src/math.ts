import type { Motion, Transform, Vec3 } from './types'

export interface Pose {
  /** Translation relative to the pivot. */
  position: Vec3
  /** Rotation around `axis` (in the part frame) by `angle` radians. */
  rotation: { axis: Vec3; angle: number }
  scale: Vec3
}

const DEFAULT_AXIS: Vec3 = [0, 1, 0]

/**
 * Pose of a part at animation value `t` (0..1), relative to its pivot, so any renderer can apply it:
 * `position`, then `rotation` around the pivot, then `scale` along the axis.
 */
export function poseOf(motion: Motion, t: number): Pose {
  const tt = Math.max(0, Math.min(1, t))
  const axis = motion.axis ?? DEFAULT_AXIS
  const pose: Pose = { position: [0, 0, 0], rotation: { axis: [axis[0], axis[1], axis[2]], angle: 0 }, scale: [1, 1, 1] }
  switch (motion.kind) {
    case 'hinge':
    case 'rocker':
    case 'knob':
      pose.rotation.angle = (motion.angle ?? Math.PI / 2) * tt
      break
    case 'slide': {
      const d = (motion.distance ?? 0.4) * tt
      pose.position = [axis[0] * d, axis[1] * d, axis[2] * d]
      break
    }
    case 'scale': {
      const k = 1 + ((motion.scale ?? 0.2) - 1) * tt
      pose.scale = [axis[0] !== 0 ? k : 1, axis[1] !== 0 ? k : 1, axis[2] !== 0 ? k : 1]
      break
    }
  }
  return pose
}

/** Rotate a vector around +y by `ry` radians (same convention as three.js `rotation.y`). */
export function rotY(v: Vec3, ry: number): Vec3 {
  const c = Math.cos(ry)
  const s = Math.sin(ry)
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]
}

/** Object-local point to world space. */
export function localToWorld(transform: Transform, v: Vec3): Vec3 {
  const r = rotY(v, transform.ry)
  return [transform.x + r[0], transform.y + r[1], transform.z + r[2]]
}

/** World point to object-local space. */
export function worldToLocal(transform: Transform, v: Vec3): Vec3 {
  return rotY([v[0] - transform.x, v[1] - transform.y, v[2] - transform.z], -transform.ry)
}

/** Rodrigues rotation of `v` around a unit-length-normalised `axis` by `angle`. */
export function rotateAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const k: Vec3 = [axis[0] / len, axis[1] / len, axis[2] / len]
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]
  const cross: Vec3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]
  return [v[0] * c + cross[0] * s + k[0] * dot * (1 - c), v[1] * c + cross[1] * s + k[1] * dot * (1 - c), v[2] * c + cross[2] * s + k[2] * dot * (1 - c)]
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}
