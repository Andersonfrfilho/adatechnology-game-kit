/*
 * Matrix and quaternion arithmetic as three.js r160 does it (MIT, https://github.com/mrdoob/three.js): the same expressions in the same order, so a
 * vertex baked here has the same bits as one baked by `Matrix4.compose` / `multiplyMatrices` / `Matrix3.getNormalMatrix` / `Vector3.normalize`.
 * Matrices are column-major arrays of 16 (4 x 4) or 9 (3 x 3) numbers, the layout of three's `elements`.
 */
import type { Mat4, RotationOrder, Transform, Vec3 } from './types'

export type Matrix4 = number[]
export type Matrix3 = number[]

export const identity4 = (): Matrix4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

/** `Quaternion.setFromEuler` (x, y, z, w). */
export function quaternionFromEuler(x: number, y: number, z: number, order: RotationOrder = 'XYZ'): [number, number, number, number] {
  const cos = Math.cos
  const sin = Math.sin
  const c1 = cos(x / 2)
  const c2 = cos(y / 2)
  const c3 = cos(z / 2)
  const s1 = sin(x / 2)
  const s2 = sin(y / 2)
  const s3 = sin(z / 2)
  switch (order) {
    case 'XYZ':
      return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
    case 'YXZ':
      return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3]
    case 'ZXY':
      return [s1 * c2 * c3 - c1 * s2 * s3, c1 * s2 * c3 + s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
    case 'ZYX':
      return [s1 * c2 * c3 - c1 * s2 * s3, c1 * s2 * c3 + s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3]
    case 'YZX':
      return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 + s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
    case 'XZY':
      return [s1 * c2 * c3 - c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3]
    default:
      throw new Error(`game-shapes: unknown rotation order "${String(order)}"`)
  }
}

/** `Matrix4.compose(position, quaternion, scale)`. */
export function compose(px: number, py: number, pz: number, q: readonly [number, number, number, number], sx: number, sy: number, sz: number): Matrix4 {
  const [x, y, z, w] = q
  const x2 = x + x
  const y2 = y + y
  const z2 = z + z
  const xx = x * x2
  const xy = x * y2
  const xz = x * z2
  const yy = y * y2
  const yz = y * z2
  const zz = z * z2
  const wx = w * x2
  const wy = w * y2
  const wz = w * z2
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    px, py, pz, 1,
  ]
}

/** `Matrix4.makeRotationY(theta)` followed by `setPosition(x, y, z)`. */
export function headingMatrix(theta: number, x = 0, y = 0, z = 0): Matrix4 {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, y, z, 1]
}

/** `Matrix4.multiplyMatrices(a, b)`: a x b. */
export function multiply(ae: readonly number[], be: readonly number[]): Matrix4 {
  const a11 = ae[0]!, a12 = ae[4]!, a13 = ae[8]!, a14 = ae[12]!
  const a21 = ae[1]!, a22 = ae[5]!, a23 = ae[9]!, a24 = ae[13]!
  const a31 = ae[2]!, a32 = ae[6]!, a33 = ae[10]!, a34 = ae[14]!
  const a41 = ae[3]!, a42 = ae[7]!, a43 = ae[11]!, a44 = ae[15]!
  const b11 = be[0]!, b12 = be[4]!, b13 = be[8]!, b14 = be[12]!
  const b21 = be[1]!, b22 = be[5]!, b23 = be[9]!, b24 = be[13]!
  const b31 = be[2]!, b32 = be[6]!, b33 = be[10]!, b34 = be[14]!
  const b41 = be[3]!, b42 = be[7]!, b43 = be[11]!, b44 = be[15]!
  return [
    a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41,
    a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41,
    a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41,
    a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41,
    a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42,
    a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42,
    a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42,
    a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42,
    a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43,
    a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43,
    a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43,
    a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43,
    a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44,
    a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44,
    a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44,
    a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44,
  ]
}

/** `Matrix3.getNormalMatrix(m)`: the inverse transpose of the upper 3 x 3 (all zeros when singular, as three). */
export function normalMatrix(me: readonly number[]): Matrix3 {
  // setFromMatrix4
  const n11 = me[0]!, n21 = me[1]!, n31 = me[2]!
  const n12 = me[4]!, n22 = me[5]!, n32 = me[6]!
  const n13 = me[8]!, n23 = me[9]!, n33 = me[10]!
  // invert
  const t11 = n33 * n22 - n32 * n23
  const t12 = n32 * n13 - n33 * n12
  const t13 = n23 * n12 - n22 * n13
  const det = n11 * t11 + n21 * t12 + n31 * t13
  if (det === 0) return [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const detInv = 1 / det
  const te = [
    t11 * detInv,
    (n31 * n23 - n33 * n21) * detInv,
    (n32 * n21 - n31 * n22) * detInv,
    t12 * detInv,
    (n33 * n11 - n31 * n13) * detInv,
    (n31 * n12 - n32 * n11) * detInv,
    t13 * detInv,
    (n21 * n13 - n23 * n11) * detInv,
    (n22 * n11 - n21 * n12) * detInv,
  ]
  // transpose
  let tmp = te[1]!
  te[1] = te[3]!
  te[3] = tmp
  tmp = te[2]!
  te[2] = te[6]!
  te[6] = tmp
  tmp = te[5]!
  te[5] = te[7]!
  te[7] = tmp
  return te
}

/** True when the last row is (0, 0, 0, 1): `applyMatrix4`'s divide by w is then a multiply by exactly 1. */
export const isAffine = (e: readonly number[]): boolean => e[3] === 0 && e[7] === 0 && e[11] === 0 && e[15] === 1

/** `Vector3.applyMatrix4`. */
export function transformPoint(e: readonly number[], x: number, y: number, z: number): [number, number, number] {
  const w = 1 / (e[3]! * x + e[7]! * y + e[11]! * z + e[15]!)
  return [(e[0]! * x + e[4]! * y + e[8]! * z + e[12]!) * w, (e[1]! * x + e[5]! * y + e[9]! * z + e[13]!) * w, (e[2]! * x + e[6]! * y + e[10]! * z + e[14]!) * w]
}

const toVec3 = (scale: number | Vec3 | undefined): Vec3 => (scale === undefined ? [1, 1, 1] : typeof scale === 'number' ? [scale, scale, scale] : scale)

/** True when the transform has no field set. */
export const isIdentityTransform = (t: Transform): boolean =>
  t.matrix === undefined && t.heading === undefined && t.position === undefined && t.rotation === undefined && t.scale === undefined

/** The local matrix of a transform, or `null` when it has none. */
export function matrixOf(t: Transform): Matrix4 | null {
  if (t.matrix !== undefined) return [...t.matrix]
  if (t.heading !== undefined) {
    const p = t.position ?? [0, 0, 0]
    return headingMatrix(t.heading, p[0], p[1], p[2])
  }
  if (t.position === undefined && t.rotation === undefined && t.scale === undefined) return null
  const p = t.position ?? [0, 0, 0]
  const r = t.rotation ?? [0, 0, 0]
  const s = toVec3(t.scale)
  return compose(p[0], p[1], p[2], quaternionFromEuler(r[0], r[1], r[2], t.rotationOrder ?? 'XYZ'), s[0], s[1], s[2])
}

/** The matrix as given, as a plain array (for `ShapePart.matrix`). */
export const asMat4 = (m: Matrix4 | null): Mat4 => (m ? [...m] : identity4())
