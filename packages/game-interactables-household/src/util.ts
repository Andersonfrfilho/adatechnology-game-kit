import type { Motion, Vec3 } from '@adatechnology/game-interactables'
import type { Primitive } from '@adatechnology/game-props3d'

export type Rgb = number

/** Deterministic PRNG (mulberry32 variant) returning floats in [0, 1). */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedOf(seed: number | string | undefined, x = 0, z = 0): number {
  if (seed == null) return Math.round(x * 37 + z * 91 + 1000) >>> 0
  if (typeof seed === 'number') return seed >>> 0
  return [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0
}

export const hex = (v: number | string): number => (typeof v === 'string' ? parseInt(v.replace('#', ''), 16) : v)

/** Scales brightness of a colour. */
export function shade(c: number | string, f: number): number {
  const n = hex(c)
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f))
  const b = Math.min(255, Math.round((n & 255) * f))
  return (r << 16) | (g << 8) | b
}

/** Linear mix of two colours. */
export function mix(a: number | string, b: number | string, t: number): number {
  const x = hex(a)
  const y = hex(b)
  const m = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t)
  return (m(16) << 16) | (m(8) << 8) | m(0)
}

export const round3 = (n: number): number => Math.round(n * 1000) / 1000

// ---------------------------------------------------------------------------------------------------------------------------------
// Geometry shared by the builders (sweep rects) and by the tests (bounds)
// ---------------------------------------------------------------------------------------------------------------------------------

/** Rotates `p` around the axis through `o` (axis need not be normalized). */
export function rotateAxis(p: Vec3, o: Vec3, axis: Vec3, ang: number): Vec3 {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const k: Vec3 = [axis[0] / l, axis[1] / l, axis[2] / l]
  const v: Vec3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]
  const cr: Vec3 = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]
  return [
    o[0] + v[0] * c + cr[0] * s + k[0] * dot * (1 - c),
    o[1] + v[1] * c + cr[1] * s + k[1] * dot * (1 - c),
    o[2] + v[2] * c + cr[2] * s + k[2] * dot * (1 - c),
  ]
}

/** Euler YXZ (three.js order): z first, then x, then y. */
function eulerYXZ(v: Vec3, ry: number, rx: number, rz: number): Vec3 {
  let [x, y, z] = v
  if (rz) [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)]
  if (rx) [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)]
  if (ry) [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)]
  return [x, y, z]
}

/** The 8 (box, cylinder) or 4 (plane) corners of a primitive in its own frame. Leaves and lights return their anchor and tip. */
export function cornersOf(p: Primitive): Vec3[] {
  const out: Vec3[] = []
  if (p.kind === 'box') {
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
      const l = eulerYXZ([(sx * p.w) / 2, (sy - 0.5) * p.h, (sz * p.d) / 2], p.ry, p.rx, p.rz)
      out.push([p.x + l[0], p.y + p.h / 2 + l[1], p.z + l[2]])
    }
  } else if (p.kind === 'cylinder') {
    const rot = p.rx !== 0 || p.rz !== 0
    const cy = rot ? p.y : p.y + p.h / 2
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const l = eulerYXZ([sx * p.r, (sy * p.h) / 2, sz * p.r], 0, p.rx, p.rz)
      out.push([p.x + l[0], cy + l[1], p.z + l[2]])
    }
  } else if (p.kind === 'plane') {
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const l = eulerYXZ([(sx * p.w) / 2, (sy * p.h) / 2, 0], p.ry, p.rx, p.rz)
      out.push([p.x + l[0], p.y + l[1], p.z + l[2]])
    }
  } else if (p.kind === 'leaf') {
    out.push([p.x, p.y, p.z], [p.x, p.y + p.h, p.z])
  } else {
    out.push([p.x, p.y, p.z])
  }
  return out
}

/** Position of a point of a part (given in object-local coordinates at t = 0) when the part is at `t`. */
export function motionPoint(p: Vec3, pivot: Vec3, m: Motion, t: number): Vec3 {
  const axis = m.axis ?? [0, 1, 0]
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const k: Vec3 = [axis[0] / l, axis[1] / l, axis[2] / l]
  if (m.kind === 'slide') {
    const d = (m.distance ?? 0) * t
    return [p[0] + k[0] * d, p[1] + k[1] * d, p[2] + k[2] * d]
  }
  if (m.kind === 'scale') {
    const s = ((m.scale ?? 1) - 1) * t
    const dot = (p[0] - pivot[0]) * k[0] + (p[1] - pivot[1]) * k[1] + (p[2] - pivot[2]) * k[2]
    return [p[0] + k[0] * dot * s, p[1] + k[1] * dot * s, p[2] + k[2] * dot * s]
  }
  return rotateAxis(p, pivot, axis, (m.angle ?? 0) * t)
}

/** Floor rect [x0, z0, x1, z1] covered by object-local points while the part goes from t = 0 to t = 1. */
export function sweepOf(points: Vec3[], pivot: Vec3, m: Motion, margin = 0.01): [number, number, number, number] {
  let x0 = Infinity
  let z0 = Infinity
  let x1 = -Infinity
  let z1 = -Infinity
  for (let i = 0; i <= 16; i++) {
    for (const p of points) {
      const q = motionPoint(p, pivot, m, i / 16)
      if (q[0] < x0) x0 = q[0]
      if (q[0] > x1) x1 = q[0]
      if (q[2] < z0) z0 = q[2]
      if (q[2] > z1) z1 = q[2]
    }
  }
  return [round3(x0 - margin), round3(z0 - margin), round3(x1 + margin), round3(z1 + margin)]
}
