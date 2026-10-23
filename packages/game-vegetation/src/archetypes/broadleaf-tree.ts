import type { BroadleafTreeSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { Rng } from '../rng'
import { add, clamp, dist, lerp, mul, norm, TAU } from '../math'
import { jitter, mix, rgb, shade } from '../color'
import { fitTree, growTree, type Tip } from '../geometry/branches'
import { drawBranch } from '../geometry/wood'
import { clump, clumpLeaves, mergeAnchors, icoShell, octa } from '../geometry/shell'
import { blossom } from '../geometry/flower'
import { leaf } from '../geometry/leaf'
import { tube } from '../geometry/tube'
import { inSeason, leafAmount, leafTint } from './shared'
import { generateDeadTree } from './dead-tree'

const DEFAULT_LEAF = [0x4d9a43, 0x5aa84a, 0x428a3e]

export function generateBroadleafTree(spec: BroadleafTreeSpec, ctx: Ctx): ArchResult {
  const height = spec.height ?? 6
  const trunkRadius = spec.trunkRadius ?? height * 0.04
  const crownRadius = spec.crownRadius ?? height * 0.42
  const shape = spec.crownShape ?? 'round'
  const bark = rgb(spec.barkColor ?? 0x8a6a4c)
  if (ctx.condition === 'dead') {
    return generateDeadTree({ archetype: 'dead_tree', height, trunkRadius, crownRadius, barkColor: spec.barkColor, branchLevels: spec.branchLevels }, ctx, true)
  }
  const trunkFraction = spec.trunkFraction ?? (shape === 'spreading' ? 0.36 : shape === 'columnar' ? 0.22 : shape === 'weeping' ? 0.3 : 0.4)
  const levels = spec.branchLevels ?? 3
  const rng = ctx.rng
  const tree = growTree(rng, {
    height,
    trunkRadius,
    crownRadius,
    shape,
    levels,
    trunkFraction,
    gnarl: spec.leafShape === 'sparse' ? 0.9 : 0.55,
    primary: shape === 'columnar' ? 5 : shape === 'spreading' ? 5 : 4,
    lean: spec.leafShape === 'sparse' ? 0.08 : 0.03,
  })
  const deciduous = spec.deciduous ?? false
  const bloom = spec.bloom
  const bloomOn = !!bloom && inSeason(ctx, bloom.seasons)
  const replaces = bloomOn && !!bloom?.replacesLeaves
  const palette = (spec.leafColor ?? DEFAULT_LEAF).map(rgb)
  const amount = leafAmount(ctx, deciduous && !replaces)
  const baseKeep = spec.density ?? 1


  // visible tips
  const keepThreshold = clamp(amount * baseKeep, 0, 1.3)
  const visible: Tip[] = tree.tips.filter((t, i) => i === 0 || t.keep < keepThreshold || t.level === 0)
  const sparse = spec.leafShape === 'sparse'
  const nT = Math.max(1, visible.length)
  const rK = clamp(2.3 / Math.sqrt(nT), 0.36, 0.8) * (sparse ? 0.62 : 1) * (spec.clipped ? 1.1 : 1)
  const grow = ctx.condition === 'overgrown' ? 1.14 : 1
  const reachK = shape === 'spreading' ? 1.08 : shape === 'columnar' ? 0.62 : 1
  fitTree(tree, height, crownRadius * reachK, crownRadius * rK * grow, height * trunkFraction * 0.95)
  // wood
  drawBranch(ctx.wood, tree.trunk, bark, ctx.lod, 0)
  for (let i = 0; i < tree.branches.length; i++) drawBranch(ctx.wood, tree.branches[i], bark, ctx.lod, i * 0.37)
  const squash = shape === 'spreading' ? 0.55 : shape === 'weeping' ? 1.35 : shape === 'columnar' ? 1.05 : 0.78
  const anchors = visible.map((t) => {
    const r = crownRadius * rK * t.size * grow
    const lift = shape === 'weeping' ? -0.1 : 0.35
    const center = add(add(t.p, mul(t.dir, r * 0.25)), [0, r * lift, 0])
    return { p: center, r, tip: t }
  })
  // inner fill clumps halfway along the main limbs so the crown reads as one mass
  if (!sparse) {
    for (let bi = 0; bi < tree.branches.length; bi++) {
      const br = tree.branches[bi]
      if (br.level !== 1) continue
      const r2 = new Rng(Math.floor(br.radii[0] * 1e6) ^ (bi * 7919))
      const mid = br.pts[Math.floor(br.pts.length * 0.55)]
      const roll = r2.next()
      if (roll > keepThreshold) continue
      const r = crownRadius * rK * 0.95 * grow
      anchors.push({ p: add(mid, [0, r * 0.35, 0]), r, tip: { p: mid, dir: [0, 1, 0], size: 1, level: 1, seed: r2.seed(), keep: roll, roll: r2.next() } })
    }
  }

  const colorFor = (tip: Tip): { base: Vec3; accent?: { color: Vec3; amount: number } } => {
    const pc = palette[Math.floor(tip.roll * palette.length) % palette.length]
    let base = leafTint(ctx, pc, deciduous, tip.roll)
    if (bloomOn && bloom) {
      const bc = rgb(bloom.colors[Math.floor(((tip.seed >>> 8) % 1000) / 1000 * bloom.colors.length)])
      const density = bloom.density ?? 0.85
      if (replaces) base = mix(bc, shade(bc, 0.8), tip.roll * 0.5)
      else return { base, accent: { color: bc, amount: density * 0.8 } }
    }
    return { base }
  }

  const crown = tree.crown
  const kGroups = ctx.pick(clamp(Math.round(anchors.length * 0.26), 5, 7), clamp(Math.round(anchors.length * 0.26), 5, 7), 6)
  const groups = (sparse && ctx.lod < 2) || anchors.length <= kGroups ? anchors.map((an) => ({ p: an.p, r: an.r, members: [an] })) : mergeAnchors(anchors, kGroups)
  for (const g of groups) {
    const t0 = g.members[0].tip
    const { base, accent } = colorFor(t0)
    const rMain = ctx.lod === 2 ? g.r : g.members.length > 1 ? g.r * 0.95 : g.r
    const leaves = ctx.lod === 0 && !sparse ? { count: Math.round((6 + rMain * 3) * (ctx.condition === 'dry' ? 0.5 : 1)), length: rMain * 0.34, width: rMain * 0.28 } : undefined
    const o = {
      center: g.p,
      radius: rMain,
      squash,
      detail: (ctx.lod === 0 ? (sparse ? 1 : 2) : ctx.lod === 1 ? 1 : 0) as 0 | 1 | 2,
      seed: t0.seed,
      base,
      crown,
      accent,
      leaves,
      swayK: 0.3,
      noise: ctx.lod === 0 ? (sparse ? 0.3 : 0.17) : 0.14,
      flatBottom: shape === 'weeping' ? 0.1 : 0.5,
      ao: 0.5,
    }
    clump(ctx.foliage, o)
    if (ctx.lod === 0) clumpLeaves(ctx.foliage, o)
    if (ctx.lod < 2 && g.members.length > 1) {
      // satellites on the members that are farthest from the group center: lumpy, layered silhouette
      const sorted = g.members.slice().sort((m1, m2) => dist(m2.p, g.p) - dist(m1.p, g.p)).slice(0, ctx.condition === 'dry' ? 1 : 2)
      for (const m of sorted) {
        const so = { ...o, center: m.p, radius: m.r * 0.78, seed: m.tip.seed, detail: (ctx.lod === 0 ? 1 : 0) as 0 | 1, leaves: ctx.lod === 0 && !sparse ? { count: 3, length: m.r * 0.3, width: m.r * 0.25 } : undefined }
        clump(ctx.foliage, so)
        if (ctx.lod === 0) clumpLeaves(ctx.foliage, so)
      }
    }
    if (ctx.condition === 'overgrown' && ctx.lod < 2) {
      const r2 = new Rng(t0.seed ^ 0x1234)
      clump(ctx.foliage, { ...o, center: add(g.p, [r2.range(-0.4, 0.4) * g.r, g.r * r2.range(0.2, 0.5), r2.range(-0.4, 0.4) * g.r]), radius: g.r * 0.7, seed: t0.seed ^ 0x77, leaves: undefined, detail: 1 })
    }
    if ((shape === 'weeping' || sparse) && ctx.lod < 2) {
      const r2 = new Rng(t0.seed ^ 0x5151)
      const n = ctx.lod === 0 ? (sparse ? 7 : 10) : sparse ? 3 : 4
      for (let i = 0; i < n; i++) {
        const ang = r2.range(0, TAU)
        const rr = g.r * r2.range(0.3, 0.95)
        const top: Vec3 = [g.p[0] + Math.cos(ang) * rr, g.p[1] - g.r * 0.2, g.p[2] + Math.sin(ang) * rr]
        const hang = g.r * r2.range(1.4, 2.4) * (sparse ? 1.3 : 1)
        const g0 = shade(base, 0.75)
        const g1 = mix(base, [0.78, 0.82, 0.4], 0.35)
        leaf(ctx.foliage, top, [0.1 * Math.cos(ang), -1, 0.1 * Math.sin(ang)], [Math.cos(ang), 0.2, Math.sin(ang)], hang, g.r * 0.3, g0, g1, { rows: 2, curl: 0.05, fold: 0.3, swayBase: 0.4, swayTip: 1, peak: 0.25 })
      }
    }
  }

  // blossoms scattered on the crown surface (LOD0 only)
  if (bloomOn && bloom && ctx.lod === 0) {
    const r2 = new Rng(Math.floor(height * 1000) + 77)
    for (const a of groups) {
      const n = replaces ? 6 : 5
      for (let i = 0; i < n; i++) {
        const ang = r2.range(0, TAU)
        const y = r2.range(0.1, 1)
        const rr = Math.sqrt(1 - y * y)
        const d: Vec3 = [Math.cos(ang) * rr, y, Math.sin(ang) * rr]
        const p: Vec3 = [a.p[0] + d[0] * a.r * 1.0, a.p[1] + d[1] * a.r * squash * 1.0, a.p[2] + d[2] * a.r * 1.0]
        const bc = rgb(r2.pick(bloom.colors))
        blossom(ctx.flowers, p, norm(d), a.r * 0.2, shade(bc, 1.05), jitter(bc, r2, 0.01, 0.05), 0.5, 4, r2.range(0, TAU))
      }
    }
  }

  // fruit
  if (spec.fruit && ctx.condition !== 'dry') {
    const f = spec.fruit
    const count = Math.round(f.count * ctx.pick(1, 0.5, 0))
    const r2 = new Rng(Math.floor(height * 733) + 5)
    const fr = f.radius ?? 0.07
    if (f.onTrunk) {
      const tpts = tree.trunk.pts
      for (let i = 0; i < count; i++) {
        const u = r2.range(0.06, 0.62)
        const idx = Math.min(tpts.length - 2, Math.floor(u * (tpts.length - 1)))
        const k = u * (tpts.length - 1) - idx
        const pos: Vec3 = [lerp(tpts[idx][0], tpts[idx + 1][0], k), lerp(tpts[idx][1], tpts[idx + 1][1], k), lerp(tpts[idx][2], tpts[idx + 1][2], k)]
        const rad = lerp(tree.trunk.radii[idx], tree.trunk.radii[idx + 1], k)
        const ang = r2.range(0, TAU)
        const c = rgb(r2.pick(f.colors))
        const out: Vec3 = [Math.cos(ang), 0, Math.sin(ang)]
        const center = add(pos, add(mul(out, rad + fr * 0.55), [0, 0, 0]))
        const rr = fr * r2.range(0.8, 1.15)
        octa(ctx.fruit, center, [rr, rr, rr], (h) => shade(c, 0.65 + h * 0.5), 0)
      }
    } else {
      for (let i = 0; i < count; i++) {
        const a = groups[i % groups.length]
        const ang = r2.range(0, TAU)
        const rr = a.r * r2.range(0.45, 0.9)
        const depth = Math.sqrt(Math.max(0, 1 - (rr / a.r) ** 2)) * 0.8
        const top: Vec3 = [a.p[0] + Math.cos(ang) * rr, a.p[1] - a.r * squash * depth * 0.9, a.p[2] + Math.sin(ang) * rr]
        const c = rgb(r2.pick(f.colors))
        const s = fr * r2.range(0.9, 1.15)
        const drop = s * 3.2
        const centre: Vec3 = [top[0], top[1] - drop - s * 0.6, top[2]]
        tube(ctx.wood, [top, [top[0], top[1] - drop * 0.8, top[2]]], { sides: 3, radii: [0.008, 0.008], color: () => [0.3, 0.4, 0.2], sway: () => 0.5, end: 'none' })
        if (s < 0.06) octa(ctx.fruit, centre, [s * 0.85, s * 1.2, s * 0.85], (h) => shade(c, 0.7 + h * 0.45), 0.4)
        else icoShell(ctx.fruit, { center: centre, radii: [s * 0.85, s * 1.2, s * 0.85], detail: 0, rng: r2, noise: 0.04, color: (v) => shade(c, 0.7 + v.h * 0.45), sway: () => 0.4 })
      }
    }
  }

  return {
    collider: { kind: 'cylinder', radius: trunkRadius * 1.1, height: height * Math.max(0.35, trunkFraction) },
    bendable: false,
  }
}
