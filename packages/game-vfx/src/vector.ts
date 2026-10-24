import type { MutableVec3 } from './random'

/** Operations on `{ x, y, z }` written the way three.js r128 does them (`normalize` multiplies by the reciprocal), so a port repeats the Lab's numbers bit for bit. */

export function createVec3(x = 0, y = 0, z = 0): MutableVec3 {
  return { x, y, z }
}

export function addScaled(target: MutableVec3, direction: MutableVec3, scale: number): MutableVec3 {
  target.x += direction.x * scale
  target.y += direction.y * scale
  target.z += direction.z * scale
  return target
}

export function normalize(target: MutableVec3): MutableVec3 {
  const length = Math.sqrt(target.x * target.x + target.y * target.y + target.z * target.z) || 1
  const inverse = 1 / length
  target.x *= inverse
  target.y *= inverse
  target.z *= inverse
  return target
}

export function distanceBetween(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = ax - bx
  const dy = ay - by
  const dz = az - bz
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
