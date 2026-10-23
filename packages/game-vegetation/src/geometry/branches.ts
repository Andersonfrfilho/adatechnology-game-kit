import type { CrownShape, Vec3 } from '../types'
import type { Rng } from '../rng'
import { add, catmull, clamp, dirFromAngles, lerp, mul, norm, perp, rotAxis, cross, sub, TAU } from '../math'

export interface Branch {
  /** control points (smooth with catmull for rendering) */
  pts: Vec3[]
  radii: number[]
  level: number
  broken?: boolean
}
export interface Tip {
  p: Vec3
  dir: Vec3
  /** relative size 0.7..1.3 */
  size: number
  level: number
  seed: number
  /** random 0..1 used to decide whether the tip keeps its leaves in dry / winter conditions */
  keep: number
  /** extra random 0..1 */
  roll: number
}
export interface TreeShape {
  trunk: Branch
  branches: Branch[]
  tips: Tip[]
  /** center of the crown (for shading) */
  crown: Vec3
  trunkTopY: number
}

export interface GrowParams {
  height: number
  trunkRadius: number
  crownRadius: number
  shape: CrownShape
  levels: number
  trunkFraction: number
  gnarl: number
  /** number of primary branches */
  primary: number
  lean: number
  /** 'bare' trees show twisted limbs, with broken stubs */
  bare?: boolean
}

function jitterDir(rng: Rng, d: Vec3, amt: number): Vec3 {
  return norm([d[0] + rng.gauss() * amt, d[1] + rng.gauss() * amt * 0.6, d[2] + rng.gauss() * amt])
}

function branchPath(rng: Rng, start: Vec3, dir0: Vec3, length: number, steps: number, upBias: number, droop: number, gnarl: number): Vec3[] {
  const pts: Vec3[] = [start]
  let d = dir0
  let p = start
  for (let i = 0; i < steps; i++) {
    const f = (i + 1) / steps
    d = norm(add(jitterDir(rng, d, gnarl), [0, upBias / steps - droop * f * f * 0.9, 0]))
    p = add(p, mul(d, length / steps))
    pts.push(p)
  }
  return pts
}

function taper(n: number, r0: number, r1: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(lerp(r0, r1, Math.pow(i / (n - 1), 0.85)))
  return out
}

/** Grow the skeleton of a tree: trunk, nested branches and leaf-clump anchors. Consumes the same random numbers at every LOD. */
export function growTree(rng: Rng, p: GrowParams): TreeShape {
  const H = p.height
  const trunkTop = H * (p.shape === 'columnar' ? 0.97 : 0.93)
  const clearY = H * p.trunkFraction
  // trunk centerline
  const n = 7
  const ctrl: Vec3[] = []
  let ox = 0
  let oz = 0
  const lx = Math.cos(rng.range(0, TAU))
  const lz = Math.sin(rng.range(0, TAU))
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1)
    if (i > 0) {
      ox += rng.gauss() * p.gnarl * H * 0.025
      oz += rng.gauss() * p.gnarl * H * 0.025
    }
    ctrl.push([ox + lx * p.lean * H * f * f, trunkTop * f, oz + lz * p.lean * H * f * f])
  }
  const tpts = catmull(ctrl, 3)
  const tr: number[] = []
  for (let i = 0; i < tpts.length; i++) {
    const f = i / (tpts.length - 1)
    tr.push(p.trunkRadius * (1 - 0.62 * f) * (1 + 0.5 * Math.exp(-f * 22)) * (f > 0.9 ? 0.85 : 1))
  }
  const trunk: Branch = { pts: tpts, radii: tr, level: 0 }
  const trunkAt = (y: number): { pos: Vec3; r: number } => {
    const f = Math.min(1, Math.max(0, y / trunkTop)) * (tpts.length - 1)
    const i = Math.min(tpts.length - 2, Math.floor(f))
    const u = f - i
    return { pos: [lerp(tpts[i][0], tpts[i + 1][0], u), lerp(tpts[i][1], tpts[i + 1][1], u), lerp(tpts[i][2], tpts[i + 1][2], u)], r: lerp(tr[i], tr[i + 1], u) }
  }

  const branches: Branch[] = []
  const tips: Tip[] = []
  const baseAz = rng.range(0, TAU)
  const golden = 2.399963
  const pushTip = (pos: Vec3, dir: Vec3, level: number, size: number): void => {
    tips.push({ p: pos, dir, size, level, seed: rng.seed(), keep: rng.next(), roll: rng.next() })
  }

  const grow = (start: Vec3, dir: Vec3, length: number, r0: number, level: number, fracStart: number, shapeUp: number, droop: number): void => {
    const steps = level === 1 ? 5 : 4
    const pts = branchPath(rng, start, dir, length, steps, shapeUp, droop, p.gnarl * 0.18)
    let radii = taper(pts.length, r0, Math.max(r0 * 0.22, 0.006))
    let broken = false
    if (p.bare && level >= 2 && rng.chance(0.3)) {
      // broken stub: cut short, blunt end
      pts.length = Math.max(2, Math.ceil(pts.length * rng.range(0.45, 0.7)))
      radii = radii.slice(0, pts.length)
      radii[radii.length - 1] = radii[radii.length - 2] * 0.7
      broken = true
    }
    branches.push({ pts: catmull(pts, 2), radii: catmull(radii.map((r) => [r, 0, 0] as Vec3), 2).map((v) => v[0]), level, broken })
    const last = pts[pts.length - 1]
    const lastDir = norm(sub(last, pts[pts.length - 2]))
    if (level >= p.levels || broken) {
      if (!broken) pushTip(last, lastDir, level, rng.range(0.85, 1.2))
      else rng.next()
    } else {
      // continue the branch with a tip and spawn children
      const kids = level === 1 ? rng.int(2, 3) : 2
      for (let k = 0; k < kids; k++) {
        const t = rng.range(0.4, 0.92) * (kids === 1 ? 1 : 1)
        const idx = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)))
        const u = t * (pts.length - 1) - idx
        const pos: Vec3 = [lerp(pts[idx][0], pts[idx + 1][0], u), lerp(pts[idx][1], pts[idx + 1][1], u), lerp(pts[idx][2], pts[idx + 1][2], u)]
        const pd = norm(sub(pts[idx + 1], pts[idx]))
        const axis = norm(cross(pd, perp(pd)))
        const rot = rotAxis(pd, rotAxis(axis, pd, rng.range(0, TAU)), rng.range(0.45, 0.95) * rng.sign())
        const cdir = norm(add(rot, [0, 0.25, 0]))
        grow(pos, cdir, length * rng.range(0.5, 0.68) * (1 - t * 0.35), radii[idx] * 0.62, level + 1, fracStart, shapeUp, droop)
      }
      if (!p.bare) pushTip(last, lastDir, level, rng.range(0.9, 1.2))
      else rng.next()
    }
  }

  for (let i = 0; i < p.primary; i++) {
    const f = p.primary === 1 ? 0 : i / (p.primary - 1)
    const y = lerp(clearY, trunkTop * 0.82, Math.pow(f, 0.9)) + rng.range(-0.04, 0.04) * H
    const { pos, r } = trunkAt(y)
    const az = baseAz + i * golden + rng.range(-0.25, 0.25)
    const hf = clamp((y - clearY) / Math.max(0.01, trunkTop - clearY), 0, 1)
    let el: number
    let lenK: number
    let up: number
    let droop = 0
    switch (p.shape) {
      case 'spreading':
        el = lerp(0.5, 0.18, 1 - hf) * (0.9 + rng.next() * 0.3)
        lenK = lerp(1.15, 0.75, hf)
        up = 0.25
        break
      case 'columnar':
        el = lerp(1.15, 1.35, hf)
        lenK = lerp(0.85, 0.5, hf)
        up = 0.25
        break
      case 'weeping':
        el = lerp(0.95, 0.6, 1 - hf)
        lenK = lerp(1.15, 0.7, hf)
        up = 0.5
        droop = 1.8
        break
      default:
        el = lerp(1.05, 0.62, 1 - hf) + rng.range(-0.1, 0.1)
        lenK = lerp(1.1, 0.7, Math.pow(hf, 1.3))
        up = 0.35
    }
    const dir = dirFromAngles(az, el)
    const start = add(pos, mul(norm([dir[0], 0, dir[2]]), r * 0.5))
    grow(start, dir, p.crownRadius * lenK * rng.range(0.85, 1.1), r * rng.range(0.4, 0.55), 1, f, up, droop)
  }
  // leader clump at the top
  const topPos = tpts[tpts.length - 1]
  pushTip(add(topPos, [0, H * 0.02, 0]), [0, 1, 0], 0, p.shape === 'columnar' ? 1.1 : 1.0)

  // crown center
  let cx = 0
  let cy = 0
  let cz = 0
  for (const t of tips) {
    cx += t.p[0]
    cy += t.p[1]
    cz += t.p[2]
  }
  const m = Math.max(1, tips.length)
  return { trunk, branches, tips, crown: [cx / m, cy / m - H * 0.04, cz / m], trunkTopY: trunkTop }
}

/**
 * Rescale branches and tips (not the trunk) so the crown reaches `height` and `reach` once clumps of radius `clumpR` sit on the tips.
 * Keeps the proportions honest whatever the random growth did.
 */
export function fitTree(tree: TreeShape, height: number, reach: number, clumpR: number, clearY: number, tipFilter?: (t: Tip) => boolean): void {
  let maxY = clearY + 0.01
  let maxR = 0.01
  for (const t of tree.tips) {
    if (tipFilter && !tipFilter(t)) continue
    maxY = Math.max(maxY, t.p[1])
    maxR = Math.max(maxR, Math.hypot(t.p[0], t.p[2]))
  }
  const sx = clamp((reach - clumpR * 0.7) / Math.max(0.1, maxR), 0.35, 1.8)
  const sy = clamp((height - clumpR * 0.55 - clearY) / Math.max(0.1, maxY - clearY), 0.4, 1.6)
  const f = (p: Vec3): void => {
    p[0] *= sx
    p[2] *= sx
    if (p[1] > clearY) p[1] = clearY + (p[1] - clearY) * sy
  }
  for (const b of tree.branches) for (const p of b.pts) f(p)
  for (const t of tree.tips) f(t.p)
  tree.crown = [tree.crown[0] * sx, clearY + (tree.crown[1] - clearY) * sy, tree.crown[2] * sx]
}
