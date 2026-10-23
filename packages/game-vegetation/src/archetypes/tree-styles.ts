import type { BroadleafTreeSpec, CrownStyle, Vec3 } from '../types'
import type { Ctx } from '../ctx'
import { Rng } from '../rng'
import { add, clamp, dist, lerp, mul, norm, TAU } from '../math'
import { mix, shade } from '../color'
import { clump, clumpLeaves } from '../geometry/shell'
import { tube } from '../geometry/tube'
import { barkColor } from '../geometry/wood'
import { leaf } from '../geometry/leaf'
import { growTree, type Branch, type GrowParams, type Tip, type TreeShape } from '../geometry/branches'
import { catmull } from '../math'

export interface StyleGroup {
  p: Vec3
  r: number
  sq: number
}

export interface StyleEnv {
  ctx: Ctx
  spec: BroadleafTreeSpec
  tree: TreeShape
  vis: Tip[]
  H: number
  R: number
  clearY: number
  /** leaf / bloom color of a clump */
  colorFor: (tip: Tip) => { base: Vec3; accent?: { color: Vec3; amount: number } }
  grow: number
  bark: Vec3
  keep: number
  bloomOn: boolean
}

interface Anchor {
  p: Vec3
  r: number
  sq: number
  tip: Tip
  tone: number
}

/** Weeping willow skeleton: short trunk forking into arching limbs that rise, then fall toward the ground. */
export function willowTree(rng: Rng, p: GrowParams): TreeShape {
  const base = growTree(rng, { ...p, height: p.height * 0.56, primary: 1, levels: 1, shape: 'round' })
  const H = p.height
  const trunk = base.trunk
  const top = trunk.pts[trunk.pts.length - 1]
  const branches: Branch[] = []
  const tips: Tip[] = []
  const n = 8
  for (let i = 0; i < n; i++) {
    const az = (i / n) * TAU + rng.range(-0.25, 0.25)
    const y0 = top[1] * rng.range(0.72, 0.98)
    // the trunk position at that height (trunk pts are dense and monotonic in y)
    let tp = top
    for (const q of trunk.pts) if (q[1] >= y0) { tp = q; break }
    const L = p.crownRadius * rng.range(0.85, 1.1)
    const G = H * rng.range(0.15, 0.22)
    const k2 = 6.25 * G
    const pts: Vec3[] = []
    for (let k = 0; k <= 7; k++) {
      const t = k / 7
      const d = L * Math.pow(t, 0.85)
      const wob = Math.sin(t * 5 + i) * 0.12
      pts.push([tp[0] + Math.cos(az + wob) * d, y0 + 0.8 * k2 * t - k2 * t * t, tp[2] + Math.sin(az + wob) * d])
    }
    const sm = catmull(pts, 2)
    const r0 = trunk.radii[Math.floor(trunk.radii.length * 0.85)] * rng.range(0.4, 0.5)
    const radii = sm.map((_, k) => Math.max(0.012, r0 * (1 - 0.85 * (k / (sm.length - 1)))))
    branches.push({ pts: sm, radii, level: 1 })
    // twig forks
    for (let q = 0; q < 2; q++) {
      const t = rng.range(0.4, 0.7)
      const bi = Math.floor(t * (sm.length - 1))
      const s0 = sm[bi]
      const az2 = az + rng.range(0.5, 1) * (q ? 1 : -1)
      const pp: Vec3[] = [s0]
      for (let k = 1; k <= 4; k++) pp.push([s0[0] + Math.cos(az2) * L * 0.12 * k, s0[1] + (k < 2 ? 0.1 : -0.25 * k) * H * 0.04 - k * 0.15, s0[2] + Math.sin(az2) * L * 0.12 * k])
      branches.push({ pts: catmull(pp, 2), radii: catmull(pp.map((_, k) => [r0 * 0.4 * (1 - k * 0.2), 0, 0] as Vec3), 2).map((v) => Math.max(0.008, v[0])), level: 2 })
    }
    for (const t of [0.3, 0.55, 0.8]) {
      const q = sm[Math.floor(t * (sm.length - 1))]
      tips.push({ p: q, dir: [0, 1, 0], size: rng.range(0.8, 1.2), level: 1, seed: rng.seed(), keep: rng.next(), roll: rng.next() })
    }
  }
  tips.push({ p: [top[0], top[1] + 0.4, top[2]], dir: [0, 1, 0], size: 1, level: 0, seed: rng.seed(), keep: 0, roll: 0.5 })
  return { trunk, branches, tips, crown: [top[0], top[1] + G0(H), top[2]], trunkTopY: top[1] }
}
const G0 = (H: number): number => H * 0.12

/** Skeleton parameters per style: how the branches grow under the crown. */
export function styleSkeleton(style: CrownStyle): { shape: 'round' | 'spreading' | 'weeping'; primary: number; trunkFraction: number; levels: number; gnarl: number; lean: number } {
  switch (style) {
    case 'dome':
      return { shape: 'spreading', primary: 6, trunkFraction: 0.34, levels: 3, gnarl: 0.5, lean: 0.02 }
    case 'umbrella':
      return { shape: 'spreading', primary: 7, trunkFraction: 0.46, levels: 2, gnarl: 0.55, lean: 0.03 }
    case 'lumpy':
      return { shape: 'round', primary: 5, trunkFraction: 0.3, levels: 3, gnarl: 0.95, lean: 0.05 }
    case 'sphere':
      return { shape: 'round', primary: 4, trunkFraction: 0.5, levels: 2, gnarl: 0.3, lean: 0.01 }
    case 'willow':
      return { shape: 'weeping', primary: 7, trunkFraction: 0.28, levels: 2, gnarl: 0.5, lean: 0.03 }
    case 'sparse_high':
      return { shape: 'round', primary: 4, trunkFraction: 0.58, levels: 3, gnarl: 0.9, lean: 0.07 }
    default:
      return { shape: 'round', primary: 5, trunkFraction: 0.32, levels: 3, gnarl: 0.55, lean: 0.03 }
  }
}

const fakeTip = (r: Rng, level = 1): Tip => ({ p: [0, 0, 0], dir: [0, 1, 0], size: 1, level, seed: r.seed(), keep: r.next(), roll: r.next() })

function pickSpread(tips: Tip[], rad: number, max: number, minY: number): Tip[] {
  const out: Tip[] = []
  const sorted = tips.filter((t) => t.p[1] >= minY).sort((a, b) => b.level - a.level || a.keep - b.keep)
  for (const t of sorted) {
    if (out.length >= max) break
    if (out.every((o) => dist(o.p, t.p) > rad * 1.05)) out.push(t)
  }
  return out
}

function buildAnchors(style: CrownStyle, env: StyleEnv, rng: Rng): Anchor[] {
  const { H, R, tree, vis } = env
  const size = env.spec.clumpSize ?? 1
  const top = tree.trunk.pts[tree.trunk.pts.length - 1]
  const cx = tree.crown[0] * 0.3 + top[0] * 0.7
  const cz = tree.crown[2] * 0.3 + top[2] * 0.7
  const out: Anchor[] = []
  const add1 = (p: Vec3, r: number, sq: number, tip?: Tip, tone = 1): void => {
    out.push({ p, r, sq, tip: tip ?? fakeTip(rng), tone })
  }
  switch (style) {
    case 'sphere': {
      const rs = Math.min(R, (H - env.clearY) * 0.5) * 1.0
      add1([top[0], H - rs, top[2]], rs, 1, vis[0])
      break
    }
    case 'dome':
    case 'cloud': {
      const cloud = style === 'cloud'
      const y0 = cloud ? Math.min(env.clearY * 0.7, Math.max(0.7, H * 0.2)) : env.clearY * 0.66
      const n = cloud ? 9 : 11
      const rr = R * (cloud ? 0.5 : 0.4) * size
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n
        const ang = i * 2.399963
        const rad = Math.min(R - rr * 0.95, Math.sqrt(u) * R * (cloud ? 0.78 : 0.9))
        const hh = Math.pow(Math.max(0.04, 1 - (rad / R) ** 2), cloud ? 0.6 : 0.42)
        const r = rr * (1.12 - 0.3 * u) * rng.range(0.9, 1.08)
        const sq = cloud ? 0.92 : 0.7
        const depth = cloud ? (i % 3 === 0 ? 1 : 0.35 + 0.65 * ((i * 0.618034) % 1)) : 0.3 + 0.7 * ((i * 0.618034) % 1)
        const y = y0 + r * sq + hh * (H - y0 - r * sq * 2) * (cloud ? 0.95 : 0.96) * depth
        add1([cx + Math.cos(ang) * rad, y, cz + Math.sin(ang) * rad], r, sq, undefined, 1 - u * 0.1)
      }
      break
    }
    case 'umbrella': {
      const sq = 0.36
      const r0 = R * 0.4 * size
      const yTop = H - r0 * sq
      add1([cx, yTop, cz], r0 * 0.95, sq)
      const rings: [number, number][] = [[6, 0.36], [10, 0.7], [12, 1.0]]
      for (const [cnt, f] of rings) {
        for (let i = 0; i < cnt; i++) {
          const ang = (i / cnt) * TAU + f * 2 + rng.range(-0.15, 0.15)
          const rad = Math.min(R - r0 * 0.7, R * f) * rng.range(0.92, 1.05)
          const r = r0 * rng.range(0.85, 1.1) * (1 - f * 0.12)
          add1([cx + Math.cos(ang) * rad, yTop - (rad / R) * H * 0.07 - rng.range(0, 0.25), cz + Math.sin(ang) * rad], r, sq, undefined, 1)
        }
      }
      break
    }
    case 'lumpy': {
      const r = R * 0.3 * size
      const picks = pickSpread(vis, r * 1.5, 15, env.clearY + 0.05 * H)
      for (const t of picks) add1(add(t.p, [0, r * 0.45, 0]), r * t.size * rng.range(0.85, 1.15), 0.7, t, rng.range(0.9, 1.1))
      break
    }
    case 'sparse_high': {
      const r = R * 0.3 * size
      const picks = pickSpread(vis, r * 0.9, 8, env.clearY)
      for (const t of picks) add1(add(t.p, [0, r * 0.25, 0]), r * t.size * rng.range(0.75, 1.15), 0.68, t, 1)
      // irregular fill around the upper trunk
      const yTop = H - r * 0.5
      for (let i = 0; i < 9; i++) {
        const ang = rng.range(0, TAU)
        const rad = R * rng.range(0.2, 1.0)
        const y = lerp(env.clearY + (H - env.clearY) * 0.2, yTop, rng.next())
        add1([cx + Math.cos(ang) * rad, y, cz + Math.sin(ang) * rad], r * rng.range(0.55, 0.9), 0.66, undefined, rng.range(0.9, 1.05))
      }
      break
    }
    case 'willow': {
      const r = R * 0.24 * size
      const picks = pickSpread(vis, r * 1.2, 9, env.clearY)
      for (const t of picks) add1(add(t.p, [0, r * 0.2, 0]), r * t.size, 0.5, t, 1)
      break
    }
    default:
      break
  }
  return out
}

/** Hanging curtain strips (willow / eucalyptus) from points along the branches. */
function hangStrips(env: StyleEnv, rng: Rng, base: Vec3, opts: { perBranch: number; minLen: number; maxLen: number; toGround: boolean; width: number; light: Vec3 }): void {
  const { ctx, tree } = env
  const lodK = ctx.pick(1, 0.45, 0.18)
  for (const br of tree.branches) {
    if (br.level < 1) continue
    const n = Math.max(1, Math.round(opts.perBranch * lodK * (br.level === 1 ? 1 : 0.8)))
    for (let k = 0; k < n; k++) {
      const t = lerp(0.45, 1, (k + rng.next() * 0.7) / n)
      const idx = Math.min(br.pts.length - 2, Math.floor(t * (br.pts.length - 1)))
      const u = t * (br.pts.length - 1) - idx
      const p: Vec3 = [lerp(br.pts[idx][0], br.pts[idx + 1][0], u), lerp(br.pts[idx][1], br.pts[idx + 1][1], u), lerp(br.pts[idx][2], br.pts[idx + 1][2], u)]
      const len = opts.toGround ? Math.max(opts.minLen, (p[1] - 0.2 - rng.range(0, 0.9)) * rng.range(0.85, 1)) : rng.range(opts.minLen, opts.maxLen)
      const out = norm([p[0], 0, p[2]])
      const w = opts.width * (ctx.lod === 2 ? 2.2 : 1) * rng.range(0.8, 1.2)
      const g0 = shade(base, 0.78)
      const g1 = mix(base, opts.light, 0.55)
      const reps = ctx.lod === 0 ? 2 : 1
      for (let q = 0; q < reps; q++) {
        const off: Vec3 = [-out[2] * w * q * 0.9, 0, out[0] * w * q * 0.9]
        leaf(ctx.foliage, add(p, off), [out[0] * 0.12, -1, out[2] * 0.12], out, len * rng.range(0.9, 1), w, g0, g1, { rows: ctx.lod === 0 ? 3 : 2, curl: 0.04, fold: 0.2, baseWidth: 0.7, swayBase: 0.35, swayTip: 1, peak: 0.2, round: 1.4 })
      }
    }
  }
}

/** Foliage of a styled crown; returns the clump list so blossoms / fruit can sit on it. */
export function styledCrown(style: CrownStyle, env: StyleEnv): StyleGroup[] {
  const { ctx } = env
  const rng = new Rng((env.vis[0]?.seed ?? 1) ^ 0x51ed27)
  let anchors = buildAnchors(style, env, rng)
  const overgrown = ctx.condition === 'overgrown' ? 1.14 : 1
  // condition / season: drop some clumps (dry, bare), never the first
  anchors = anchors.filter((a, i) => i === 0 || a.tip.keep < env.keep)
  if (ctx.lod === 2 && anchors.length > 4) anchors = anchors.filter((_, i) => i % 2 === 0).map((a) => ({ ...a, r: a.r * 1.25 }))
  const groups: StyleGroup[] = []
  const bigSphere = style === 'sphere'
  for (const a of anchors) {
    const { base: b0, accent } = env.colorFor(a.tip)
    const base = shade(b0, clamp(a.tone * (0.9 + a.tip.roll * 0.2), 0.7, 1.15))
    const r = a.r * overgrown
    const detail = (ctx.lod === 0 ? (bigSphere ? 2 : 1) : ctx.lod === 1 ? (bigSphere ? 1 : 0) : 0) as 0 | 1 | 2
    const leaves =
      ctx.lod === 0 && !bigSphere && style !== 'willow' && style !== 'umbrella' && style !== 'sparse_high' ? { count: Math.round((4 + r * 2) * (ctx.condition === 'dry' ? 0.5 : 1)), length: r * 0.4, width: r * 0.32 } : undefined
    const o = {
      center: a.p,
      radius: r,
      squash: a.sq,
      detail,
      seed: a.tip.seed,
      base,
      crown: env.tree.crown,
      accent,
      leaves,
      swayK: 0.3,
      noise: bigSphere ? 0.015 : style === 'lumpy' || style === 'sparse_high' ? 0.2 : 0.13,
      flatBottom: style === 'umbrella' || style === 'dome' ? 0.75 : 0.5,
      ao: env.bloomOn && env.spec.bloom?.replacesLeaves ? 0.78 : style === 'dome' ? 0.45 : 0.55,
    }
    if (ctx.lod === 1 && !bigSphere && style !== 'willow') {
      // mid LOD: several small low-subdivision lumps per clump instead of one big faceted icosahedron
      const sr = new Rng(a.tip.seed ^ 0x2545f491)
      const subs = 3
      for (let k = 0; k < subs; k++) {
        const ang = (k / subs) * TAU + sr.range(0, 1)
        const off = r * 0.5
        const sub = { ...o, radius: r * 0.64, seed: a.tip.seed + k * 977, center: [a.p[0] + Math.cos(ang) * off, a.p[1] + r * a.sq * sr.range(0, 0.35), a.p[2] + Math.sin(ang) * off] as Vec3 }
        clump(ctx.foliage, sub)
      }
    } else {
      clump(ctx.foliage, o)
    }
    if (ctx.lod === 0) clumpLeaves(ctx.foliage, o)
    groups.push({ p: a.p, r, sq: a.sq })
    if (style === 'sparse_high' && a.tip.p[0] === 0 && a.tip.p[1] === 0 && ctx.lod < 2) {
      // twig linking a free clump to the trunk
      const tp = env.tree.trunk.pts
      let q = tp[tp.length - 1]
      for (const pt of tp) if (pt[1] >= a.p[1] - r * 1.4) { q = pt; break }
      const mid: Vec3 = [(q[0] + a.p[0]) / 2, (q[1] + a.p[1]) / 2 - r * 0.2 + 0.15, (q[2] + a.p[2]) / 2]
      const end: Vec3 = [a.p[0], a.p[1] - r * a.sq * 0.4, a.p[2]]
      tube(ctx.wood, catmull([q, mid, end], 2), { sides: 4, radii: [0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.012].slice(0, 5), color: barkColor(env.bark, 1), sway: (t) => 0.1 + 0.3 * t, end: 'point' })
    }
  }
  if (style === 'willow' && ctx.lod < 3) {
    const base = env.colorFor(env.vis[0] ?? fakeTip(rng)).base
    hangStrips(env, rng, base, { perBranch: 7, minLen: 1.2, maxLen: 9, toGround: true, width: env.R * 0.07, light: [0.78, 0.84, 0.4] })
  } else if (style === 'sparse_high') {
    const base = env.colorFor(env.vis[0] ?? fakeTip(rng)).base
    hangStrips(env, rng, base, { perBranch: 2, minLen: env.H * 0.07, maxLen: env.H * 0.13, toGround: false, width: env.R * 0.06, light: [0.7, 0.78, 0.55] })
  }
  void mul
  return groups
}
