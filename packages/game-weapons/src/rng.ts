import type { Vec3 } from './types'

/** Deterministic mulberry32 generator; returns floats in [0, 1). */
export const createRng = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2])
  return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, -1]
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Uniform direction inside a cone of half-angle `deg` around the unit vector `dir` (uniform over the solid angle). */
export const sampleCone = (dir: Vec3, deg: number, rng: () => number): Vec3 => {
  if (deg <= 0) return dir
  const cosMax = Math.cos((deg * Math.PI) / 180)
  const cosT = 1 - rng() * (1 - cosMax)
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT))
  const phi = rng() * Math.PI * 2
  const helper: Vec3 = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = normalize(cross(helper, dir))
  const v = cross(dir, u)
  const cx = Math.cos(phi) * sinT
  const cy = Math.sin(phi) * sinT
  return normalize([
    u[0] * cx + v[0] * cy + dir[0] * cosT,
    u[1] * cx + v[1] * cy + dir[1] * cosT,
    u[2] * cx + v[2] * cy + dir[2] * cosT,
  ])
}
