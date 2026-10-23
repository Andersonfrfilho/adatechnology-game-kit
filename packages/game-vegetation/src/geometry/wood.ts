import type { Lod, Vec3 } from '../types'
import { clamp } from '../math'
import { shade, mix } from '../color'
import type { MeshBuilder } from './builder'
import { tube } from './tube'
import type { Branch } from './branches'

/** Bark color function: vertical bands, angular ribs, darker toward the ground, lighter young tips. */
export function barkColor(base: Vec3, level: number, seed = 0): (t: number, a: number) => Vec3 {
  const lightTip: Vec3 = shade(base, 1.18)
  return (t, a) => {
    const band = 0.93 + 0.07 * Math.sin(t * (level === 0 ? 38 : 16) + seed)
    const rib = 0.92 + 0.08 * Math.cos(a * Math.PI * 2 * 3 + seed * 1.7 + t * 2.2)
    let k = band * rib
    if (level === 0) k *= 0.8 + 0.2 * clamp(t * 7, 0, 1)
    const c = shade(base, k * 1.5)
    return level === 0 ? c : mix(c, lightTip, clamp(t * 0.8, 0, 1) * 0.5)
  }
}

/** Draw a branch / trunk as a tapered tube, thinning the path by lod. */
export function drawBranch(b: MeshBuilder, br: Branch, bark: Vec3, lod: Lod, seed = 0): void {
  const maxLevel = lod === 0 ? 99 : lod === 1 ? 2 : 1
  if (br.level > maxLevel) return
  const stride = lod === 0 ? (br.level >= 1 ? 2 : 1) : lod === 1 ? (br.level >= 1 ? 3 : 2) : br.level === 0 ? 4 : 3
  const pts: Vec3[] = []
  const radii: number[] = []
  for (let i = 0; i < br.pts.length; i += stride) {
    pts.push(br.pts[i])
    radii.push(br.radii[i])
  }
  if ((br.pts.length - 1) % stride !== 0) {
    pts.push(br.pts[br.pts.length - 1])
    radii.push(br.radii[br.radii.length - 1])
  }
  if (pts.length < 2) return
  const sides = br.level === 0 ? (lod === 0 ? 8 : lod === 1 ? 6 : 4) : br.level === 1 ? (lod === 0 ? 5 : 3) : lod === 0 ? 4 : 3
  const lv = br.level
  tube(b, pts, {
    sides,
    radii,
    color: barkColor(bark, lv, seed),
    sway: (t) => (lv === 0 ? 0.03 * t : clamp(0.06 * lv + 0.22 * t, 0, 0.5)),
    end: br.broken ? 'flat' : 'point',
  })
}
