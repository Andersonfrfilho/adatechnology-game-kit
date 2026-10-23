import type { Vec3 } from '../types'
import { add, mul, norm, lerp } from '../math'
import { shade } from '../color'
import type { Rng } from '../rng'
import type { MeshBuilder } from './builder'

export interface BoxShellOptions {
  center: Vec3
  /** full size x, y, z */
  size: Vec3
  /** grid cells along x, y, z (a single number applies to all three) */
  grid: number | [number, number, number]
  /** 0 = sharp box .. 1 = ellipsoid (pulls edges and corners in) */
  round: number
  rng: Rng
  /** displacement amplitude as a fraction of the smallest dimension (smooth 3D value noise) */
  noise: number
  /** noise frequency in cycles per meter (default 1.8 / smallest dimension) */
  freq?: number
  /** per-face colour jitter (0..1, default 0.1) */
  jitter?: number
  color: (p: Vec3, h: number, n: Vec3) => Vec3
  sway: (h: number) => number
}

function hash3(x: number, y: number, z: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1274126177) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth 3D value noise in -1..1. */
export function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const fx = x - xi
  const fy = y - yi
  const fz = z - zi
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const sz = fz * fz * (3 - 2 * fz)
  const n = (a: number, b: number, c: number): number => hash3(xi + a, yi + b, zi + c, seed)
  const x00 = lerp(n(0, 0, 0), n(1, 0, 0), sx)
  const x10 = lerp(n(0, 1, 0), n(1, 1, 0), sx)
  const x01 = lerp(n(0, 0, 1), n(1, 0, 1), sx)
  const x11 = lerp(n(0, 1, 1), n(1, 1, 1), sx)
  return lerp(lerp(x00, x10, sy), lerp(x01, x11, sy), sz) * 2 - 1
}

/**
 * Clipped hedge section: one subdivided box (bottom face omitted) whose vertices are pushed along their outward
 * direction by smooth value noise, with edges and corners pulled in. Flat shaded, per-face colour jitter.
 */
export function boxShell(b: MeshBuilder, o: BoxShellOptions): void {
  const [gx, gy, gz] = typeof o.grid === 'number' ? [o.grid, o.grid, o.grid] : o.grid
  const hx = o.size[0] / 2
  const hy = o.size[1] / 2
  const hz = o.size[2] / 2
  const minDim = Math.min(o.size[0], o.size[1], o.size[2])
  const amp = o.noise * minDim
  const freq = o.freq ?? 1.8 / minDim
  const seed = Math.floor(o.rng.next() * 1e6)
  const jit = o.jitter ?? 0.1
  const faces: { n: Vec3; u: Vec3; v: Vec3; cu: number; cv: number }[] = [
    { n: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], cu: gz, cv: gy },
    { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], cu: gy, cv: gz },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], cu: gx, cv: gy },
    { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], cu: gy, cv: gx },
    { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], cu: gz, cv: gx },
  ]
  // shared grid vertices keyed by quantized cube coordinate so faces stay welded
  const cache = new Map<string, Vec3>()
  const vertex = (c: Vec3): Vec3 => {
    const key = c.map((x) => Math.round(x * 1000)).join(',')
    const hit = cache.get(key)
    if (hit) return hit
    const m = Math.max(Math.abs(c[0]), Math.abs(c[1]), Math.abs(c[2]))
    const s = norm(c)
    const sphere: Vec3 = [s[0] * m, s[1] * m, s[2] * m]
    const q: Vec3 = [lerp(c[0], sphere[0], o.round), lerp(c[1], sphere[1], o.round), lerp(c[2], sphere[2], o.round)]
    const base: Vec3 = [o.center[0] + q[0] * hx, o.center[1] + q[1] * hy, o.center[2] + q[2] * hz]
    const nz = valueNoise3(base[0] * freq, base[1] * freq, base[2] * freq, seed) * 0.75 + valueNoise3(base[0] * freq * 2.3, base[1] * freq * 2.3, base[2] * freq * 2.3, seed + 7) * 0.25
    const out = norm([q[0] / Math.max(hx, 1e-6), q[1] / Math.max(hy, 1e-6), q[2] / Math.max(hz, 1e-6)])
    const p: Vec3 = add(base, mul(out, nz * amp))
    cache.set(key, p)
    return p
  }
  let fi = 0
  for (const f of faces) {
    for (let i = 0; i < f.cu; i++) {
      for (let j = 0; j < f.cv; j++) {
        const u0 = (i / f.cu) * 2 - 1
        const u1 = ((i + 1) / f.cu) * 2 - 1
        const v0 = (j / f.cv) * 2 - 1
        const v1 = ((j + 1) / f.cv) * 2 - 1
        const corner = (u: number, v: number): Vec3 => add(add(mul(f.n, 1), mul(f.u, u)), mul(f.v, v))
        const ps = [vertex(corner(u0, v0)), vertex(corner(u1, v0)), vertex(corner(u1, v1)), vertex(corner(u0, v1))]
        const hs = ps.map((p) => (p[1] - (o.center[1] - hy)) / o.size[1])
        const fj = 1 - jit + 2 * jit * hash3(fi++, i, j, seed)
        const cs = ps.map((p, k) => shade(o.color(p, hs[k], f.n), fj))
        b.flatQuad(ps[0], ps[1], ps[2], ps[3], cs[0], cs[1], cs[2], cs[3], o.sway(hs[0]), o.sway(hs[1]), o.sway(hs[2]), o.sway(hs[3]), add(f.n, [0, 0, 0]))
      }
    }
  }
}
