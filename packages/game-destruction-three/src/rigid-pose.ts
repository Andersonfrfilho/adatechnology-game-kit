/**
 * How far (squared length of an axis from 1, dot of two axes from 0) a matrix may be from a turn and a move and still count as one: the error of composing and
 * decomposing poses (`getWorldQuaternion`, `attach`) is ~1e-16; a scale of 1 + 1e-6 is 5 µm on a 10 m house.
 */
const RIGID_TOLERANCE = 1e-6

/**
 * Whether the 4x4 matrix (three.js `elements`, column by column) only turns and moves: unit axes square to each other, not mirrored, no projection. What such a matrix
 * carries a set of boxes into is the same boxes, turned and moved; a scale or a shear makes them other boxes (or no boxes at all).
 */
export const isRigidPose = (e: ArrayLike<number>): boolean => {
  if (e[3] !== 0 || e[7] !== 0 || e[11] !== 0 || e[15] !== 1) return false
  const xx = e[0]! * e[0]! + e[1]! * e[1]! + e[2]! * e[2]!
  const yy = e[4]! * e[4]! + e[5]! * e[5]! + e[6]! * e[6]!
  const zz = e[8]! * e[8]! + e[9]! * e[9]! + e[10]! * e[10]!
  const xy = e[0]! * e[4]! + e[1]! * e[5]! + e[2]! * e[6]!
  const xz = e[0]! * e[8]! + e[1]! * e[9]! + e[2]! * e[10]!
  const yz = e[4]! * e[8]! + e[5]! * e[9]! + e[6]! * e[10]!
  if (Math.abs(xx - 1) > RIGID_TOLERANCE || Math.abs(yy - 1) > RIGID_TOLERANCE || Math.abs(zz - 1) > RIGID_TOLERANCE) return false
  if (Math.abs(xy) > RIGID_TOLERANCE || Math.abs(xz) > RIGID_TOLERANCE || Math.abs(yz) > RIGID_TOLERANCE) return false
  // x cross y along z: a mirror would turn the boxes inside out
  const cross = (e[1]! * e[6]! - e[2]! * e[5]!) * e[8]! + (e[2]! * e[4]! - e[0]! * e[6]!) * e[9]! + (e[0]! * e[5]! - e[1]! * e[4]!) * e[10]!
  return cross > 0
}
