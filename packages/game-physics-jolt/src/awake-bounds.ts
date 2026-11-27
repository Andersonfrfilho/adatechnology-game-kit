import { AWAKE_BOUNDS_STRIDE, AWAKE_KIND_BODY, AWAKE_KIND_CHARACTER } from '@adatechnology/game-physics'
import type { BodyId } from '@adatechnology/game-physics'

import { vec3At } from './vec3'
import type { JoltWorldHost } from './world-host'

/** `PhysicsWorld.readAwakeBounds`: the awake dynamic bodies, then the characters; the heap is read in place and nothing is allocated. */
export const readAwakeBounds = (w: JoltWorldHost, out: Float64Array, skip?: ReadonlySet<BodyId>): number => {
  const J = w.J
  const ids = w.activeIds
  w.system.GetActiveBodies(J.EBodyType_RigidBody, ids)
  const n = ids.size()
  const capacity = Math.floor(out.length / AWAKE_BOUNDS_STRIDE)
  let rows = 0
  for (let i = 0; i < n; i++) {
    const key = ids.at(i).GetIndexAndSequenceNumber()
    if (skip?.has(key as BodyId)) continue
    const e = w.bodies.get(key)
    if (!e || e.body.GetMotionType() !== J.EMotionType_Dynamic) continue
    if (rows < capacity) {
      const o = rows * AWAKE_BOUNDS_STRIDE
      const heap = J.HEAPF32
      const bounds = e.body.GetWorldSpaceBounds()
      let at = vec3At(J, bounds.mMin)
      out[o + 2] = heap[at] as number
      out[o + 3] = heap[at + 1] as number
      out[o + 4] = heap[at + 2] as number
      at = vec3At(J, bounds.mMax)
      out[o + 5] = heap[at] as number
      out[o + 6] = heap[at + 1] as number
      out[o + 7] = heap[at + 2] as number
      at = vec3At(J, e.body.GetLinearVelocity())
      out[o] = AWAKE_KIND_BODY
      out[o + 1] = key
      out[o + 8] = heap[at] as number
      out[o + 9] = heap[at + 2] as number
    }
    rows++
  }
  for (const [id, character] of w.characters) {
    if (rows < capacity) {
      const o = rows * AWAKE_BOUNDS_STRIDE
      out[o] = AWAKE_KIND_CHARACTER
      out[o + 1] = id
      character.bounds(out, o + 2)
    }
    rows++
  }
  return rows
}
