import type { HoleSpec, PrimitiveBuffers, Vec3 } from '../types'
import { indexArray } from './three-generators'

/**
 * A box (centred, `size = [w, h, d]`) minus rectangular prisms that go all the way through it along z: the cheap, exact boolean (walls with
 * windows and doors). The face is cut into a grid at every hole edge; each solid cell gets its front and back quads, and every cell edge between
 * solid and empty (a hole or the outside) gets a quad over the depth facing the empty side, so the outer sides and the reveals come out of the
 * same rule. Front uvs map the face to [0, 1]; side uvs run along the edge and the depth.
 */
export function difference(size: Vec3, subtract: readonly HoleSpec[]): PrimitiveBuffers {
  const [w, h, d] = size
  const hw = w / 2
  const hh = h / 2
  const hd = d / 2
  const holes = subtract
    .map((hole) => ({ x0: Math.max(-hw, Math.min(hole.min[0], hole.max[0])), x1: Math.min(hw, Math.max(hole.min[0], hole.max[0])), y0: Math.max(-hh, Math.min(hole.min[1], hole.max[1])), y1: Math.min(hh, Math.max(hole.min[1], hole.max[1])) }))
    .filter((hole) => hole.x1 > hole.x0 && hole.y1 > hole.y0)
  const cuts = (lo: number, hi: number, values: number[]): number[] => [...new Set([lo, hi, ...values.filter((v) => v > lo && v < hi)])].sort((a, b) => a - b)
  const xs = cuts(-hw, hw, holes.flatMap((hole) => [hole.x0, hole.x1]))
  const ys = cuts(-hh, hh, holes.flatMap((hole) => [hole.y0, hole.y1]))
  const nx = xs.length - 1
  const ny = ys.length - 1
  const solid = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= nx || j >= ny) return false
    const cx = ((xs[i] as number) + (xs[i + 1] as number)) / 2
    const cy = ((ys[j] as number) + (ys[j + 1] as number)) / 2
    return !holes.some((hole) => cx > hole.x0 && cx < hole.x1 && cy > hole.y0 && cy < hole.y1)
  }
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const quad = (corners: readonly (readonly [number, number, number])[], normal: readonly [number, number, number], uv: readonly (readonly [number, number])[]): void => {
    const base = positions.length / 3
    for (let k = 0; k < 4; k++) {
      positions.push(...(corners[k] as [number, number, number]))
      normals.push(...normal)
      uvs.push(...(uv[k] as [number, number]))
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const fu = (x: number): number => (x + hw) / w
  const fv = (y: number): number => (y + hh) / h
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!solid(i, j)) continue
      const x0 = xs[i] as number
      const x1 = xs[i + 1] as number
      const y0 = ys[j] as number
      const y1 = ys[j + 1] as number
      quad([[x0, y0, hd], [x1, y0, hd], [x1, y1, hd], [x0, y1, hd]], [0, 0, 1], [[fu(x0), fv(y0)], [fu(x1), fv(y0)], [fu(x1), fv(y1)], [fu(x0), fv(y1)]])
      quad([[x1, y0, -hd], [x0, y0, -hd], [x0, y1, -hd], [x1, y1, -hd]], [0, 0, -1], [[1 - fu(x1), fv(y0)], [1 - fu(x0), fv(y0)], [1 - fu(x0), fv(y1)], [1 - fu(x1), fv(y1)]])
      const zu = (z: number): number => (z + hd) / d
      if (!solid(i - 1, j)) quad([[x0, y0, -hd], [x0, y0, hd], [x0, y1, hd], [x0, y1, -hd]], [-1, 0, 0], [[zu(-hd), fv(y0)], [zu(hd), fv(y0)], [zu(hd), fv(y1)], [zu(-hd), fv(y1)]])
      if (!solid(i + 1, j)) quad([[x1, y0, hd], [x1, y0, -hd], [x1, y1, -hd], [x1, y1, hd]], [1, 0, 0], [[zu(hd), fv(y0)], [zu(-hd), fv(y0)], [zu(-hd), fv(y1)], [zu(hd), fv(y1)]])
      if (!solid(i, j - 1)) quad([[x0, y0, -hd], [x1, y0, -hd], [x1, y0, hd], [x0, y0, hd]], [0, -1, 0], [[fu(x0), zu(-hd)], [fu(x1), zu(-hd)], [fu(x1), zu(hd)], [fu(x0), zu(hd)]])
      if (!solid(i, j + 1)) quad([[x0, y1, hd], [x1, y1, hd], [x1, y1, -hd], [x0, y1, -hd]], [0, 1, 0], [[fu(x0), zu(hd)], [fu(x1), zu(hd)], [fu(x1), zu(-hd)], [fu(x0), zu(-hd)]])
    }
  }
  return {
    type: 'BufferGeometry',
    parameters: { size: [w, h, d], subtract: holes.map((hole) => ({ min: [hole.x0, hole.y0], max: [hole.x1, hole.y1] })) },
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: indexArray(indices),
    groups: [],
  }
}
