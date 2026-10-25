import { normalMatrix, transformPoint } from './math'
import type { InstancedBatch, PrimitiveBuffers, ShapeBatch, ShapeBuffers } from './types'

/** One piece for `mergeTransformed`: arrays (any may be missing) and the matrix that takes them into the merged space. */
export interface TransformedPiece {
  readonly positions: ArrayLike<number>
  readonly normals?: ArrayLike<number>
  readonly uvs?: ArrayLike<number>
  readonly indices?: ArrayLike<number> | null
  /** Column-major 4 x 4. */
  readonly matrix: readonly number[]
}

export interface MergedArrays {
  readonly positions: Float32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
}

/**
 * Joins pieces into one non-indexed set of arrays, each piece de-indexed, its missing normals and uvs zero-filled, its positions by
 * `Vector3.applyMatrix4` and its normals by the normal matrix and normalised: what three's `toNonIndexed` + `applyMatrix4` + a join do,
 * bit for bit (the port of `mergeByMaterial`).
 */
export function mergeTransformed(pieces: readonly TransformedPiece[]): MergedArrays {
  let total = 0
  for (const piece of pieces) total += piece.indices ? piece.indices.length : piece.positions.length / 3
  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  const uvs = new Float32Array(total * 2)
  let at = 0
  for (const piece of pieces) {
    const e = piece.matrix
    const nm = normalMatrix(e)
    const count = piece.indices ? piece.indices.length : piece.positions.length / 3
    // de-index into Float32 first, as toNonIndexed does, then transform the stored values
    const p = new Float32Array(count * 3)
    const n = new Float32Array(count * 3)
    for (let k = 0; k < count; k++) {
      const i = piece.indices ? (piece.indices[k] as number) : k
      for (let c = 0; c < 3; c++) {
        p[k * 3 + c] = piece.positions[i * 3 + c] as number
        if (piece.normals) n[k * 3 + c] = piece.normals[i * 3 + c] as number
      }
      if (piece.uvs) {
        uvs[(at + k) * 2] = piece.uvs[i * 2] as number
        uvs[(at + k) * 2 + 1] = piece.uvs[i * 2 + 1] as number
      }
    }
    for (let k = 0; k < count; k++) {
      const q = transformPoint(e, p[k * 3] as number, p[k * 3 + 1] as number, p[k * 3 + 2] as number)
      positions[(at + k) * 3] = q[0]
      positions[(at + k) * 3 + 1] = q[1]
      positions[(at + k) * 3 + 2] = q[2]
      const x = n[k * 3] as number
      const y = n[k * 3 + 1] as number
      const z = n[k * 3 + 2] as number
      const vx = nm[0]! * x + nm[3]! * y + nm[6]! * z
      const vy = nm[1]! * x + nm[4]! * y + nm[7]! * z
      const vz = nm[2]! * x + nm[5]! * y + nm[8]! * z
      const s = 1 / (Math.sqrt(vx * vx + vy * vy + vz * vz) || 1)
      normals[(at + k) * 3] = vx * s
      normals[(at + k) * 3 + 1] = vy * s
      normals[(at + k) * 3 + 2] = vz * s
    }
    at += count
  }
  return { positions, normals, uvs }
}

const primitiveArrays = (p: PrimitiveBuffers): ArrayBuffer[] => [p.positions, p.normals, p.uvs, ...(p.indices ? [p.indices] : [])].map((a) => a.buffer as ArrayBuffer)
const batchArrays = (b: ShapeBatch): ArrayBuffer[] => [b.positions, b.normals, b.uvs, ...(b.colors ? [b.colors] : []), ...(b.indices ? [b.indices] : [])].map((a) => a.buffer as ArrayBuffer)
const instancedArrays = (b: InstancedBatch): ArrayBuffer[] => [...primitiveArrays(b.geometry), b.matrices.buffer as ArrayBuffer, ...(b.colors ? [b.colors.buffer as ArrayBuffer] : [])]

/** Every `ArrayBuffer` of a result, for `postMessage(buffers, transferablesOf(buffers))`. */
export function transferablesOf(buffers: ShapeBuffers): ArrayBuffer[] {
  const out = new Set<ArrayBuffer>()
  for (const level of buffers.levels) {
    for (const batch of level.batches) for (const a of batchArrays(batch)) out.add(a)
    for (const batch of level.instanced) for (const a of instancedArrays(batch)) out.add(a)
  }
  return [...out]
}

const copyPrimitive = (p: PrimitiveBuffers): PrimitiveBuffers => ({
  ...p,
  positions: p.positions.slice(),
  normals: p.normals.slice(),
  uvs: p.uvs.slice(),
  ...(p.indices ? { indices: p.indices.slice() } : {}),
  groups: p.groups.map((g) => ({ ...g })),
})

/** A deep copy whose arrays are its own (cached results are shared and read-only; copy before deforming). */
export function cloneBuffers(buffers: ShapeBuffers): ShapeBuffers {
  return {
    ...buffers,
    levels: buffers.levels.map((level) => ({
      ...level,
      batches: level.batches.map((b) => ({
        ...b,
        positions: b.positions.slice(),
        normals: b.normals.slice(),
        uvs: b.uvs.slice(),
        ...(b.colors ? { colors: b.colors.slice() } : {}),
        ...(b.indices ? { indices: b.indices.slice() } : {}),
        ranges: b.ranges.map((r) => ({ ...r })),
        bounds: { min: [...b.bounds.min], max: [...b.bounds.max] },
      })),
      instanced: level.instanced.map((b) => ({ ...b, geometry: copyPrimitive(b.geometry), matrices: b.matrices.slice(), ...(b.colors ? { colors: b.colors.slice() } : {}) })),
    })),
  }
}

/** Bytes held by the arrays of a result (what the cache counts). */
export function byteSizeOf(buffers: ShapeBuffers): number {
  return transferablesOf(buffers).reduce((sum, buffer) => sum + buffer.byteLength, 0)
}
