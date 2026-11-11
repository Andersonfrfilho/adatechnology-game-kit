import type * as THREE_NS from 'three'

import type { Three } from '../kernel-types.js'

/** An axis-aligned box: [x0, y0, z0, x1, y1, z1]. */
export type StageBox = readonly [number, number, number, number, number, number]

// the six faces of a box: normal, then the four corners (0 = min, 1 = max per axis) wound counter-clockwise seen from outside
const FACES: readonly (readonly [readonly [number, number, number], readonly (readonly [number, number, number])[]])[] = [
  [[1, 0, 0], [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]]],
  [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
  [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]],
  [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
  [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]],
  [[0, 0, -1], [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]],
]

// the faces of a hexahedron given as four corners at its start (0-3) and the same four at its end (4-7)
const HEXAHEDRON_FACES: readonly (readonly [number, number, number, number])[] = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]

/**
 * Boxes of one material gathered into a single mesh: a wall of bricks is one draw, not one per brick (a single-storey house laid brick by brick was
 * almost six thousand meshes).
 */
export class BoxBatch {
  private readonly positions: number[] = []
  private readonly normals: number[] = []
  private readonly indices: number[] = []

  get count(): number {
    return this.indices.length / 36
  }

  add(box: StageBox): void {
    const [x0, y0, z0, x1, y1, z1] = box
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return
    for (const [normal, corners] of FACES) {
      const base = this.positions.length / 3
      for (const [cx, cy, cz] of corners) {
        this.positions.push(cx ? x1 : x0, cy ? y1 : y0, cz ? z1 : z0)
        this.normals.push(normal[0], normal[1], normal[2])
      }
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  /**
   * A six-faced solid from its eight corners: four at the start (in turn around the section) and the same four at the end, for a timber laid on a slope. Each
   * face is wound to look out of the solid.
   */
  addHexahedron(corners: readonly (readonly [number, number, number])[]): void {
    if (corners.length !== 8) return
    const centre = [0, 1, 2].map((k) => corners.reduce((sum, c) => sum + c[k]!, 0) / 8)
    for (const quad of HEXAHEDRON_FACES) {
      const a = corners[quad[0]]!, b = corners[quad[1]]!, c = corners[quad[2]]!, d = corners[quad[3]]!
      const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], e2 = [d[0]! - a[0]!, d[1]! - a[1]!, d[2]! - a[2]!]
      let n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!]
      const len = Math.hypot(n[0]!, n[1]!, n[2]!)
      if (len < 1e-10) continue
      n = n.map((x) => x / len)
      const out = [0, 1, 2].reduce((sum, k) => sum + n[k]! * ((a[k]! + b[k]! + c[k]! + d[k]!) / 4 - centre[k]!), 0)
      const ring = out >= 0 ? [a, b, c, d] : [a, d, c, b]
      if (out < 0) n = n.map((x) => -x)
      const base = this.positions.length / 3
      for (const p of ring) {
        this.positions.push(p[0]!, p[1]!, p[2]!)
        this.normals.push(n[0]!, n[1]!, n[2]!)
      }
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  /** A flat four-cornered face that looks along `normal` (it is wound so). */
  addQuad(corners: readonly (readonly [number, number, number])[], normal: readonly [number, number, number]): void {
    if (corners.length !== 4) return
    const a = corners[0]!, b = corners[1]!, d = corners[3]!
    const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], e2 = [d[0]! - a[0]!, d[1]! - a[1]!, d[2]! - a[2]!]
    const facing = (e1[1]! * e2[2]! - e1[2]! * e2[1]!) * normal[0] + (e1[2]! * e2[0]! - e1[0]! * e2[2]!) * normal[1] + (e1[0]! * e2[1]! - e1[1]! * e2[0]!) * normal[2]
    const ring = facing >= 0 ? corners : [corners[0]!, corners[3]!, corners[2]!, corners[1]!]
    const base = this.positions.length / 3
    for (const p of ring) {
      this.positions.push(p[0], p[1], p[2])
      this.normals.push(normal[0], normal[1], normal[2])
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  /** The mesh of everything added, or null when nothing was. */
  mesh(THREE: Three, material: THREE_NS.Material, name: string): THREE_NS.Mesh | null {
    if (!this.indices.length) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    geometry.setIndex(this.indices)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
}
