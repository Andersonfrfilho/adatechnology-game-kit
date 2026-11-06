import type { Mesh, Vector3 } from '../three-types'

import type { Three } from '../types'

/** How many times a face is halved at most. */
const SUBDIVIDE_DEPTH = 12

export type SubdivideNearParams = {
  readonly mesh: Mesh
  /** No edge of a picked face stays longer than this, in the mesh's units. */
  readonly maxLen: number
  /** Picks the faces to split, given their corners in world space. */
  readonly near: (corners: Vector3[]) => boolean
}

/** Splits the faces of a mesh that `near` picks until no edge is longer than `maxLen`; the others stay as they are. Drops colour and uv, as a full subdivision does. */
export function subdivideNear(THREE: Three, params: SubdivideNearParams): void {
  const { mesh, maxLen, near } = params
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
  const a = src.attributes.position.array as ArrayLike<number>
  const toWorld = mesh.matrixWorld
  const out: number[] = []
  const mid = (p: number[], q: number[]): number[] => [(p[0]! + q[0]!) / 2, (p[1]! + q[1]!) / 2, (p[2]! + q[2]!) / 2]
  const split = (A: number[], B: number[], C: number[], depth: number): void => {
    const ab = Math.hypot(A[0]! - B[0]!, A[1]! - B[1]!, A[2]! - B[2]!)
    const bc = Math.hypot(B[0]! - C[0]!, B[1]! - C[1]!, B[2]! - C[2]!)
    const ca = Math.hypot(C[0]! - A[0]!, C[1]! - A[1]!, C[2]! - A[2]!)
    const longest = Math.max(ab, bc, ca)
    if (longest <= maxLen || depth > SUBDIVIDE_DEPTH) {
      out.push(...A, ...B, ...C)
      return
    }
    if (longest === ab) {
      const D = mid(A, B)
      split(A, D, C, depth + 1)
      split(D, B, C, depth + 1)
    } else if (longest === bc) {
      const E = mid(B, C)
      split(A, B, E, depth + 1)
      split(A, E, C, depth + 1)
    } else {
      const F = mid(C, A)
      split(A, B, F, depth + 1)
      split(F, B, C, depth + 1)
    }
  }
  for (let i = 0; i < a.length; i += 9) {
    const A = [a[i]!, a[i + 1]!, a[i + 2]!]
    const B = [a[i + 3]!, a[i + 4]!, a[i + 5]!]
    const C = [a[i + 6]!, a[i + 7]!, a[i + 8]!]
    const corners = [A, B, C].map((p) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(toWorld))
    if (near(corners)) split(A, B, C, 0)
    else out.push(...A, ...B, ...C)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  mesh.geometry.dispose()
  mesh.geometry = g
}
