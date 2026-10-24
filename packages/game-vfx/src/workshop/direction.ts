import type { RandomStream, MutableVec3 } from '../random'
import { addScaled, normalize } from '../vector'
import type { SpriteRange, Vec3Tuple } from './types'

const TWO_PI_ROUNDED = 6.2832
const WIDE_CONE = 3.1
const UP: Vec3Tuple = [0, 1, 0]

export function drawRange(random: RandomStream, range: SpriteRange | undefined): number {
  if (Array.isArray(range)) return random.between(range[0], range[1])
  return (range as number | undefined) || 0
}

/** `randUnit` (W166): the page rounds a turn to 6.2832, so this is not `RandomStream.direction`. */
export function randomUnit(random: RandomStream, out: MutableVec3): MutableVec3 {
  const up = random.next() * 2 - 1
  const angle = random.next() * TWO_PI_ROUNDED
  const ring = Math.sqrt(1 - up * up)
  out.x = ring * Math.cos(angle)
  out.y = up
  out.z = ring * Math.sin(angle)
  return out
}

const tangentA: MutableVec3 = { x: 0, y: 0, z: 0 }
const tangentB: MutableVec3 = { x: 0, y: 0, z: 0 }
const axis: MutableVec3 = { x: 0, y: 0, z: 0 }

function cross(out: MutableVec3, a: MutableVec3, b: MutableVec3): MutableVec3 {
  const x = a.y * b.z - a.z * b.y
  const y = a.z * b.x - a.x * b.z
  const z = a.x * b.y - a.y * b.x
  out.x = x
  out.y = y
  out.z = z
  return out
}

/** `coneDir` (W169-171): a direction inside `cone` radians of `direction`, two draws (a full sphere when the cone is wide). */
export function coneDirection(random: RandomStream, direction: Vec3Tuple | undefined, cone: number, out: MutableVec3): MutableVec3 {
  if (cone >= WIDE_CONE) return randomUnit(random, out)
  const [dx, dy, dz] = direction ?? UP
  const cosTilt = 1 - random.next() * (1 - Math.cos(cone))
  const sinTilt = Math.sqrt(1 - cosTilt * cosTilt)
  const phase = random.next() * TWO_PI_ROUNDED
  axis.x = dx
  axis.y = dy
  axis.z = dz
  tangentA.x = 1
  tangentA.y = 0
  tangentA.z = 0
  if (Math.abs(dx) > 0.9) {
    tangentA.x = 0
    tangentA.y = 1
  }
  normalize(cross(tangentB, axis, tangentA))
  normalize(cross(tangentA, tangentB, axis))
  out.x = dx * cosTilt
  out.y = dy * cosTilt
  out.z = dz * cosTilt
  addScaled(out, tangentA, sinTilt * Math.cos(phase))
  addScaled(out, tangentB, sinTilt * Math.sin(phase))
  return out
}
