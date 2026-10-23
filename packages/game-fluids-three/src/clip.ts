/**
 * Convex solids (a cylinder or a box, in container space) clipped by the liquid surface plane `u · p <= d`.
 * This is robust for any tilt (upright, lying on its side, upside down): the result is exactly the part of the container the liquid fills,
 * with the surface cap lying on the plane. Written into preallocated buffers, no per-frame geometry is created.
 */
export type V3 = [number, number, number]

export interface SolidFace {
  p: V3[]
  n: V3[]
}

export interface Solid {
  faces: SolidFace[]
  /** Upper bound of the vertices a clip can write (non-indexed triangles). */
  maxVertices: number
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** Reverse the winding when the face does not look outward. */
const orient = (p: V3[], n: V3[], outward: V3): SolidFace => {
  if (dot(cross(sub(p[1], p[0]), sub(p[2], p[0])), outward) < 0) return { p: [...p].reverse(), n: [...n].reverse() }
  return { p, n }
}

const finish = (faces: SolidFace[]): Solid => {
  let maxVertices = 0
  for (const f of faces) maxVertices += (f.p.length * 2 + 2) * 3
  // The surface cap: at most one point per face edge cut.
  maxVertices += faces.length * 3 * 2 + 64
  return { faces, maxVertices }
}

export const cylinderSolid = (radius: number, height: number, segments: number): Solid => {
  const faces: SolidFace[] = []
  const ring = (y: number, i: number): V3 => {
    const a = (i / segments) * Math.PI * 2
    return [Math.cos(a) * radius, y, Math.sin(a) * radius]
  }
  const radial = (i: number): V3 => {
    const a = (i / segments) * Math.PI * 2
    return [Math.cos(a), 0, Math.sin(a)]
  }
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments
    const mid = norm([radial(i)[0] + radial(j)[0], 0, radial(i)[2] + radial(j)[2]])
    faces.push(orient([ring(0, i), ring(0, j), ring(height, j), ring(height, i)], [radial(i), radial(j), radial(j), radial(i)], mid))
  }
  const bottom: V3[] = []
  const top: V3[] = []
  for (let i = 0; i < segments; i++) {
    bottom.push(ring(0, i))
    top.push(ring(height, i))
  }
  faces.push(orient(bottom, bottom.map((): V3 => [0, -1, 0]), [0, -1, 0]))
  faces.push(orient(top, top.map((): V3 => [0, 1, 0]), [0, 1, 0]))
  return finish(faces)
}

export const boxSolid = (size: V3): Solid => {
  const hx = size[0] / 2
  const hz = size[2] / 2
  const hy = size[1]
  const c = (x: number, y: number, z: number): V3 => [x * hx, y * hy, z * hz]
  const quad = (a: V3, b: V3, cc: V3, d: V3, n: V3): SolidFace => orient([a, b, cc, d], [n, n, n, n], n)
  return finish([
    quad(c(1, 0, -1), c(1, 1, -1), c(1, 1, 1), c(1, 0, 1), [1, 0, 0]),
    quad(c(-1, 0, -1), c(-1, 1, -1), c(-1, 1, 1), c(-1, 0, 1), [-1, 0, 0]),
    quad(c(-1, 1, -1), c(1, 1, -1), c(1, 1, 1), c(-1, 1, 1), [0, 1, 0]),
    quad(c(-1, 0, -1), c(1, 0, -1), c(1, 0, 1), c(-1, 0, 1), [0, -1, 0]),
    quad(c(-1, 0, 1), c(1, 0, 1), c(1, 1, 1), c(-1, 1, 1), [0, 0, 1]),
    quad(c(-1, 0, -1), c(1, 0, -1), c(1, 1, -1), c(-1, 1, -1), [0, 0, -1]),
  ])
}

const polyP: number[] = []
const polyN: number[] = []
const cut: number[] = []

/**
 * Writes the triangles of `solid ∩ { u · p <= d }` into `pos` / `nor` (non-indexed, 3 floats per vertex) and returns the vertex count.
 * The cap on the plane has normal `u`.
 */
export const clipSolid = (solid: Solid, u: V3, d: number, pos: Float32Array, nor: Float32Array): number => {
  let count = 0
  const capacity = Math.floor(pos.length / 3)
  cut.length = 0
  const put = (px: number, py: number, pz: number, nx: number, ny: number, nz: number): void => {
    if (count >= capacity) return
    pos[count * 3] = px
    pos[count * 3 + 1] = py
    pos[count * 3 + 2] = pz
    nor[count * 3] = nx
    nor[count * 3 + 1] = ny
    nor[count * 3 + 2] = nz
    count++
  }

  for (const face of solid.faces) {
    const m = face.p.length
    polyP.length = 0
    polyN.length = 0
    for (let i = 0; i < m; i++) {
      const a = face.p[i]
      const b = face.p[(i + 1) % m]
      const na = face.n[i]
      const nb = face.n[(i + 1) % m]
      const da = u[0] * a[0] + u[1] * a[1] + u[2] * a[2] - d
      const db = u[0] * b[0] + u[1] * b[1] + u[2] * b[2] - d
      const ina = da <= 0
      const inb = db <= 0
      if (ina) {
        polyP.push(a[0], a[1], a[2])
        polyN.push(na[0], na[1], na[2])
        if (da > -1e-7) cut.push(a[0], a[1], a[2])
      }
      if (ina !== inb) {
        const t = da / (da - db)
        const x = a[0] + (b[0] - a[0]) * t
        const y = a[1] + (b[1] - a[1]) * t
        const z = a[2] + (b[2] - a[2]) * t
        polyP.push(x, y, z)
        polyN.push(na[0] + (nb[0] - na[0]) * t, na[1] + (nb[1] - na[1]) * t, na[2] + (nb[2] - na[2]) * t)
        cut.push(x, y, z)
      }
    }
    const n = polyP.length / 3
    for (let i = 1; i < n - 1; i++) {
      for (const k of [0, i, i + 1]) put(polyP[k * 3], polyP[k * 3 + 1], polyP[k * 3 + 2], polyN[k * 3], polyN[k * 3 + 1], polyN[k * 3 + 2])
    }
  }

  // Cap on the plane: unique cut points sorted around their centre.
  const pts: V3[] = []
  for (let i = 0; i < cut.length; i += 3) {
    let dup = false
    for (const q of pts) {
      if (Math.abs(q[0] - cut[i]) + Math.abs(q[1] - cut[i + 1]) + Math.abs(q[2] - cut[i + 2]) < 1e-6) {
        dup = true
        break
      }
    }
    if (!dup) pts.push([cut[i], cut[i + 1], cut[i + 2]])
  }
  if (pts.length >= 3) {
    const c: V3 = [0, 0, 0]
    for (const q of pts) {
      c[0] += q[0] / pts.length
      c[1] += q[1] / pts.length
      c[2] += q[2] / pts.length
    }
    const e1 = norm(cross(u, Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
    const e2 = cross(u, e1)
    const keyed = pts.map((q) => ({ q, a: Math.atan2(dot(sub(q, c), e2), dot(sub(q, c), e1)) })).sort((p, r) => p.a - r.a)
    for (let i = 0; i < keyed.length; i++) {
      for (const q of [c, keyed[i].q, keyed[(i + 1) % keyed.length].q]) put(q[0], q[1], q[2], u[0], u[1], u[2])
    }
  }
  return count
}
