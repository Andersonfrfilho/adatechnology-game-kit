import type { Vec3 } from '../types'
import { add, cross, mul, norm, perp } from '../math'
import { shade } from '../color'
import type { Rng } from '../rng'
import type { MeshBuilder } from './builder'

/** Tuft of thin radial spines at an areole: each spine is one thin triangle. */
export function spineTuft(b: MeshBuilder, p: Vec3, n: Vec3, count: number, length: number, color: Vec3, rng: Rng, sway = 0): void {
  const nn = norm(n)
  const t1 = perp(nn)
  const t2 = norm(cross(nn, t1))
  const w = length * 0.07
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.range(0, 0.6)
    const spread = i === 0 ? 0 : 0.55
    const dir = norm(add(mul(nn, 1), add(mul(t1, Math.cos(a) * spread), mul(t2, Math.sin(a) * spread))))
    const tip = add(p, mul(dir, length * rng.range(0.75, 1.1)))
    const side = mul(norm(cross(dir, nn)), w)
    const left = add(p, side)
    const right = add(p, mul(side, -1))
    b.flatTri(left, right, tip, shade(color, 0.8), shade(color, 0.8), color, sway, sway, sway, nn)
  }
}

/** Tiny dark areole base under a tuft (single triangle). */
export function areole(b: MeshBuilder, p: Vec3, n: Vec3, size: number, color: Vec3, sway = 0): void {
  const nn = norm(n)
  const t1 = mul(perp(nn), size)
  const t2 = mul(norm(cross(nn, perp(nn))), size)
  const c = add(p, mul(nn, size * 0.1))
  b.flatTri(add(c, t1), add(c, add(mul(t1, -0.5), t2)), add(c, add(mul(t1, -0.5), mul(t2, -1))), color, color, color, sway, sway, sway, nn)
}
