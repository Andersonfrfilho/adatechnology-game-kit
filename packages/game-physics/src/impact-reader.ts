import type { BodyId, ContactBuffer } from './contract'
import type { PhysicsLoop } from './loop'

/** One body's strongest blow of the frame. The object is reused for every call: read it inside `onImpact`, never keep it. */
export interface Impact {
  body: BodyId
  /** The body it met in that blow. */
  other: BodyId
  /** The engine's estimate of the blow (N s). */
  impulse: number
  /** The speed (m/s) the two closed at along the normal. */
  approach: number
  readonly point: [number, number, number]
  /** Unit, from this body toward `other`. */
  readonly normal: [number, number, number]
}

export interface ImpactReaderOptions {
  /** Blows under this impulse (N s) are not told. */
  readonly minImpulse: number
  /** Most bodies told in a frame, in the order the engine met them. Default 64. */
  readonly bodiesMax?: number
  /** Which bodies to tell about (a host that only cares about its fixed parts says so before anything is counted). Default every one. */
  readonly accepts?: (body: BodyId) => boolean
  /** Bodies whose blows are not told at all, as if they had met nothing (asked for every contact row). Default none. */
  readonly ignores?: (other: BodyId) => boolean
  readonly onImpact: (impact: Impact) => void
}

const DEFAULT_BODIES_MAX = 64

/**
 * The frame's contact rows turned into one blow per body: the strongest of the frame, told once in the loop's `contacts` phase. The slots are made once, so a frame with
 * a thousand rows makes nothing; what the host does with a blow (damage, a sound) is its own. Rows past `maxContacts` are the engine's `contacts.dropped`.
 */
export const createImpactReader = (loop: PhysicsLoop, options: ImpactReaderOptions): (() => void) => {
  const world = loop.world
  const capacity = options.bodiesMax ?? DEFAULT_BODIES_MAX
  // body id -> slot by open addressing over arrays made once: a frame's table is the one stamped with its number, so nothing is cleared and nothing is allocated
  let size = 4
  while (size < capacity * 2) size *= 2
  const mask = size - 1
  const tableKey = new Int32Array(size)
  const tableStamp = new Uint32Array(size)
  const tableSlot = new Int32Array(size)
  let stamp = 0
  let told = 0
  const bodies = new Int32Array(capacity)
  const others = new Int32Array(capacity)
  const impulses = new Float32Array(capacity)
  const approaches = new Float32Array(capacity)
  const points = new Float32Array(capacity * 3)
  const normals = new Float32Array(capacity * 3)
  const impact: Impact = { body: 0 as BodyId, other: 0 as BodyId, impulse: 0, approach: 0, point: [0, 0, 0], normal: [0, 0, 0] }

  const keep = (c: ContactBuffer, body: number, other: number, row: number, sign: number): void => {
    if (options.ignores?.(other as BodyId)) return
    let at = Math.imul(body, 0x9e3779b1) & mask
    while (tableStamp[at] === stamp && tableKey[at] !== body) at = (at + 1) & mask
    let slot: number
    if (tableStamp[at] === stamp) slot = tableSlot[at]!
    else {
      if (told >= capacity || (options.accepts && !options.accepts(body as BodyId))) return
      slot = told++
      tableStamp[at] = stamp
      tableKey[at] = body
      tableSlot[at] = slot
      impulses[slot] = 0
      bodies[slot] = body
    }
    if (c.impulse[row]! <= impulses[slot]!) return
    others[slot] = other
    impulses[slot] = c.impulse[row]!
    approaches[slot] = c.approach[row]!
    for (let k = 0; k < 3; k++) {
      points[slot * 3 + k] = c.point[row * 3 + k]!
      normals[slot * 3 + k] = c.normal[row * 3 + k]! * sign
    }
  }

  const afterSteps = (): void => {
    const c = world.contacts
    stamp++
    told = 0
    for (let row = 0; row < c.count; row++) {
      if (c.impulse[row]! < options.minImpulse) continue
      keep(c, c.a[row]!, c.b[row]!, row, 1)
      keep(c, c.b[row]!, c.a[row]!, row, -1)
    }
    const count = told
    for (let slot = 0; slot < count; slot++) {
      impact.body = bodies[slot] as BodyId
      impact.other = others[slot] as BodyId
      impact.impulse = impulses[slot]!
      impact.approach = approaches[slot]!
      for (let k = 0; k < 3; k++) {
        impact.point[k] = points[slot * 3 + k]!
        impact.normal[k] = normals[slot * 3 + k]!
      }
      if (impact.impulse > 0) options.onImpact(impact)
    }
  }

  return loop.add({ afterSteps }, 'contacts')
}
