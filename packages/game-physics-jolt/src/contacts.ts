import type JoltNS from 'jolt-physics/wasm-compat'

import type { BodyId, ContactBuffer } from '@adatechnology/game-physics'

import { POINTS_PER_BODY, ROW_CAPACITY } from './constants'
import type { Jolt } from './constants'
import type { BodyEntry } from './entries'
import { vec3At } from './vec3'
import type { JoltWorld } from './world'

export class Contacts implements ContactBuffer {
  count = 0
  /** Contacts over `reportSpeed` that found no row (`maxContacts`): cleared with the events. */
  dropped = 0
  readonly a = new Int32Array(ROW_CAPACITY)
  readonly b = new Int32Array(ROW_CAPACITY)
  readonly userA = new Int32Array(ROW_CAPACITY)
  readonly userB = new Int32Array(ROW_CAPACITY)
  readonly tagA = new Int32Array(ROW_CAPACITY)
  readonly tagB = new Int32Array(ROW_CAPACITY)
  readonly point = new Float32Array(ROW_CAPACITY * 3)
  readonly normal = new Float32Array(ROW_CAPACITY * 3)
  readonly approach = new Float32Array(ROW_CAPACITY)
  readonly impulse = new Float32Array(ROW_CAPACITY)
}

/** Scratch for one contact's first point and normal: reused, so a contact makes no garbage. */
const P: [number, number, number] = [0, 0, 0]
const N: [number, number, number] = [0, 0, 0]

/** The speed (m/s) a body's point at `P` moves along `N`: 0 for a fixed body. The vectors are read from the heap (`vec3At`): a contact reads thousands in the frame a wall wakes. */
const speedAlong = (J: Jolt, e: BodyEntry): number => {
  if (e.invMass === 0 && e.layer === 'static') return 0
  const body = e.body
  const heap = J.HEAPF32
  let at = vec3At(J, body.GetLinearVelocity())
  const vx = heap[at] as number, vy = heap[at + 1] as number, vz = heap[at + 2] as number
  at = vec3At(J, body.GetAngularVelocity())
  const wx = heap[at] as number, wy = heap[at + 1] as number, wz = heap[at + 2] as number
  at = vec3At(J, body.GetCenterOfMassPosition())
  const rx = P[0] - (heap[at] as number)
  const ry = P[1] - (heap[at + 1] as number)
  const rz = P[2] - (heap[at + 2] as number)
  return (vx + wy * rz - wz * ry) * N[0] + (vy + wz * rx - wx * rz) * N[1] + (vz + wx * ry - wy * rx) * N[2]
}

/** A new contact's restitution, mixed as the kit mixes it, and its row in `contacts` if it closed faster than `reportSpeed`. */
const added = (w: JoltWorld, pair: { e1: BodyEntry; e2: BodyEntry }, m: JoltNS.ContactManifold, cs: JoltNS.ContactSettings): void => {
  const { e1, e2 } = pair
  if (cs.mIsSensor) {
    w.sensorEvents.push(e1.layer === 'sensor' ? { sensor: e1.key as BodyId, other: e2.key as BodyId, entered: true } : { sensor: e2.key as BodyId, other: e1.key as BodyId, entered: true })
    return
  }
  cs.mCombinedRestitution = Math.sqrt(e1.material.restitution * e2.material.restitution)
  const J = w.J
  const heap = J.HEAPF32
  let at = vec3At(J, m.mWorldSpaceNormal)
  N[0] = heap[at] as number
  N[1] = heap[at + 1] as number
  N[2] = heap[at + 2] as number
  // the relative velocity of the first contact point, body 1 minus body 2 (the normal points from 1 to 2)
  at = vec3At(J, m.GetWorldSpaceContactPointOn1(0))
  P[0] = heap[at] as number
  P[1] = heap[at + 1] as number
  P[2] = heap[at + 2] as number
  const along = speedAlong(J, e1) - speedAlong(J, e2)
  if (along < w.reportSpeed) return
  const c = w.contacts
  if (c.count >= w.maxContacts) {
    c.dropped++
    return
  }
  const i = c.count++
  c.a[i] = e1.key
  c.b[i] = e2.key
  c.userA[i] = e1.user
  c.userB[i] = e2.user
  c.tagA[i] = e1.body.GetShape().GetSubShapeUserData(m.mSubShapeID1) | 0
  c.tagB[i] = e2.body.GetShape().GetSubShapeUserData(m.mSubShapeID2) | 0
  for (let k = 0; k < 3; k++) {
    c.point[i * 3 + k] = P[k]
    c.normal[i * 3 + k] = N[k]
  }
  c.approach[i] = along
  // the impulse that stops the closing speed along the normal, by the two masses (rotation ignored): what our damage reads as the blow
  const invMass = e1.invMass + e2.invMass
  c.impulse[i] = invMass > 0 ? ((1 + cs.mCombinedRestitution) * along) / invMass : 0
}

const recordPoints = (w: JoltWorld, key: number, m: JoltNS.ContactManifold, onFirst: boolean): void => {
  const p = w.points.get(key)
  if (!p) return
  if (p.step !== w.stepCount) {
    p.step = w.stepCount
    p.n = 0
  }
  const count = m.mRelativeContactPointsOn1.size()
  for (let i = 0; i < count && p.n < POINTS_PER_BODY; i++) {
    const at = onFirst ? m.GetWorldSpaceContactPointOn1(i) : m.GetWorldSpaceContactPointOn2(i)
    p.xyz[p.n * 3] = at.GetX()
    p.xyz[p.n * 3 + 1] = at.GetY()
    p.xyz[p.n * 3 + 2] = at.GetZ()
    p.n++
  }
}

const recordPair = (w: JoltWorld, k1: number, k2: number, m: JoltNS.ContactManifold): void => {
  recordPoints(w, k1, m, true)
  recordPoints(w, k2, m, false)
}

/**
 * One JS listener for the whole world. A new contact: who touches whom (`touching`, and the partners `updateFriction` reads; never a sensor), restitution mixed as the kit
 * mixes it (geometric mean; Jolt's default takes the larger), and a row in `contacts` if it closed faster than `reportSpeed`. A kept contact only records its
 * points for a body asked about (`contactPoints`): friction is the bodies' own (`updateFriction`), mixed by Jolt, so no rule runs per contact per step
 * (gate 0 B6: that rule was a third of the frame a wall woke in).
 */
export const makeListener = (w: JoltWorld): JoltNS.ContactListenerJS => {
  const J = w.J
  const listener = new J.ContactListenerJS()
  // the bodies come as heap addresses: entries are found by them, so a contact asks Jolt only for what it must (one call across the wasm boundary costs as
  // much as the rest of the rule; a wall waking at once makes thousands of contacts in one step)
  const pair = { e1: null as unknown as BodyEntry, e2: null as unknown as BodyEntry }
  listener.OnContactValidate = (body1: number, body2: number) => {
    if (w.ignored.size === 0) return J.ValidateResult_AcceptAllContactsForThisBodyPair
    const e1 = w.byPointer.get(body1)
    const e2 = w.byPointer.get(body2)
    if (!e1 || !e2) return J.ValidateResult_AcceptAllContactsForThisBodyPair
    return w.ignored.has(w.pairKey(e1.key, e2.key)) ? J.ValidateResult_RejectAllContactsForThisBodyPair : J.ValidateResult_AcceptAllContactsForThisBodyPair
  }
  listener.OnContactAdded = (body1: number, body2: number, manifold: number, settings: number) => {
    const e1 = w.byPointer.get(body1)
    const e2 = w.byPointer.get(body2)
    if (!e1 || !e2) return
    const cs = J.wrapPointer(settings, J.ContactSettings)
    pair.e1 = e1
    pair.e2 = e2
    // a sensor is overlapped, not touched: it is no one's partner and keeps no one `touching` (rolling resistance would brake a body in the air)
    const sensor = e1.layer === 'sensor' || e2.layer === 'sensor'
    if (!sensor) {
      w.touch(e1.key, e2.key, 1)
      w.touch(e2.key, e1.key, 1)
      if (w.trackPairs) w.pairLog.push(e1.key, e2.key)
    }
    const m = J.wrapPointer(manifold, J.ContactManifold)
    if (!sensor && w.points.size > 0) recordPair(w, e1.key, e2.key, m)
    added(w, pair, m, cs)
  }
  listener.OnContactPersisted = (body1: number, body2: number, manifold: number) => {
    if (w.points.size === 0) return
    const e1 = w.byPointer.get(body1)
    const e2 = w.byPointer.get(body2)
    if (!e1 || !e2 || (!w.points.has(e1.key) && !w.points.has(e2.key))) return
    recordPair(w, e1.key, e2.key, J.wrapPointer(manifold, J.ContactManifold))
  }
  listener.OnContactRemoved = (subPair: number) => {
    const p = J.wrapPointer(subPair, J.SubShapeIDPair)
    const k1 = p.GetBody1ID().GetIndexAndSequenceNumber()
    const k2 = p.GetBody2ID().GetIndexAndSequenceNumber()
    w.touch(k1, k2, -1)
    w.touch(k2, k1, -1)
    const e1 = w.bodies.get(k1)
    const e2 = w.bodies.get(k2)
    if (e1?.layer === 'sensor') w.sensorEvents.push({ sensor: k1 as BodyId, other: k2 as BodyId, entered: false })
    else if (e2?.layer === 'sensor') w.sensorEvents.push({ sensor: k2 as BodyId, other: k1 as BodyId, entered: false })
  }
  return listener
}
