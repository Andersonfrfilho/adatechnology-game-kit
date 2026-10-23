import type { Quat, Vec3 } from './types'

export const GRAVITY = 9.81
export const EPS = 1e-7

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
export const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
export const normalize = (a: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 => {
  const l = length(a)
  return l < 1e-9 ? [fallback[0], fallback[1], fallback[2]] : [a[0] / l, a[1] / l, a[2] / l]
}
export const copy3 = (a: Vec3): Vec3 => [a[0], a[1], a[2]]
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]

/** Rotate `v` by the unit quaternion `q` (x, y, z, w). */
export const quatRotate = (q: Quat, v: Vec3): Vec3 => {
  const u: Vec3 = [q[0], q[1], q[2]]
  const c1 = cross(u, v)
  const c2 = cross(u, c1)
  return [v[0] + 2 * (q[3] * c1[0] + c2[0]), v[1] + 2 * (q[3] * c1[1] + c2[1]), v[2] + 2 * (q[3] * c1[2] + c2[2])]
}
export const quatConjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]]
export const quatMultiply = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
export const quatNormalize = (q: Quat): Quat => {
  const l = Math.hypot(q[0], q[1], q[2], q[3])
  return l < 1e-9 ? [0, 0, 0, 1] : [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}
/** Quaternion from Euler angles in XYZ order (the same convention as three.js). */
export const quatFromEuler = (x: number, y: number, z: number): Quat => {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
}

/** Small seeded generator (mulberry32). Its whole state is one integer, so it serialises trivially. */
export class Rng {
  state: number
  constructor(seed: number) {
    this.state = (Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0) || 1
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
