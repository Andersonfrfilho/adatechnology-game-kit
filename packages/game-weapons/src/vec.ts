import type { Vec3 } from './types'

export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])

export const distance = (a: Vec3, b: Vec3): number => length(subtract(a, b))

/** `v` rotated 180° about the origin: the direction pointing away. */
export const negate = (v: Vec3): Vec3 => [0 - v[0], 0 - v[1], 0 - v[2]]
