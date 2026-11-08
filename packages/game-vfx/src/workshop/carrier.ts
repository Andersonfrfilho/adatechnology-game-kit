import type { Vec3Tuple } from './types'

/** A unit quaternion `[x, y, z, w]`. */
export type Quaternion = readonly [number, number, number, number]

/**
 * The live pose of the thing an effect belongs to (the muzzle of a gun in the hands), moved by whoever plays the effect while it lives: the pieces drawn in
 * its own axes (the cones of a muzzle flash) and its lights ride on it, and what is thrown free (smoke) stays in the world.
 */
export interface Carrier {
  origin: Vec3Tuple
  orientation: Quaternion | undefined
}

/** What a piece keeps to ride on a carrier: the carrier and where the piece sits in the recipe's space (from the recipe's anchor). */
export interface Carried {
  readonly carrier: Carrier
  readonly local: Vec3Tuple
}

/** The vector turned by the unit quaternion (three.js's `applyQuaternion`). */
export function rotate(q: Quaternion, v: Vec3Tuple): Vec3Tuple {
  const [qx, qy, qz, qw] = q
  const ix = qw * v[0] + qy * v[2] - qz * v[1]
  const iy = qw * v[1] + qz * v[0] - qx * v[2]
  const iz = qw * v[2] + qx * v[1] - qy * v[0]
  const iw = -qx * v[0] - qy * v[1] - qz * v[2]
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx]
}

/** Where a carried piece sits in the world now. */
export function carriedPoint(carried: Carried): Vec3Tuple {
  const { carrier, local } = carried
  const turned = carrier.orientation ? rotate(carrier.orientation, local) : local
  return [carrier.origin[0] + turned[0], carrier.origin[1] + turned[1], carrier.origin[2] + turned[2]]
}
