import type { Vec3 } from '../types'
import { add, mul } from '../math'
import { mix } from '../color'
import type { MeshBuilder } from './builder'

export interface BladeOptions {
  /** segments (tris = 2 * segs - 1) */
  segs: number
  /** horizontal lean 0..1.2 (fraction of height the tip is displaced) */
  lean: number
  /** curvature exponent of the lean (higher = straighter at the base) */
  bend?: number
  swayMax: number
  /** twist of the ribbon around the blade axis in radians */
  twist?: number
}

/** Curved tapered grass blade (a ribbon facing outward, not crossed planes). `az` is the direction the blade leans toward. */
export function blade(b: MeshBuilder, base: Vec3, az: number, height: number, width: number, c0: Vec3, c1: Vec3, o: BladeOptions): Vec3 {
  const dx = Math.cos(az)
  const dz = Math.sin(az)
  const bend = o.bend ?? 1.7
  const tw = o.twist ?? 0
  const side: Vec3 = [-dz * Math.cos(tw), Math.sin(tw), dx * Math.cos(tw)]
  const pts: Vec3[] = []
  for (let i = 0; i <= o.segs; i++) {
    const t = i / o.segs
    const h = height * (1 - 0.18 * t * t)
    const off = o.lean * height * Math.pow(t, bend)
    pts.push([base[0] + dx * off, base[1] + h * t, base[2] + dz * off])
  }
  const nrm: Vec3 = [dx, 0.2, dz]
  for (let i = 0; i < o.segs; i++) {
    const t0 = i / o.segs
    const t1 = (i + 1) / o.segs
    const w0 = width * 0.5 * (1 - Math.pow(t0, 1.3) * 0.9)
    const w1 = width * 0.5 * (1 - Math.pow(t1, 1.3) * 0.9) * (i + 1 === o.segs ? 0 : 1)
    const a = add(pts[i], mul(side, -w0))
    const bb = add(pts[i], mul(side, w0))
    const cA = mix(c0, c1, t0)
    const cB = mix(c0, c1, t1)
    const s0 = o.swayMax * Math.pow(t0, 1.4)
    const s1 = o.swayMax * Math.pow(t1, 1.4)
    if (i + 1 === o.segs) {
      b.flatTri(a, bb, pts[i + 1], cA, cA, cB, s0, s0, s1, nrm)
    } else {
      const c = add(pts[i + 1], mul(side, w1))
      const d = add(pts[i + 1], mul(side, -w1))
      b.flatQuad(a, bb, c, d, cA, cA, cB, cB, s0, s0, s1, s1, nrm)
    }
  }
  return pts[pts.length - 1]
}
