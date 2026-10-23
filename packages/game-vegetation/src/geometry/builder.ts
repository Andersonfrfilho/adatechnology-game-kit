import type { DamageMaterial, MeshData, PartKind, Vec3 } from '../types'
import { linearToSrgb, srgbToLinear } from '../color'

type ColorArg = Vec3

/** Accumulates triangles with per-vertex color / sway. Colors are given as sRGB and converted to linear in `build`. */
export class MeshBuilder {
  pos: number[] = []
  nor: number[] = []
  col: number[] = []
  sway: number[] = []
  idx: number[] = []

  get triangleCount(): number {
    return this.idx.length / 3
  }
  get vertexCount(): number {
    return this.pos.length / 3
  }

  vert(p: Vec3, n: Vec3, c: ColorArg, s: number): number {
    const i = this.pos.length / 3
    this.pos.push(p[0], p[1], p[2])
    this.nor.push(n[0], n[1], n[2])
    this.col.push(c[0], c[1], c[2])
    this.sway.push(s < 0 ? 0 : s > 1 ? 1 : s)
    return i
  }
  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c)
  }

  /**
   * Flat shaded triangle. If `hint` is given the face is wound so that its normal faces that direction.
   * Colors / sway are per vertex (gradients across the face are kept).
   */
  flatTri(p0: Vec3, p1: Vec3, p2: Vec3, c0: ColorArg, c1: ColorArg, c2: ColorArg, s0: number, s1: number, s2: number, hint?: Vec3): void {
    const ux = p1[0] - p0[0]
    const uy = p1[1] - p0[1]
    const uz = p1[2] - p0[2]
    const vx = p2[0] - p0[0]
    const vy = p2[1] - p0[1]
    const vz = p2[2] - p0[2]
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz)
    if (l < 1e-12) return
    nx /= l
    ny /= l
    nz /= l
    if (hint && nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) {
      // flip winding
      const n: Vec3 = [-nx, -ny, -nz]
      const a = this.vert(p0, n, c0, s0)
      const b = this.vert(p2, n, c2, s2)
      const c = this.vert(p1, n, c1, s1)
      this.tri(a, b, c)
      return
    }
    const n: Vec3 = [nx, ny, nz]
    const a = this.vert(p0, n, c0, s0)
    const b = this.vert(p1, n, c1, s1)
    const c = this.vert(p2, n, c2, s2)
    this.tri(a, b, c)
  }

  /** Flat triangle with a single color and sway. */
  flat(p0: Vec3, p1: Vec3, p2: Vec3, c: ColorArg, s: number, hint?: Vec3): void {
    this.flatTri(p0, p1, p2, c, c, c, s, s, s, hint)
  }

  /** Flat quad split along p0-p2. */
  flatQuad(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, c0: ColorArg, c1: ColorArg, c2: ColorArg, c3: ColorArg, s0: number, s1: number, s2: number, s3: number, hint?: Vec3): void {
    this.flatTri(p0, p1, p2, c0, c1, c2, s0, s1, s2, hint)
    this.flatTri(p0, p2, p3, c0, c2, c3, s0, s2, s3, hint)
  }

  /** Append already-built (linear) mesh data with a y-rotation, scale and translation. */
  appendMesh(m: MeshData, tx: number, ty: number, tz: number, ry = 0, scale = 1): void {
    const base = this.pos.length / 3
    const c = Math.cos(ry)
    const s = Math.sin(ry)
    const n = m.positions.length / 3
    for (let i = 0; i < n; i++) {
      const x = m.positions[i * 3] * scale
      const y = m.positions[i * 3 + 1] * scale
      const z = m.positions[i * 3 + 2] * scale
      this.pos.push(x * c + z * s + tx, y + ty, -x * s + z * c + tz)
      const nx = m.normals[i * 3]
      const nz = m.normals[i * 3 + 2]
      this.nor.push(nx * c + nz * s, m.normals[i * 3 + 1], -nx * s + nz * c)
      this.col.push(linearToSrgb(m.colors[i * 3]), linearToSrgb(m.colors[i * 3 + 1]), linearToSrgb(m.colors[i * 3 + 2]))
      this.sway.push(m.sway[i])
    }
    for (let i = 0; i < m.indices.length; i++) this.idx.push(m.indices[i] + base)
  }

  build(kind: PartKind, material: DamageMaterial): MeshData | undefined {
    if (this.idx.length === 0) return undefined
    const n = this.pos.length / 3
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n * 3; i++) colors[i] = srgbToLinear(this.col[i])
    return {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nor),
      colors,
      sway: new Float32Array(this.sway),
      indices: new Uint32Array(this.idx),
      triangleCount: this.idx.length / 3,
      kind,
      material,
    }
  }
}
