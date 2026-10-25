import type { Vec3Tuple } from '../workshop/types'

const ANIMATION_SPEED = 1.4
const START_POSITION: Vec3Tuple = [4, 2.4, 7]
const START_TARGET: Vec3Tuple = [0, 1, 0]

type Vector = [number, number, number]

function subtract(a: Vec3Tuple, b: Vec3Tuple): Vector {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function unit(vector: Vector): Vector {
  const length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]) || 1
  const inverse = 1 / length
  return [vector[0] * inverse, vector[1] * inverse, vector[2] * inverse]
}

function crossProduct(a: Vector, b: Vector): Vector {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function ease(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value * value * (3 - 2 * value)
}

function mix(from: Vec3Tuple, to: Vec3Tuple, amount: number): Vec3Tuple {
  return [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount, from[2] + (to[2] - from[2]) * amount]
}

/** Rotates a vector by the quaternion `(x, y, z, w)` as three.js `applyQuaternion` does. */
function rotate(local: readonly number[], x: number, y: number, z: number, w: number): Vec3Tuple {
  const [vx, vy, vz] = local as Vec3Tuple
  const ix = w * vx + y * vz - z * vy
  const iy = w * vy + z * vx - x * vz
  const iz = w * vz + x * vy - y * vx
  const iw = -x * vx - y * vy - z * vz
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]
}

/** The quaternion three.js builds from `lookAt(eye, target)` with the y axis up (`setFromRotationMatrix`). */
function lookAtQuaternion(eye: Vec3Tuple, target: Vec3Tuple): readonly [number, number, number, number] {
  const z = unit(subtract(eye, target))
  const x = unit(crossProduct([0, 1, 0], z))
  const y = crossProduct(z, x)
  const [m11, m21, m31, m12, m22, m32, m13, m23, m33] = [x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]]
  const trace = m11 + m22 + m33
  if (trace > 0) {
    const scale = 0.5 / Math.sqrt(trace + 1)
    return [(m32 - m23) * scale, (m13 - m31) * scale, (m21 - m12) * scale, 0.25 / scale]
  }
  if (m11 > m22 && m11 > m33) {
    const scale = 2 * Math.sqrt(1 + m11 - m22 - m33)
    return [0.25 * scale, (m12 + m21) / scale, (m13 + m31) / scale, (m32 - m23) / scale]
  }
  if (m22 > m33) {
    const scale = 2 * Math.sqrt(1 + m22 - m11 - m33)
    return [(m12 + m21) / scale, 0.25 * scale, (m23 + m32) / scale, (m13 - m31) / scale]
  }
  const scale = 2 * Math.sqrt(1 + m33 - m11 - m22)
  return [(m13 + m31) / scale, (m23 + m32) / scale, 0.25 * scale, (m21 - m12) / scale]
}

/**
 * The Workshop's view (W1259-1262): it glides to each effect's `view` (`camTo`) in about 0.7 s and persists between effects, so an effect that reads the
 * camera (a ring that faces the viewer, a mist at the lens) sees where the previous one left it.
 */
export class EffectCamera {
  position: Vec3Tuple = START_POSITION
  target: Vec3Tuple = START_TARGET
  private animation: { from: Vec3Tuple; fromTarget: Vec3Tuple; to: Vec3Tuple; toTarget: Vec3Tuple; progress: number } | undefined

  goTo(eye: Vec3Tuple, target: Vec3Tuple): void {
    this.animation = { from: this.position, fromTarget: this.target, to: eye, toTarget: target, progress: 0 }
  }

  place(eye: Vec3Tuple, target: Vec3Tuple): void {
    this.position = eye
    this.target = target
    this.animation = undefined
  }

  hold(): void {
    this.animation = undefined
  }

  update(dt: number): void {
    const animation = this.animation
    if (!animation) return
    animation.progress = Math.min(1, animation.progress + dt * ANIMATION_SPEED)
    const eased = ease(animation.progress)
    this.position = mix(animation.from, animation.to, eased)
    this.target = mix(animation.fromTarget, animation.toTarget, eased)
    if (animation.progress >= 1) this.animation = undefined
  }

  /** A direction given in the camera's own axes, in world axes. */
  forward(local: readonly number[]): Vec3Tuple {
    const [x, y, z, w] = lookAtQuaternion(this.position, this.target)
    return rotate(local, x, y, z, w)
  }
}
