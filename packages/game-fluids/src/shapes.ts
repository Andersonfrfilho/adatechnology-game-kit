import type { ContainerSpec, Vec3 } from './types'
import { clamp, normalize } from './math'

export type Shape = ContainerSpec['shape']

/** Sample columns of a container's inner volume: equal-weight (x, z) positions with the full height `h`. */
export interface Columns {
  x: Float64Array
  z: Float64Array
  h: number
  /** Radius (cylinder) or half extents (box) used for the extent of a plane. */
  kind: 'cylinder' | 'box'
  r: number
  hx: number
  hz: number
}

const RINGS = 8
const SEGMENTS = 16
const GRID = 12

export const makeColumns = (shape: Shape): Columns => {
  if (shape.kind === 'cylinder') {
    const x = new Float64Array(RINGS * SEGMENTS)
    const z = new Float64Array(RINGS * SEGMENTS)
    let n = 0
    for (let k = 0; k < RINGS; k++) {
      const rr = shape.radius * Math.sqrt((k + 0.5) / RINGS)
      for (let m = 0; m < SEGMENTS; m++) {
        // Offset every other ring so the samples do not line up radially.
        const a = ((m + (k % 2) * 0.5) / SEGMENTS) * Math.PI * 2
        x[n] = Math.cos(a) * rr
        z[n] = Math.sin(a) * rr
        n++
      }
    }
    return { x, z, h: shape.height, kind: 'cylinder', r: shape.radius, hx: shape.radius, hz: shape.radius }
  }
  const [sx, sy, sz] = shape.size
  const x = new Float64Array(GRID * GRID)
  const z = new Float64Array(GRID * GRID)
  let n = 0
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      x[n] = ((i + 0.5) / GRID - 0.5) * sx
      z[n] = ((j + 0.5) / GRID - 0.5) * sz
      n++
    }
  }
  return { x, z, h: sy, kind: 'box', r: Math.hypot(sx, sz) / 2, hx: sx / 2, hz: sz / 2 }
}

/** Range of `u · p` over the container: below `lo` it is empty, above `hi` it is full. */
export const planeRange = (c: Columns, u: Vec3): [number, number] => {
  const horizontal = c.kind === 'cylinder' ? c.r * Math.hypot(u[0], u[2]) : Math.abs(u[0]) * c.hx + Math.abs(u[2]) * c.hz
  const top = u[1] * c.h
  return [-horizontal + Math.min(0, top), horizontal + Math.max(0, top)]
}

/** Fraction (0..1) of the inner volume with `u · p <= d` (the liquid for a surface plane with normal `u` at offset `d`). */
export const planeFraction = (c: Columns, u: Vec3, d: number): number => {
  const uy = u[1]
  let total = 0
  const n = c.x.length
  for (let i = 0; i < n; i++) {
    const s0 = u[0] * c.x[i] + u[2] * c.z[i]
    let len: number
    if (uy > 1e-6) len = clamp((d - s0) / uy, 0, c.h)
    else if (uy < -1e-6) len = c.h - clamp((d - s0) / uy, 0, c.h)
    else len = s0 <= d ? c.h : 0
    total += len
  }
  return total / (n * c.h)
}

/** Plane offset `d` along unit normal `u` for which the liquid takes the volume fraction `f`. */
export const levelFor = (c: Columns, u: Vec3, f: number): number => {
  const [lo0, hi0] = planeRange(c, u)
  if (f <= 0) return lo0
  if (f >= 1) return hi0
  if (Math.abs(u[0]) + Math.abs(u[2]) < 1e-9) {
    return u[1] > 0 ? f * c.h * u[1] : u[1] * c.h - f * c.h * u[1]
  }
  let lo = lo0
  let hi = hi0
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    if (planeFraction(c, u, mid) < f) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Radius of the lip circle (the opening); a closed spec (`opening` 0) uses half the container width once opened. */
export const lipRadius = (shape: Shape, opening: number): number => {
  const limit = shape.kind === 'cylinder' ? shape.radius : Math.min(shape.size[0], shape.size[2]) / 2
  return opening > 0 ? Math.min(opening, limit) : limit * 0.5
}

export const shapeHeight = (shape: Shape): number => (shape.kind === 'cylinder' ? shape.height : shape.size[1])

export interface Lip {
  /** Lowest lip point along the surface normal, container space. */
  point: Vec3
  /** Centre of the lip circle, container space. */
  center: Vec3
  /** Outward direction (container space, horizontal in the container frame) the liquid leaves along, or null when upright. */
  outward: Vec3 | null
  /** `u · point`: the surface offset above which the liquid spills. */
  level: number
}

export const lipOf = (shape: Shape, opening: number, u: Vec3): Lip => {
  const h = shapeHeight(shape)
  const ro = lipRadius(shape, opening)
  const center: Vec3 = [0, h, 0]
  const uh = Math.hypot(u[0], u[2])
  if (uh < 1e-6) return { point: center, center, outward: null, level: u[1] * h }
  const out: Vec3 = normalize([-u[0], 0, -u[2]])
  const point: Vec3 = [out[0] * ro, h, out[2] * ro]
  return { point, center, outward: out, level: u[0] * point[0] + u[1] * point[1] + u[2] * point[2] }
}
