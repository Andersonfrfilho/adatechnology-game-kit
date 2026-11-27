import type { RayBroadPhase, Vec3 } from '@adatechnology/game-destruction'
import type { BodyId, QueryFilter, RayHit, SeamWorld } from '@adatechnology/game-physics'

import type { EngineStatics } from './engine-statics'

/** How far (m) past the ray the engine looks: the bodies follow the drawn parts one update behind (a door that swings), so a ray never misses a part that moved a hand's width. */
const RAY_MARGIN = 0.25
/** A ray longer than this (m) is not asked of the engine: the world tries every object. */
const LONGEST_RAY = 2000
const FIXED_ONLY: QueryFilter = { layers: ['static'] }

/** Whether the segment (origin, unit direction, length) comes within `RAY_MARGIN` of the box (min x, y, z then max x, y, z): the slab test on the box grown by the margin. */
const segmentMeetsBox = (origin: Vec3, direction: Vec3, length: number, box: Float64Array): boolean => {
  let enter = 0
  let leave = length
  for (let axis = 0; axis < 3; axis++) {
    const low = (box[axis] as number) - RAY_MARGIN
    const high = (box[axis + 3] as number) + RAY_MARGIN
    const step = direction[axis] as number
    const start = origin[axis] as number
    if (Math.abs(step) < 1e-12) {
      if (start < low || start > high) return false
      continue
    }
    const a = (low - start) / step
    const b = (high - start) / step
    enter = Math.max(enter, Math.min(a, b))
    leave = Math.min(leave, Math.max(a, b))
    if (enter > leave) return false
  }
  return true
}

/**
 * The engine's broad phase for the rays of the destruction world: the fixed bodies a fat ray (the ray swept by `RAY_MARGIN`, and the sphere where it starts) meets name the
 * objects it may touch. It only leaves objects out; the hit is still the drawn surface, which the world tests. An object the engine does not hold every part of is always tried.
 */
export const createEngineRayBroadPhase = (world: SeamWorld, statics: EngineStatics): RayBroadPhase => {
  const hits: RayHit[] = []
  const inside: BodyId[] = []
  const met = new Set<string>()
  const metList: string[] = []
  const from: Vec3 = [0, 0, 0]
  const toward: Vec3 = [0, 0, 0]
  return {
    begin(origin, direction, maxDistance) {
      if (!(maxDistance <= LONGEST_RAY)) return false
      met.clear()
      metList.length = 0
      from[0] = origin[0]
      from[1] = origin[1]
      from[2] = origin[2]
      toward[0] = direction[0]
      toward[1] = direction[1]
      toward[2] = direction[2]
      const count = world.sphereCastAll(from, toward, maxDistance, RAY_MARGIN, hits, FIXED_ONLY)
      for (let i = 0; i < count; i++) {
        const owner = statics.ownerOf.get(hits[i]!.body)
        if (owner !== undefined && !met.has(owner)) {
          met.add(owner)
          metList.push(owner)
        }
      }
      // a mesh is the drawn surface, which can lie well inside the volume the world tests (a crown of leaves under its box): the box around the meshes is met as well
      for (const [owner, bounds] of statics.meshBounds) {
        if (!met.has(owner) && segmentMeetsBox(origin, direction, maxDistance, bounds)) {
          met.add(owner)
          metList.push(owner)
        }
      }
      const around = world.overlapSphere(from, RAY_MARGIN, inside, FIXED_ONLY)
      for (let i = 0; i < around; i++) {
        const owner = statics.ownerOf.get(inside[i]!)
        if (owner !== undefined && !met.has(owner)) {
          met.add(owner)
          metList.push(owner)
        }
      }
      return true
    },
    mayMeet: (objectId) => !statics.covers(objectId) || met.has(objectId),
    candidates: {
      met: () => metList,
      covers: (objectId) => statics.covers(objectId),
      revision: () => statics.coverageRevision,
    },
  }
}
