import type { PartShape, Quat, Vec3 } from './types'

const EPS = 1e-9

/** Small vector helpers (arrays of three numbers). Pure functions; they allocate a new array. */
export const vec = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  length: (a: Vec3): number => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]),
  distance: (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  normalize: (a: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 => {
    const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
    return l < EPS ? [fallback[0], fallback[1], fallback[2]] : [a[0] / l, a[1] / l, a[2] / l]
  },
  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  /** `a + b * s` */
  madd: (a: Vec3, b: Vec3, s: number): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s],
}

const IDENTITY: Quat = [0, 0, 0, 1]

/** Quaternion helpers (`[x, y, z, w]`). */
export const quat = {
  identity: (): Quat => [IDENTITY[0], IDENTITY[1], IDENTITY[2], IDENTITY[3]],
  /** Hamilton product `a * b` (apply `b` first, then `a`). */
  mul: (a: Quat, b: Quat): Quat => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ],
  conjugate: (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]],
  normalize: (q: Quat): Quat => {
    const l = Math.hypot(q[0], q[1], q[2], q[3])
    return l < EPS ? [0, 0, 0, 1] : [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
  },
  /** Rotation of `angle` radians around a unit `axis`. */
  fromAxisAngle: (axis: Vec3, angle: number): Quat => {
    const s = Math.sin(angle / 2)
    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]
  },
  /** Rotation matrix, row-major 3x3. */
  toMatrix: (q: Quat): number[] => {
    const [x, y, z, w] = q
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z
    return [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy), 2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx), 2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)]
  },
  /** Quaternion from three orthonormal columns (the images of the x, y and z axes). */
  fromColumns: (cx: Vec3, cy: Vec3, cz: Vec3): Quat => {
    const m00 = cx[0], m10 = cx[1], m20 = cx[2]
    const m01 = cy[0], m11 = cy[1], m21 = cy[2]
    const m02 = cz[0], m12 = cz[1], m22 = cz[2]
    const tr = m00 + m11 + m22
    let q: Quat
    if (tr > 0) {
      const s = Math.sqrt(tr + 1) * 2
      q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]
    } else if (m00 > m11 && m00 > m22) {
      const s = Math.sqrt(1 + m00 - m11 - m22) * 2
      q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
    } else if (m11 > m22) {
      const s = Math.sqrt(1 + m11 - m00 - m22) * 2
      q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]
    } else {
      const s = Math.sqrt(1 + m22 - m00 - m11) * 2
      q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]
    }
    return quat.normalize(q)
  },
}

/** Quaternion from Euler angles in radians, order XYZ (the three.js default). */
export const quatFromEuler = (x: number, y: number, z: number): Quat => {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2)
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3]
}

/** Rotate a vector by a quaternion. */
export const rotateVec = (q: Quat, v: Vec3): Vec3 => {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3]
  const tx = 2 * (qy * v[2] - qz * v[1])
  const ty = 2 * (qz * v[0] - qx * v[2])
  const tz = 2 * (qx * v[1] - qy * v[0])
  return [v[0] + qw * tx + (qy * tz - qz * ty), v[1] + qw * ty + (qz * tx - qx * tz), v[2] + qw * tz + (qx * ty - qy * tx)]
}

/** World point to the local space of a transform (`position`, `rotation`). */
export const toLocal = (position: Vec3, rotation: Quat, p: Vec3): Vec3 =>
  rotateVec([-rotation[0], -rotation[1], -rotation[2], rotation[3]], [p[0] - position[0], p[1] - position[1], p[2] - position[2]])

/** Local point of a transform (`position`, `rotation`) to world space. */
export const toWorld = (position: Vec3, rotation: Quat, p: Vec3): Vec3 => {
  const r = rotateVec(rotation, p)
  return [r[0] + position[0], r[1] + position[1], r[2] + position[2]]
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Shapes (part space: centred on the origin, cylinders along +Y)
// ---------------------------------------------------------------------------------------------------------------------------------------------

/** Dimensions of the bounding box of a shape, in the shape's own axes. */
export const shapeDims = (s: PartShape): Vec3 => {
  if (s.kind === 'box') return [s.size[0], s.size[1], s.size[2]]
  if (s.kind === 'cylinder') return [s.radius * 2, s.height, s.radius * 2]
  return [s.radius * 2, s.radius * 2, s.radius * 2]
}

/** Radius of the sphere that encloses the shape. */
export const shapeBound = (s: PartShape): number => {
  if (s.kind === 'box') return 0.5 * Math.hypot(s.size[0], s.size[1], s.size[2])
  if (s.kind === 'cylinder') return Math.hypot(s.radius, s.height / 2)
  return s.radius
}

export const shapeArea = (s: PartShape): number => {
  if (s.kind === 'box') return 2 * (s.size[0] * s.size[1] + s.size[1] * s.size[2] + s.size[0] * s.size[2])
  if (s.kind === 'cylinder') return 2 * Math.PI * s.radius * s.height + 2 * Math.PI * s.radius * s.radius
  return 4 * Math.PI * s.radius * s.radius
}

export interface ShapeRay {
  /** Entry distance along the ray (negative when the origin is inside). */
  t0: number
  /** Normal at the entry, outward. */
  n0: Vec3
  /** Exit distance. */
  t1: number
  /** Normal at the exit, outward. */
  n1: Vec3
}

/** Exact ray intersection with a shape in part space. `d` need not be normalised but must be non-zero. */
export const rayShape = (s: PartShape, o: Vec3, d: Vec3): ShapeRay | null => {
  if (s.kind === 'box') {
    let tmin = -Infinity, tmax = Infinity
    let a0 = 0, a1 = 0, s0 = 1, s1 = 1
    for (let i = 0; i < 3; i++) {
      const h = s.size[i] / 2
      if (Math.abs(d[i]) < EPS) {
        if (Math.abs(o[i]) > h) return null
        continue
      }
      let ta = (-h - o[i]) / d[i]
      let tb = (h - o[i]) / d[i]
      let sa = -1, sb = 1
      if (ta > tb) {
        const t = ta
        ta = tb
        tb = t
        sa = 1
        sb = -1
      }
      if (ta > tmin) {
        tmin = ta
        a0 = i
        s0 = sa
      }
      if (tb < tmax) {
        tmax = tb
        a1 = i
        s1 = sb
      }
      if (tmin > tmax) return null
    }
    if (tmax < 0 || !Number.isFinite(tmin) || !Number.isFinite(tmax)) return null
    const n0: Vec3 = [0, 0, 0]
    const n1: Vec3 = [0, 0, 0]
    n0[a0] = s0
    n1[a1] = s1
    return { t0: tmin, n0, t1: tmax, n1 }
  }
  if (s.kind === 'sphere') {
    const b = vec.dot(o, d)
    const a = vec.dot(d, d)
    const c = vec.dot(o, o) - s.radius * s.radius
    const disc = b * b - a * c
    if (disc < 0) return null
    const sq = Math.sqrt(disc)
    const t0 = (-b - sq) / a
    const t1 = (-b + sq) / a
    if (t1 < 0) return null
    const p0 = vec.madd(o, d, t0)
    const p1 = vec.madd(o, d, t1)
    return { t0, n0: vec.normalize(p0), t1, n1: vec.normalize(p1) }
  }
  // cylinder along Y: intersection of the infinite cylinder interval and the y slab
  const r = s.radius
  const hh = s.height / 2
  const a = d[0] * d[0] + d[2] * d[2]
  const c = o[0] * o[0] + o[2] * o[2] - r * r
  let tA = -Infinity, tB = Infinity
  if (a > EPS) {
    const b = o[0] * d[0] + o[2] * d[2]
    const disc = b * b - a * c
    if (disc < 0) return null
    const sq = Math.sqrt(disc)
    tA = (-b - sq) / a
    tB = (-b + sq) / a
  } else if (c > 0) return null
  let yA = -Infinity, yB = Infinity
  if (Math.abs(d[1]) > EPS) {
    yA = (-hh - o[1]) / d[1]
    yB = (hh - o[1]) / d[1]
    if (yA > yB) {
      const t = yA
      yA = yB
      yB = t
    }
  } else if (Math.abs(o[1]) > hh) return null
  const t0 = Math.max(tA, yA)
  const t1 = Math.min(tB, yB)
  if (t0 > t1 || t1 < 0 || !Number.isFinite(t0) || !Number.isFinite(t1)) return null
  const normalAt = (t: number, fromSide: boolean, sign: number): Vec3 => {
    if (fromSide) {
      const p = vec.madd(o, d, t)
      return vec.normalize([p[0], 0, p[2]], [1, 0, 0])
    }
    return [0, sign, 0]
  }
  const n0 = normalAt(t0, tA >= yA, d[1] > 0 ? -1 : 1)
  const n1 = normalAt(t1, tB <= yB, d[1] > 0 ? 1 : -1)
  return { t0, n0, t1, n1 }
}

/** Distance from a part-space point to the shape (0 inside). */
export const distanceToShape = (s: PartShape, p: Vec3): number => {
  if (s.kind === 'box') {
    const dx = Math.max(Math.abs(p[0]) - s.size[0] / 2, 0)
    const dy = Math.max(Math.abs(p[1]) - s.size[1] / 2, 0)
    const dz = Math.max(Math.abs(p[2]) - s.size[2] / 2, 0)
    return Math.hypot(dx, dy, dz)
  }
  if (s.kind === 'sphere') return Math.max(0, vec.length(p) - s.radius)
  const dr = Math.max(0, Math.hypot(p[0], p[2]) - s.radius)
  const dy = Math.max(0, Math.abs(p[1]) - s.height / 2)
  return Math.hypot(dr, dy)
}

/** Nearest point on the surface of a shape to a part-space point, with the outward normal. */
export const surfacePoint = (s: PartShape, p: Vec3): { point: Vec3; normal: Vec3 } => {
  if (s.kind === 'box') {
    const h: Vec3 = [s.size[0] / 2, s.size[1] / 2, s.size[2] / 2]
    const inside = Math.abs(p[0]) <= h[0] && Math.abs(p[1]) <= h[1] && Math.abs(p[2]) <= h[2]
    if (!inside) {
      const c: Vec3 = [Math.max(-h[0], Math.min(h[0], p[0])), Math.max(-h[1], Math.min(h[1], p[1])), Math.max(-h[2], Math.min(h[2], p[2]))]
      return { point: c, normal: vec.normalize(vec.sub(p, c)) }
    }
    let axis = 0
    let best = Infinity
    for (let i = 0; i < 3; i++) {
      const g = h[i] - Math.abs(p[i])
      if (g < best) {
        best = g
        axis = i
      }
    }
    const sign = p[axis] >= 0 ? 1 : -1
    const point: Vec3 = [p[0], p[1], p[2]]
    point[axis] = sign * h[axis]
    const normal: Vec3 = [0, 0, 0]
    normal[axis] = sign
    return { point, normal }
  }
  if (s.kind === 'sphere') {
    const n = vec.normalize(p)
    return { point: vec.scale(n, s.radius), normal: n }
  }
  const rho = Math.hypot(p[0], p[2])
  const hh = s.height / 2
  const inside = rho <= s.radius && Math.abs(p[1]) <= hh
  if (!inside) {
    const k = rho > s.radius ? s.radius / rho : 1
    const c: Vec3 = [p[0] * k, Math.max(-hh, Math.min(hh, p[1])), p[2] * k]
    return { point: c, normal: vec.normalize(vec.sub(p, c)) }
  }
  if (s.radius - rho < hh - Math.abs(p[1])) {
    const k = rho < EPS ? 0 : s.radius / rho
    const point: Vec3 = rho < EPS ? [s.radius, p[1], 0] : [p[0] * k, p[1], p[2] * k]
    return { point, normal: vec.normalize([point[0], 0, point[2]], [1, 0, 0]) }
  }
  const sign = p[1] >= 0 ? 1 : -1
  return { point: [p[0], sign * hh, p[2]], normal: [0, sign, 0] }
}

/** Axis-aligned bounds of a shape with a given centre and orientation. */
export const aabbOf = (s: PartShape, center: Vec3, q: Quat): { min: Vec3; max: Vec3 } => {
  let hx: number, hy: number, hz: number
  if (s.kind === 'sphere') {
    hx = hy = hz = s.radius
  } else {
    const m = quat.toMatrix(q)
    if (s.kind === 'box') {
      const a = s.size[0] / 2, b = s.size[1] / 2, c = s.size[2] / 2
      hx = Math.abs(m[0]) * a + Math.abs(m[1]) * b + Math.abs(m[2]) * c
      hy = Math.abs(m[3]) * a + Math.abs(m[4]) * b + Math.abs(m[5]) * c
      hz = Math.abs(m[6]) * a + Math.abs(m[7]) * b + Math.abs(m[8]) * c
    } else {
      const ax = [m[1], m[4], m[7]]
      const hh = s.height / 2
      const e = (i: number) => s.radius * Math.sqrt(Math.max(0, 1 - ax[i] * ax[i])) + hh * Math.abs(ax[i])
      hx = e(0)
      hy = e(1)
      hz = e(2)
    }
  }
  return { min: [center[0] - hx, center[1] - hy, center[2] - hz], max: [center[0] + hx, center[1] + hy, center[2] + hz] }
}

/** Seeded generator (mulberry32). The state is a single int32, so it round-trips through JSON. */
export interface Rng {
  next(): number
  state(): number
  set(state: number): void
}

export const createRng = (seed: number): Rng => {
  let s = seed | 0
  return {
    next() {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    state: () => s,
    set(v) {
      s = v | 0
    },
  }
}
