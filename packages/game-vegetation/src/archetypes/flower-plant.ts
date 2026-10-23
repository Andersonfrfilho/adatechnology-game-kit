import type { FlowerPlantSpec, FlowerType, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { add, catmull, dirFromAngles, mul, norm, sampleLine, TAU, lerp } from '../math'
import { jitter, mix, rgb, shade, tintGreen } from '../color'
import { tube } from '../geometry/tube'
import { leaf } from '../geometry/leaf'
import { blossom, flowerHead, type FlowerKind } from '../geometry/flower'

interface TypeDef {
  height: number
  size: number
  stems: number
  colors: number[]
  center: number
  kind: FlowerKind
  leaf: { style: 'lance' | 'heart' | 'strap' | 'compound' | 'broad'; len: number; width: number; along: number; basal: number }
  woody?: boolean
  tilt?: number
}

const TYPES: Record<FlowerType, TypeDef> = {
  daisy: { height: 0.38, size: 0.05, stems: 6, colors: [0xfbfaf2], center: 0xf0b820, kind: 'daisy', leaf: { style: 'lance', len: 0.16, width: 0.05, along: 2, basal: 4 } },
  sunflower: { height: 1.7, size: 0.2, stems: 3, colors: [0xf4c21a], center: 0x4a2c14, kind: 'sunflower', leaf: { style: 'heart', len: 0.3, width: 0.24, along: 5, basal: 3 }, tilt: 0.5 },
  rose: { height: 0.85, size: 0.062, stems: 7, colors: [0xd0243a], center: 0xe8c040, kind: 'rose', leaf: { style: 'compound', len: 0.12, width: 0.07, along: 4, basal: 2 }, woody: true },
  tulip: { height: 0.42, size: 0.04, stems: 6, colors: [0xe03a52], center: 0x303030, kind: 'tulip', leaf: { style: 'strap', len: 0.3, width: 0.07, along: 0, basal: 2 } },
  hibiscus: { height: 0.9, size: 0.1, stems: 3, colors: [0xe02a3a], center: 0xe8c040, kind: 'hibiscus', leaf: { style: 'heart', len: 0.18, width: 0.12, along: 4, basal: 2 }, woody: true },
  cluster: { height: 0.8, size: 0.15, stems: 4, colors: [0x5a84d8, 0x8aa8e8], center: 0x405080, kind: 'cluster', leaf: { style: 'broad', len: 0.26, width: 0.2, along: 4, basal: 2 } },
  lily: { height: 0.85, size: 0.09, stems: 3, colors: [0xfffaf0], center: 0xe08a20, kind: 'lily', leaf: { style: 'lance', len: 0.22, width: 0.04, along: 5, basal: 2 } },
  bird_of_paradise: { height: 1.3, size: 0.14, stems: 3, colors: [0xf08a20, 0x4a5ad0], center: 0x303030, kind: 'bird_of_paradise', leaf: { style: 'broad', len: 0.55, width: 0.2, along: 0, basal: 6 } },
}

export function generateFlowerPlant(spec: FlowerPlantSpec, ctx: Ctx): ArchResult {
  const type = spec.flowerType ?? 'daisy'
  const def = TYPES[type]
  const rng = ctx.rng
  const over = ctx.condition === 'overgrown'
  const height = (spec.height ?? def.height) * (over ? 1.15 : 1)
  const stemCount = Math.round((spec.stemCount ?? def.stems) * (over ? 1.4 : 1))
  const colors = (spec.petalColors ?? def.colors).map(rgb)
  const heart = rgb(spec.centerColor ?? def.center)
  const leafBase = tintGreen(rgb(spec.leafColor ?? 0x3f8a3a), ctx.condition)
  const stemBase = tintGreen(rgb(spec.leafColor ? spec.leafColor : 0x4a8a3a), ctx.condition)
  const size = (spec.flowerSize ?? def.size) * 1.25
  const spreading = !!spec.spreading
  const bushy = !!spec.bushy || def.woody === true
  const dead = ctx.condition === 'dead'
  const dry = ctx.condition === 'dry'
  const bloomShare = dead ? 0 : (ctx.season === 'winter' ? 0.35 : 1) * (dry ? 0.5 : 1)
  const stemBuilder = def.woody ? ctx.wood : ctx.foliage
  const stemColor: Vec3 = def.woody ? mix(rgb(0x5a6a30), tintGreen(rgb(0x6b5030), ctx.condition), 0.4) : shade(stemBase, 0.9)
  const sides = ctx.pick(4, 3, 3)
  const leafRows = ctx.pick(2, 2, 2)
  const swayHead = 0.85

  const stemsData: { base: Vec3; tip: Vec3; path: Vec3[]; ang: number }[] = []
  for (let i = 0; i < stemCount; i++) {
    const ang = (i / stemCount) * TAU + rng.range(-0.4, 0.4)
    const r0 = spreading ? rng.range(0.02, 0.06) : rng.range(0.0, 0.09) * Math.sqrt(height)
    const base: Vec3 = [Math.cos(ang) * r0, 0, Math.sin(ang) * r0]
    const h = height * rng.range(0.72, 1.08)
    const lean = spreading ? height * 3.5 * rng.range(0.6, 1.2) : h * rng.range(0.08, bushy ? 0.4 : 0.22)
    const la = ang + rng.range(-0.5, 0.5)
    let tip: Vec3 = spreading ? [base[0] + Math.cos(la) * lean, h * 0.25, base[2] + Math.sin(la) * lean] : [base[0] + Math.cos(la) * lean, h, base[2] + Math.sin(la) * lean]
    if (dry) tip = [tip[0] * 1.4, tip[1] * 0.8, tip[2] * 1.4]
    if (dead) tip = [tip[0] * 2.2, tip[1] * 0.45, tip[2] * 2.2]
    const mid: Vec3 = [lerp(base[0], tip[0], 0.3), tip[1] * 0.55, lerp(base[2], tip[2], 0.3)]
    const ctrl: Vec3[] = [base, mid, tip]
    const path = catmull(ctrl, ctx.pick(3, 2, 1))
    stemsData.push({ base, tip, path, ang })
  }

  const radius = Math.max(0.004, height * 0.014) * (def.woody ? 1.2 : 1)
  for (const st of stemsData) {
    const n = st.path.length
    tube(stemBuilder, st.path, {
      sides,
      radii: st.path.map((_, k) => radius * (1 - 0.35 * (k / (n - 1)))),
      color: (t) => mix(shade(stemColor, 0.8), stemColor, t),
      sway: (t) => 0.15 + 0.8 * t * t,
      end: 'none',
      smooth: true,
    })
  }

  const leafC0 = shade(leafBase, 0.68)
  const leafC1 = mix(leafBase, [0.55, 0.75, 0.25], 0.25)
  const L = def.leaf
  const lscale = height / def.height
  const makeLeaf = (pos: Vec3, azimuth: number, elev: number, lenK: number): void => {
    const len = L.len * lscale * lenK * (over ? 1.2 : 1)
    const wid = L.width * lscale * lenK
    const dir = dirFromAngles(azimuth, elev)
    const c0 = jitter(leafC0, rng, 0.01, 0.06, 0.04)
    const c1 = jitter(leafC1, rng, 0.01, 0.06, 0.04)
    switch (L.style) {
      case 'strap':
        leaf(ctx.foliage, pos, dir, [0, 1, 0], len * 1.2, wid, c0, c1, { rows: ctx.pick(3, 2, 2), curl: 0.35, fold: 0.5, swayBase: 0.2, swayTip: 0.9, peak: 0.3, round: 1.4 })
        break
      case 'heart':
        leaf(ctx.foliage, pos, dir, [0, 1, 0], len, wid, c0, c1, { rows: leafRows, curl: 0.3, fold: 0.4, swayBase: 0.3, swayTip: 0.9, peak: 0.3, round: 0.55, baseWidth: 0.25 })
        break
      case 'broad':
        leaf(ctx.foliage, pos, dir, [0, 1, 0], len, wid, c0, c1, { rows: ctx.pick(3, 2, 2), curl: 0.25, fold: 0.5, swayBase: 0.3, swayTip: 0.9, peak: 0.45, round: 0.7 })
        break
      case 'compound': {
        const side = ctx.lod === 2 ? 0 : 2
        leaf(ctx.foliage, pos, dir, [0, 1, 0], len, wid, c0, c1, { rows: 2, curl: 0.2, fold: 0.4, swayBase: 0.3, swayTip: 0.9, peak: 0.45 })
        for (let k = 0; k < side; k++) {
          const d2 = dirFromAngles(azimuth + (k ? 0.7 : -0.7), elev * 0.8)
          leaf(ctx.foliage, add(pos, mul(dir, len * 0.4)), d2, [0, 1, 0], len * 0.8, wid * 0.9, c0, c1, { rows: 2, curl: 0.2, fold: 0.4, swayBase: 0.3, swayTip: 0.9, peak: 0.45 })
        }
        break
      }
      default:
        leaf(ctx.foliage, pos, dir, [0, 1, 0], len, wid, c0, c1, { rows: leafRows, curl: 0.25, fold: 0.5, swayBase: 0.25, swayTip: 0.9, peak: 0.4 })
    }
  }
  // basal leaves
  const basal = Math.round(L.basal * (bushy ? 1.5 : 1) * ctx.pick(1, 0.6, 0.35) * (over ? 1.4 : 1) * (dead ? 0.4 : 1))
  const basalN = spreading ? Math.round(stemCount * 2.5 * ctx.pick(1, 0.5, 0.25)) : basal * Math.max(1, Math.round(stemCount / 3))
  for (let i = 0; i < basalN; i++) {
    const a = rng.range(0, TAU)
    const rr = spreading ? rng.range(0.02, 0.5) : rng.range(0, 0.07)
    const pos: Vec3 = [Math.cos(a) * rr, 0.01, Math.sin(a) * rr]
    makeLeaf(pos, a, spreading ? rng.range(0.15, 0.5) : rng.range(0.5, 1.0), rng.range(0.7, 1.2))
  }
  // leaves along the stems
  if (L.along > 0 && !dead) {
    const per = Math.max(1, Math.round(L.along * ctx.pick(1, 0.5, 0)))
    for (const st of stemsData) {
      for (let k = 0; k < per; k++) {
        const t = lerp(0.15, 0.75, (k + rng.range(0, 0.6)) / per)
        const s = sampleLine(st.path, t)
        makeLeaf(s.p, st.ang + k * 2.4 + rng.range(-0.4, 0.4), rng.range(0.2, 0.9), lerp(1.05, 0.65, t) * rng.range(0.85, 1.15))
      }
    }
  }

  // flower heads
  const multi = colors.length > 1 && type !== 'cluster' && type !== 'bird_of_paradise'
  for (let i = 0; i < stemsData.length; i++) {
    const st = stemsData[i]
    if (rng.next() > bloomShare) {
      rng.next()
      continue
    }
    const tipDir = norm([st.tip[0] - st.path[st.path.length - 2][0], st.tip[1] - st.path[st.path.length - 2][1], st.tip[2] - st.path[st.path.length - 2][2]])
    let axis = tipDir
    if (def.tilt) axis = norm(add(tipDir, [Math.cos(st.ang) * def.tilt, -0.1, Math.sin(st.ang) * def.tilt]))
    if (type === 'tulip' || type === 'rose' || type === 'lily') axis = norm(add(axis, [0, 0.8, 0]))
    let hc = multi ? [colors[i % colors.length]] : colors
    if (dry) hc = hc.map((c) => mix(c, [0.55, 0.42, 0.25], 0.5))
    const sz = size * rng.range(0.85, 1.15)
    if (spreading) {
      blossom(ctx.flowers, add(st.tip, [0, 0.01, 0]), [0, 1, 0], sz, hc[0], heart, 0.7, 5, rng.range(0, TAU))
      for (let k = 0; k < 2; k++) {
        const s = sampleLine(st.path, rng.range(0.4, 0.95))
        blossom(ctx.flowers, add(s.p, [0, 0.01, 0]), [0, 1, 0], sz * 0.9, hc[0], heart, 0.7, 5, rng.range(0, TAU))
      }
    } else {
      flowerHead(ctx.flowers, { kind: def.kind, center: add(st.tip, mul(axis, def.kind === 'rose' ? 0 : 0.0)), axis, size: sz, colors: hc, centerColor: heart, rng: rng.fork(i), lod: ctx.lod, sway: swayHead })
    }
  }

  return { collider: null, bendable: true }
}

