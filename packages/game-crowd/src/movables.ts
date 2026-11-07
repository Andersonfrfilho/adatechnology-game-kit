/**
 * Furniture the agents bump into and may shove: the host lists the boxes on the floor (a sofa, a wardrobe), an agent walking into one stops at its face and, when it
 * was going into it, leans its force on it. The forces of the agents on the same piece add up; the host reads them (`flush`) and decides whether and how far it moves.
 */

/** A box on the floor, in the crowd's metres. `top` is its height: an agent above it (on a pile, in the air) goes over. */
export type CrowdMovable = { readonly id: string; readonly minX: number; readonly minZ: number; readonly maxX: number; readonly maxZ: number; readonly top: number }

/** What the agents did to one piece in the last update: the sum of their forces, its direction on the floor and how many leaned on it. */
export type CrowdShove = { readonly id: string; readonly dirX: number; readonly dirZ: number; readonly forceN: number; readonly pushers: number }

export type MovableHit = { readonly index: number; readonly intoX: number; readonly intoZ: number }

export interface MovableContacts {
  readonly list: readonly CrowdMovable[]
  set(list: readonly CrowdMovable[]): void
  /** The piece whose box (grown by the body's `radius`) holds `(x, z)` for a body at height `y`, or null. */
  at(x: number, z: number, y: number, radius: number): MovableHit | null
  /** Agent `agent` leans `forceN` along `(dirX, dirZ)` on piece `index`; once per agent and update, the strongest kept. */
  lean(index: number, agent: number, dirX: number, dirZ: number, forceN: number): void
  /** The shoves of this update, and a fresh start for the next. */
  flush(): CrowdShove[]
}

/** How far into the face the walk must point (the cosine) for the step to be a push and not a brush along the side. */
const INTO_MIN = 0.3

type Sum = { x: number; z: number; agents: Map<number, readonly [number, number]> }

export function createMovableContacts(): MovableContacts {
  let list: readonly CrowdMovable[] = []
  let sums: Sum[] = []

  return {
    get list() {
      return list
    },
    set(next) {
      list = next
      sums = next.map(() => ({ x: 0, z: 0, agents: new Map() }))
    },
    at(x, z, y, radius) {
      for (let k = 0; k < list.length; k++) {
        const m = list[k]!
        if (y >= m.top || x < m.minX - radius || x > m.maxX + radius || z < m.minZ - radius || z > m.maxZ + radius) continue
        const cx = Math.max(m.minX, Math.min(m.maxX, x)) - x
        const cz = Math.max(m.minZ, Math.min(m.maxZ, z)) - z
        const d = Math.hypot(cx, cz)
        return d < 1e-6 ? { index: k, intoX: 0, intoZ: 0 } : { index: k, intoX: cx / d, intoZ: cz / d }
      }
      return null
    },
    lean(index, agent, dirX, dirZ, forceN) {
      const sum = sums[index]
      if (!sum) return
      const length = Math.hypot(dirX, dirZ)
      if (length < 1e-6) return
      const fx = (dirX / length) * forceN
      const fz = (dirZ / length) * forceN
      const before = sum.agents.get(agent)
      if (before) {
        if (Math.hypot(before[0], before[1]) >= forceN) return
        sum.x -= before[0]
        sum.z -= before[1]
      }
      sum.agents.set(agent, [fx, fz])
      sum.x += fx
      sum.z += fz
    },
    flush() {
      const out: CrowdShove[] = []
      for (let k = 0; k < sums.length; k++) {
        const sum = sums[k]!
        if (sum.agents.size === 0) continue
        const force = Math.hypot(sum.x, sum.z)
        if (force > 1e-6) out.push({ id: list[k]!.id, dirX: sum.x / force, dirZ: sum.z / force, forceN: force, pushers: sum.agents.size })
        sum.x = 0
        sum.z = 0
        sum.agents.clear()
      }
      return out
    },
  }
}

/** Whether a walk along `(walkX, walkZ)` goes into the face whose inward normal is `(intoX, intoZ)` (a body inside the box always pushes). */
export const walksInto = (walkX: number, walkZ: number, hit: MovableHit): boolean => {
  if (hit.intoX === 0 && hit.intoZ === 0) return true
  const length = Math.hypot(walkX, walkZ)
  return length > 1e-6 && (walkX * hit.intoX + walkZ * hit.intoZ) / length > INTO_MIN
}

export type ShoveRequest = {
  readonly agent: number
  /** Where the body is and where its step would take it. */
  readonly x: number
  readonly z: number
  readonly nx: number
  readonly nz: number
  readonly y: number
  readonly radius: number
  /** Where it wants to walk (its wanted velocity) and the force it leans with. */
  readonly walkX: number
  readonly walkZ: number
  readonly forceN: number
  /** The crowd's own walls at a point. */
  blocked(x: number, z: number): boolean
}

/** Where the body ends after its step and the way it leans (unit, or 0). */
export type ShoveStep = { readonly x: number; readonly z: number; readonly leanX: number; readonly leanZ: number }

/**
 * A step into a movable piece: the body stops at its face and, walking into it, leans its force on it; what of the step goes along the face (not into it, not into a wall)
 * still moves. Null when the step meets no movable piece.
 */
export function shoveStep(contacts: MovableContacts, r: ShoveRequest): ShoveStep | null {
  const hit = contacts.at(r.nx, r.nz, r.y, r.radius)
  if (!hit) return null
  let leanX = 0
  let leanZ = 0
  if (walksInto(r.walkX, r.walkZ, hit)) {
    const length = Math.hypot(r.walkX, r.walkZ) || 1
    contacts.lean(hit.index, r.agent, r.walkX, r.walkZ, r.forceN)
    leanX = r.walkX / length
    leanZ = r.walkZ / length
  }
  if (!contacts.at(r.nx, r.z, r.y, r.radius) && !r.blocked(r.nx, r.z)) return { x: r.nx, z: r.z, leanX, leanZ }
  if (!contacts.at(r.x, r.nz, r.y, r.radius) && !r.blocked(r.x, r.nz)) return { x: r.x, z: r.nz, leanX, leanZ }
  return { x: r.x, z: r.z, leanX, leanZ }
}
