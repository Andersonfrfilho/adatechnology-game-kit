import type { Vec3 } from '../types'
import { add, mul, norm, lerp } from '../math'
import type { Rng } from '../rng'
import type { MeshBuilder } from './builder'

export interface BoxShellOptions {
  center: Vec3
  /** full size x, y, z */
  size: Vec3
  /** grid subdivisions per face edge (1, 2, 3...) */
  grid: number
  /** 0 = sharp box .. 1 = ellipsoid */
  round: number
  rng: Rng
  noise: number
  color: (p: Vec3, h: number, n: Vec3) => Vec3
  sway: (h: number) => number
}

/** Rounded, noisy box (clipped hedge section). The bottom face is omitted. */
export function boxShell(b: MeshBuilder, o: BoxShellOptions): void {
  const g = o.grid
  const hx = o.size[0] / 2
  const hy = o.size[1] / 2
  const hz = o.size[2] / 2
  const faces: { n: Vec3; u: Vec3; v: Vec3 }[] = [
    { n: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
    { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  ]
  // shared grid vertex noise keyed by quantized cube coordinate so faces stay welded
  const cache = new Map<string, Vec3>()
  const vertex = (c: Vec3): Vec3 => {
    const key = c.map((x) => Math.round(x * 1000)).join(',')
    const hit = cache.get(key)
    if (hit) return hit
    const m = Math.max(Math.abs(c[0]), Math.abs(c[1]), Math.abs(c[2]))
    const s = norm(c)
    const sphere: Vec3 = [s[0] * m, s[1] * m, s[2] * m]
    const q: Vec3 = [lerp(c[0], sphere[0], o.round), lerp(c[1], sphere[1], o.round), lerp(c[2], sphere[2], o.round)]
    const r = 1 + o.rng.gauss() * o.noise
    const p: Vec3 = [o.center[0] + q[0] * hx * r, o.center[1] + q[1] * hy * r, o.center[2] + q[2] * hz * r]
    cache.set(key, p)
    return p
  }
  for (const f of faces) {
    for (let i = 0; i < g; i++) {
      for (let j = 0; j < g; j++) {
        const u0 = (i / g) * 2 - 1
        const u1 = ((i + 1) / g) * 2 - 1
        const v0 = (j / g) * 2 - 1
        const v1 = ((j + 1) / g) * 2 - 1
        const corner = (u: number, v: number): Vec3 => add(add(mul(f.n, 1), mul(f.u, u)), mul(f.v, v))
        const ps = [vertex(corner(u0, v0)), vertex(corner(u1, v0)), vertex(corner(u1, v1)), vertex(corner(u0, v1))]
        const hs = ps.map((p) => (p[1] - (o.center[1] - hy)) / o.size[1])
        const cs = ps.map((p, k) => o.color(p, hs[k], f.n))
        b.flatQuad(ps[0], ps[1], ps[2], ps[3], cs[0], cs[1], cs[2], cs[3], o.sway(hs[0]), o.sway(hs[1]), o.sway(hs[2]), o.sway(hs[3]), add(f.n, [0, 0, 0]))
      }
    }
  }
}
