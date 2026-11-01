type Vec3 = readonly [number, number, number]
type Matrix = (v: Vec3) => Vec3

const rotateX = (angle: number): Matrix => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return ([x, y, z]) => [x, c * y - s * z, s * y + c * z]
}
const rotateZ = (angle: number): Matrix => {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return ([x, y, z]) => [c * x - s * y, s * x + c * y, z]
}
const identity: Matrix = (v) => v
const compose = (outer: Matrix, inner: Matrix): Matrix => (v) => outer(inner(v))
const about = (matrix: Matrix, center: Vec3): Matrix => ([x, y, z]) => {
  const [rx, ry, rz] = matrix([x - center[0], y - center[1], z - center[2]])
  return [rx + center[0], ry + center[1], rz + center[2]]
}

const HIP: Vec3 = [0, 0.95, 0]
const TWO_PI = Math.PI * 2
const ARMS_RAISED = 0.5
const SIDE_BONES = new Set([2, 4, 7, 9])

export type PosedVertex = { readonly position: Vec3; readonly normal: Vec3 }
export type JointBone = { readonly bone: number; readonly pivot: Vec3; readonly parentPivot: Vec3 }

/**
 * The walk of the instanced shader (`bodyAnim`, pose 0) for one vertex on the CPU, at the cycle step `step` of `steps`, the arms half raised: the frames of the impostor atlas.
 * It is the shader's own maths for the pose the impostor draws (the cascade of the joints, the knee bend, the arm swing and the lean), without the per-instance extras.
 */
export const walkPoseVertex = (position: Vec3, normal: Vec3, { bone, pivot, parentPivot }: JointBone, step: number, steps: number): PosedVertex => {
  const ph = (step / steps) * TWO_PI
  const gait = 1
  const side = SIDE_BONES.has(bone) ? -1 : 1
  const isThigh = bone === 4 || bone === 5
  const isShin = bone === 9 || bone === 10
  const isArm = bone === 2 || bone === 3
  const isFore = bone === 7 || bone === 8
  const legSign = bone === 4 || bone === 9 ? 1 : -1
  const walkS = Math.sin(ph) * legSign
  const armS = Math.sin(ph) * (side > 0 ? 1 : -1)
  let parent: Matrix = identity
  let child: Matrix = identity
  if (isThigh || isShin) parent = rotateX(-walkS * 0.5 * gait)
  if (isShin) child = rotateX(Math.max(0, Math.cos(ph + (legSign > 0 ? 0 : Math.PI))) * 0.85 * gait)
  if (isArm || isFore) {
    const fwd = (1 - ARMS_RAISED) * (-0.12 + armS * 0.3 * gait) + ARMS_RAISED * (-1.35 + armS * 0.18)
    parent = compose(rotateX(fwd), rotateZ(side * 0.08))
  }
  if (isFore) child = rotateX((1 - ARMS_RAISED) * (-0.3 - Math.max(0, armS) * 0.3 * gait) + ARMS_RAISED * -0.15)
  if (bone === 11) child = rotateX(0.05)
  let transform: Matrix
  if (isFore || isShin) transform = compose(about(parent, parentPivot), about(child, pivot))
  else if (isArm || isThigh || bone === 11) transform = compose(about(child, pivot), about(parent, pivot))
  else transform = identity
  const lean = 0.12 + 0.3 * Math.min(1, gait)
  const upper = !(isThigh || isShin)
  const leanMatrix = upper ? about(rotateX(lean), HIP) : identity
  const bounce = Math.abs(Math.sin(ph)) * 0.035 * gait
  const [x, y, z] = leanMatrix(transform(position))
  const rotate = (v: Vec3): Vec3 => (upper ? rotateX(lean)(v) : v)
  const turned: Vec3 = isFore || isShin ? parent(child(normal)) : child(parent(normal))
  return { position: [x, y + bounce, z], normal: rotate(turned) }
}
