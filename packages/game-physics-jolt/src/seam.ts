import type JoltNS from 'jolt-physics/wasm-compat'

import type { BodyDesc } from '@adatechnology/game-physics'

import type { BodyEntry } from './entries'

/** How far (m) under the top face of a slab a contact still counts as on its lip, and from an edge a contact still counts as on it. */
const LIP_BAND = 0.01
/** Under this vertical share of the penetration axis a contact is the slab's side, not its top. */
const TOP_AXIS = 0.9
/** How far (m) apart two slab tops may be and still be one surface; how far (m) past an edge the neighbour is looked for. */
const COPLANAR = 0.001
const PROBE = 0.005
const CELL = 2
/** A slab reaching more cells than this is not indexed as a neighbour (the ground's tiles are 2 m: one to four cells). */
const MAX_CELLS = 64

/** A flat slab: a static upright box with square edges (the ground's level tiles), as the rectangle of its top face. */
export interface Slab {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
  readonly top: number
}

/** The slab a body is, if it is one: static, an upright box with `convexRadius: 0`. */
export const slabOf = (desc: BodyDesc): { readonly slab: Slab } | Record<string, never> => {
  const { shape, motion, rotation, position } = desc
  if (motion !== 'static' || shape.kind !== 'box' || shape.convexRadius !== 0) return {}
  if (rotation && (Math.abs(rotation[0]) > 1e-6 || Math.abs(rotation[1]) > 1e-6 || Math.abs(rotation[2]) > 1e-6)) return {}
  return { slab: { minX: position[0] - shape.half[0], maxX: position[0] + shape.half[0], minZ: position[2] - shape.half[2], maxZ: position[2] + shape.half[2], top: position[1] + shape.half[1] } }
}

const cellKey = (cx: number, cz: number): number => (cx * 73856093) ^ (cz * 19349663)

/** The slabs of a world by 2 m cell, to find the one that shares an edge with another without allocating per contact. */
export class SlabIndex {
  private readonly cells = new Map<number, BodyEntry[]>()
  size = 0

  add(entry: BodyEntry): void {
    const slab = entry.slab
    if (!slab) return
    this.size++
    const x0 = Math.floor(slab.minX / CELL), x1 = Math.floor(slab.maxX / CELL), z0 = Math.floor(slab.minZ / CELL), z1 = Math.floor(slab.maxZ / CELL)
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > MAX_CELLS) return
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const key = cellKey(cx, cz)
        const list = this.cells.get(key)
        if (list) list.push(entry)
        else this.cells.set(key, [entry])
      }
    }
  }

  remove(entry: BodyEntry): void {
    const slab = entry.slab
    if (!slab) return
    this.size--
    for (let cx = Math.floor(slab.minX / CELL); cx <= Math.floor(slab.maxX / CELL); cx++) {
      for (let cz = Math.floor(slab.minZ / CELL); cz <= Math.floor(slab.maxZ / CELL); cz++) {
        const key = cellKey(cx, cz)
        const list = this.cells.get(key)
        if (!list) continue
        const at = list.indexOf(entry)
        if (at >= 0) list.splice(at, 1)
        if (list.length === 0) this.cells.delete(key)
      }
    }
  }

  /** Whether another slab at the same height (to a millimetre) covers the point (x, z). */
  private covers(self: BodyEntry, x: number, z: number, top: number): boolean {
    const list = this.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)))
    if (!list) return false
    for (let i = 0; i < list.length; i++) {
      const other = list[i] as BodyEntry
      const s = other.slab as Slab
      if (other !== self && Math.abs(s.top - top) <= COPLANAR && x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) return true
    }
    return false
  }

  /** Whether (x, z) is within `LIP_BAND` of an edge of `self` that another coplanar slab continues past. */
  onSharedEdge(self: BodyEntry, x: number, z: number): boolean {
    const s = self.slab as Slab
    if (x - s.minX < LIP_BAND && this.covers(self, s.minX - PROBE, z, s.top)) return true
    if (s.maxX - x < LIP_BAND && this.covers(self, s.maxX + PROBE, z, s.top)) return true
    if (z - s.minZ < LIP_BAND && this.covers(self, x, s.minZ - PROBE, s.top)) return true
    return s.maxZ - z < LIP_BAND && this.covers(self, x, s.maxZ + PROBE, s.top)
  }
}

/**
 * A ghost contact: a contact on an inner edge of the ground, the edge two level tiles share, whose penetration axis leans away from the vertical because the engine reads it
 * from the body's core and the edge. A body rolling over the seam is pushed back as if it had hit a step. The real contact is the neighbour slab's, so this one is dropped;
 * the contact on a top face, on the outer edge of the ground, on a corner with no neighbour or against a slab at another height is never touched.
 */
export const isSeamContact = (J: typeof JoltNS, index: SlabIndex, slab: BodyEntry, slabIsFirst: boolean, baseOffset: number, collision: number): boolean => {
  const result = J.wrapPointer(collision, J.CollideShapeResult)
  const axis = result.mPenetrationAxis
  const length = Math.hypot(axis.GetX(), axis.GetY(), axis.GetZ())
  if (length < 1e-9 || Math.abs(axis.GetY()) / length >= TOP_AXIS) return false
  const point = slabIsFirst ? result.mContactPointOn1 : result.mContactPointOn2
  const heap = J.HEAPF32
  const base = baseOffset >> 2
  const top = (slab.slab as Slab).top
  if (point.GetY() + (heap[base + 1] as number) <= top - LIP_BAND) return false
  return index.onSharedEdge(slab, point.GetX() + (heap[base] as number), point.GetZ() + (heap[base + 2] as number))
}
