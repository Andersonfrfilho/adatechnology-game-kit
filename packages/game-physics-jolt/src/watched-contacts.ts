import type JoltNS from 'jolt-physics/wasm-compat'

import { CONTACT_READ_STRIDE } from '@adatechnology/game-physics'
import type { BodyId } from '@adatechnology/game-physics'

import { POINTS_PER_BODY } from './constants'
import type { WatchedContacts } from './entries'
import type { JoltWorldHost } from './world-host'

/** Keeps the body's contact points with their normal and depth from the next step on (the listener records them: `contacts.ts`), or stops. */
export const watchContacts = (w: JoltWorldHost, id: BodyId, on: boolean): void => {
  const watched = w.watched.get(id)
  if (!on) {
    if (!watched) return
    w.watched.delete(id)
    if (watched.ownsPoints) w.points.delete(id)
    return
  }
  if (watched) return
  const ownsPoints = !w.points.has(id)
  // the listener records a body's points only when it has an entry in `points`
  if (ownsPoints) w.points.set(id, { xyz: new Float32Array(POINTS_PER_BODY * 3), n: 0, step: -1 })
  w.watched.set(id, { data: new Float32Array(POINTS_PER_BODY * CONTACT_READ_STRIDE), n: 0, step: -1, ownsPoints })
}

/** The contact points of the last step into `out`, `CONTACT_READ_STRIDE` numbers each; 0 for a body not watched or one that touched nothing. */
export const readContacts = (w: JoltWorldHost, id: BodyId, out: Float32Array): number => {
  const watched = w.watched.get(id)
  if (!watched || watched.step !== w.stepCount) return 0
  const n = Math.min(watched.n, Math.floor(out.length / CONTACT_READ_STRIDE))
  out.set(watched.data.subarray(0, n * CONTACT_READ_STRIDE))
  return n
}

/** One manifold of the step into the body's record: the normal is out of the other body (Jolt's points from the first body to the second). */
export const recordWatched = (w: JoltWorldHost, watched: WatchedContacts, manifold: JoltNS.ContactManifold, onFirst: boolean): void => {
  if (watched.step !== w.stepCount) {
    watched.step = w.stepCount
    watched.n = 0
  }
  const normal = manifold.mWorldSpaceNormal
  const sign = onFirst ? -1 : 1
  const nx = sign * normal.GetX()
  const ny = sign * normal.GetY()
  const nz = sign * normal.GetZ()
  const depth = manifold.mPenetrationDepth
  const count = manifold.mRelativeContactPointsOn1.size()
  for (let i = 0; i < count && watched.n < POINTS_PER_BODY; i++) {
    const at = onFirst ? manifold.GetWorldSpaceContactPointOn1(i) : manifold.GetWorldSpaceContactPointOn2(i)
    const base = watched.n * CONTACT_READ_STRIDE
    watched.data[base] = at.GetX()
    watched.data[base + 1] = at.GetY()
    watched.data[base + 2] = at.GetZ()
    watched.data[base + 3] = nx
    watched.data[base + 4] = ny
    watched.data[base + 5] = nz
    watched.data[base + 6] = depth
    watched.n++
  }
}
