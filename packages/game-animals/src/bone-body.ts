import type { BodyDesc, Vec3 as PhysicsVec3 } from '@adatechnology/game-physics'

import type { Bone, Point } from './anatomy'

/** Soft tissue and bone: a little under water. */
const DENSITY_KG_PER_CUBIC_METRE = 900
const MINIMUM_CAPSULE_HALF_HEIGHT = 0.01
export const USER_STRIDE = 32

export const lengthOf = (bone: Bone): number => Math.hypot(bone.end[0] - bone.start[0], bone.end[1] - bone.start[1], bone.end[2] - bone.start[2])

export const middleOf = (bone: Bone): Point => [(bone.start[0] + bone.end[0]) / 2, (bone.start[1] + bone.end[1]) / 2, (bone.start[2] + bone.end[2]) / 2]

/** Mass of a capsule (or a sphere when the bone is too short for one) of the bone's size. */
export const massOfBone = (bone: Bone): number => {
  const halfHeight = lengthOf(bone) / 2 - bone.radius
  const sphere = (4 / 3) * Math.PI * bone.radius ** 3
  if (halfHeight <= MINIMUM_CAPSULE_HALF_HEIGHT) return sphere * DENSITY_KG_PER_CUBIC_METRE
  return (sphere + Math.PI * bone.radius ** 2 * halfHeight * 2) * DENSITY_KG_PER_CUBIC_METRE
}

export const shiftBy = (point: Point, offset: PhysicsVec3): PhysicsVec3 => [point[0] + offset[0], point[1] + offset[1], point[2] + offset[2]]

const SURFACE = { frictionStatic: 0.8, frictionDynamic: 0.6, restitution: 0.05 } as const

/** A box body, upright (the legs of the chain, seen as one block): `centre` is its middle. */
export const bodyOfBox = (half: PhysicsVec3, centre: Point, mass: number, at: PhysicsVec3, user: number): Omit<BodyDesc, 'motion' | 'group'> => ({
  shape: { kind: 'box', half },
  position: shiftBy(centre, at),
  mass,
  layer: 'character',
  angularDamping: 0.3,
  linearDamping: 0.05,
  material: SURFACE,
  user,
})

/** The body of a bone: a capsule along it (all the bones lie in the plane of symmetry's parallel, so the turn is about x), or a sphere when it is short. */
export const bodyOfBone = (bone: Bone, mass: number, at: PhysicsVec3, user: number): Omit<BodyDesc, 'motion' | 'group'> => {
  const halfHeight = lengthOf(bone) / 2 - bone.radius
  const angle = Math.atan2(bone.end[2] - bone.start[2], bone.end[1] - bone.start[1])
  const common = {
    position: shiftBy(middleOf(bone), at),
    rotation: [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)] as const,
    mass,
    layer: 'character',
    angularDamping: 0.3,
    linearDamping: 0.05,
    material: SURFACE,
    user,
  } as const
  if (halfHeight <= MINIMUM_CAPSULE_HALF_HEIGHT) return { ...common, shape: { kind: 'sphere', radius: Math.max(bone.radius, lengthOf(bone) / 2) } }
  return { ...common, shape: { kind: 'capsule', halfHeight, radius: bone.radius } }
}
