import type { Vec3Tuple } from '../workshop/types'

/** Vector helpers written as three.js r128 does them, so a recipe's numbers match the page's. */
export function normalized(vector: Vec3Tuple): Vec3Tuple {
  const length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2]) || 1
  const inverse = 1 / length
  return [vector[0] * inverse, vector[1] * inverse, vector[2] * inverse]
}

export function plus(vector: Vec3Tuple, x: number, y: number, z: number): Vec3Tuple {
  return [vector[0] + x, vector[1] + y, vector[2] + z]
}

export function scaledBy(vector: Vec3Tuple, factor: number): Vec3Tuple {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor]
}

export function plusScaled(vector: Vec3Tuple, direction: Vec3Tuple, factor: number): Vec3Tuple {
  return [vector[0] + direction[0] * factor, vector[1] + direction[1] * factor, vector[2] + direction[2] * factor]
}

export function negated(vector: Vec3Tuple): Vec3Tuple {
  return [-vector[0], -vector[1], -vector[2]]
}
