import type { Jolt } from './constants'

/** Jolt hands a Vec3 back as an address in the wasm heap, and its x, y, z are the three floats there: one call across the boundary reads what GetX, GetY and GetZ read in three. */
export const vec3At = (J: Jolt, v: unknown): number => J.getPointer(v) >> 2

/** The layout `vec3At` relies on, checked for the Jolt build in use: another build fails here, loudly, not as a wrong contact later. */
export const checkVec3Layout = (J: Jolt): void => {
  const single = new J.Vec3(1.5, -2.5, 3.5)
  const position = new J.RVec3(4.5, -5.5, 6.5)
  const rotation = new J.Quat(7.5, 8.5, 9.5, 10.5)
  const s = vec3At(J, single)
  const p = vec3At(J, position)
  const heap = J.HEAPF32
  const matches = heap[s] === 1.5 && heap[s + 1] === -2.5 && heap[s + 2] === 3.5 && heap[p] === 4.5 && heap[p + 1] === -5.5 && heap[p + 2] === 6.5
  const r = vec3At(J, rotation)
  const isQuatLaidOut = heap[r] === 7.5 && heap[r + 1] === 8.5 && heap[r + 2] === 9.5 && heap[r + 3] === 10.5
  J.destroy(rotation)
  J.destroy(single)
  J.destroy(position)
  if (!matches || !isQuatLaidOut) throw new Error('game-physics-jolt: this Jolt build does not lay a Vec3 out as consecutive floats (Vec3 x, y, z; Quat x, y, z, w)')
}
