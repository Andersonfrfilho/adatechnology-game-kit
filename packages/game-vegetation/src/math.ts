import type { Vec3 } from './types'

export const TAU = Math.PI * 2
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
export const norm = (a: Vec3): Vec3 => {
  const l = len(a)
  return l < 1e-9 ? [0, 1, 0] : [a[0] / l, a[1] / l, a[2] / l]
}
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v)
export const smooth = (t: number): number => t * t * (3 - 2 * t)

/** Rotate v around a unit axis by angle (Rodrigues). */
export function rotAxis(v: Vec3, axis: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const k = cross(axis, v)
  const d = dot(axis, v) * (1 - c)
  return [v[0] * c + k[0] * s + axis[0] * d, v[1] * c + k[1] * s + axis[1] * d, v[2] * c + k[2] * s + axis[2] * d]
}
export const rotY = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}

/** Any unit vector perpendicular to n. */
export function perp(n: Vec3): Vec3 {
  const a: Vec3 = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]
  return norm(cross(a, n))
}

/** Direction from azimuth (around +y, 0 = +x) and elevation (0 = horizontal, pi/2 = up). */
export function dirFromAngles(az: number, el: number): Vec3 {
  const c = Math.cos(el)
  return [Math.cos(az) * c, Math.sin(el), Math.sin(az) * c]
}

/** Local frame: world = o + x*lx + y*ly + z*lz. y is the "axis" direction. */
export interface Frame {
  o: Vec3
  x: Vec3
  y: Vec3
  z: Vec3
}
export function frameFromAxis(o: Vec3, axis: Vec3, twist = 0): Frame {
  const y = norm(axis)
  let x = perp(y)
  if (twist) x = rotAxis(x, y, twist)
  const z = norm(cross(x, y))
  return { o, x, y, z }
}
export function toWorld(f: Frame, l: Vec3): Vec3 {
  return [
    f.o[0] + f.x[0] * l[0] + f.y[0] * l[1] + f.z[0] * l[2],
    f.o[1] + f.x[1] * l[0] + f.y[1] * l[1] + f.z[1] * l[2],
    f.o[2] + f.x[2] * l[0] + f.y[2] * l[1] + f.z[2] * l[2],
  ]
}
export function dirToWorld(f: Frame, l: Vec3): Vec3 {
  return [
    f.x[0] * l[0] + f.y[0] * l[1] + f.z[0] * l[2],
    f.x[1] * l[0] + f.y[1] * l[1] + f.z[1] * l[2],
    f.x[2] * l[0] + f.y[2] * l[1] + f.z[2] * l[2],
  ]
}

/** Catmull-Rom through points, `n` samples per span (including end points). */
export function catmull(pts: Vec3[], perSpan: number): Vec3[] {
  if (pts.length < 3 || perSpan <= 1) return pts.slice()
  const out: Vec3[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < perSpan; k++) {
      const t = k / perSpan
      const t2 = t * t
      const t3 = t2 * t
      const p: Vec3 = [0, 0, 0]
      for (let c = 0; c < 3; c++) {
        p[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)
      }
      out.push(p)
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

/** Point and tangent on a polyline at t in 0..1 (by index fraction). */
export function sampleLine(pts: Vec3[], t: number): { p: Vec3; d: Vec3 } {
  const f = clamp(t, 0, 1) * (pts.length - 1)
  const i = Math.min(pts.length - 2, Math.floor(f))
  const u = f - i
  return { p: lerp3(pts[i], pts[i + 1], u), d: norm(sub(pts[i + 1], pts[i])) }
}
