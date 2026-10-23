import type { Vec3 } from '../types'
import { norm } from '../math'

export interface IcoTemplate {
  verts: Vec3[]
  faces: [number, number, number][]
}

const cache = new Map<number, IcoTemplate>()

/** Unit icosphere template: detail 0 = 20 faces, 1 = 80, 2 = 320. */
export function icoTemplate(detail: number): IcoTemplate {
  const hit = cache.get(detail)
  if (hit) return hit
  const t = (1 + Math.sqrt(5)) / 2
  const verts: Vec3[] = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => norm(v as Vec3))
  let faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ]
  for (let d = 0; d < detail; d++) {
    const mid = new Map<string, number>()
    const midpoint = (a: number, b: number): number => {
      const key = a < b ? a + '_' + b : b + '_' + a
      const h = mid.get(key)
      if (h !== undefined) return h
      const va = verts[a]
      const vb = verts[b]
      verts.push(norm([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]))
      mid.set(key, verts.length - 1)
      return verts.length - 1
    }
    const next: [number, number, number][] = []
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b)
      const bc = midpoint(b, c)
      const ca = midpoint(c, a)
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca])
    }
    faces = next
  }
  const res = { verts, faces }
  cache.set(detail, res)
  return res
}
