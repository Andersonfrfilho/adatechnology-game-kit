import { hex, mix, rng, seedOf } from './colors'
import type { AtlasMap, CoverOptions, FloorKind, PropItem, PropsApi, Uv } from './types'

/** Default height of each floor kind above the ground. */
const HEIGHTS: Record<FloorKind, number> = { lawn: 0.02, dirt: 0.025, concrete: 0.03, tile_floor: 0.035, deck_floor: 0.04, pool_tile: 0.04, paving: 0.035 }

const inside = (poly: Array<[number, number]>, x: number, z: number): boolean => {
  let in_ = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) in_ = !in_
  }
  return in_
}

/**
 * Covers a rectangle centered on M (w x d) or a polygon `[[x, z], ...]` in local coordinates with floor tiles:
 * one atlas square per cell (repeats and tiles); the polygon uses cells of a quarter of the size.
 */
export function createCover(atlas: <K extends 'floor'>(name: K) => AtlasMap[K]) {
  return function cover(api: PropsApi, M: PropItem, kind: FloorKind, o: CoverOptions = {}): void {
    const A = atlas('floor')
    const size = o.size || A.size(kind)
    const nv = A.variants(kind)
    const y = o.y != null ? o.y : HEIGHTS[kind] || 0.03
    const color = o.color != null ? hex(o.color) : 0xffffff
    const poly = o.poly || M.poly
    const sd = seedOf(M)
    const rnd = rng(sd)
    const tint = () => {
      const v = 0.93 + rnd() * 0.07
      return mix(0x000000, color, v)
    }
    const quad = (cx: number, cz: number, qw: number, qd: number, uv: Uv) => api.plane(M, 'atlas_floor', cx, y, cz, qw, qd, tint(), 0, -Math.PI / 2, 0, uv)
    if (!poly) {
      const w = o.w || M.w || 4
      const d = o.d || M.d || 4
      for (let j = 0, v = 0; v < d - 1e-6; j++, v += size)
        for (let i = 0, u = 0; u < w - 1e-6; i++, u += size) {
          const qw = Math.min(size, w - u)
          const qd = Math.min(size, d - v)
          const b = A.uv(kind, (i * 7 + j * 13 + sd) % nv)
          const uv = { u0: b.u0, u1: b.u0 + ((b.u1 - b.u0) * qw) / size, v1: b.v1, v0: b.v1 - ((b.v1 - b.v0) * qd) / size }
          quad(-w / 2 + u + qw / 2, -d / 2 + v + qd / 2, qw, qd, uv)
        }
      return
    }
    let x0 = 1e9
    let z0 = 1e9
    let x1 = -1e9
    let z1 = -1e9
    for (const [x, z] of poly) {
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      z0 = Math.min(z0, z)
      z1 = Math.max(z1, z)
    }
    const st = size / 4
    for (let j = 0; z0 + j * st < z1; j++)
      for (let i = 0; x0 + i * st < x1; i++) {
        const cx = x0 + (i + 0.5) * st
        const cz = z0 + (j + 0.5) * st
        if (!inside(poly, cx, cz)) continue
        const b = A.uv(kind, (((i >> 2) * 7 + (j >> 2) * 13 + sd) % nv))
        const du = (b.u1 - b.u0) / 4
        const dv = (b.v1 - b.v0) / 4
        const ui = i & 3
        const vj = j & 3
        quad(cx, cz, st, st, { u0: b.u0 + ui * du, u1: b.u0 + (ui + 1) * du, v1: b.v1 - vj * dv, v0: b.v1 - (vj + 1) * dv })
      }
  }
}
