import type { FlowerPlantSpec, FlowerType, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { add, catmull, dirFromAngles, mul, norm, sampleLine, TAU, lerp } from '../math'
import { jitter, mix, rgb, shade, tintGreen } from '../color'
import { tube } from '../geometry/tube'
import { leaf } from '../geometry/leaf'
import { blossom, flowerHead, type FlowerKind } from '../geometry/flower'
import { clump } from '../geometry/shell'

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
  /** upright, nearly vertical stems */
  straight?: boolean
  /** flower heads per stem (default 1) */
  heads?: number
  bushy?: boolean
  hmin?: number
  /** leafy mound the flowers sit on instead of free stems (radius / height as multiples of the plant height) */
  mound?: { r: number; h: number; heads: number; leaf: number }
}

const TYPES: Record<FlowerType, TypeDef> = {
  daisy: { height: 0.38, size: 0.05, stems: 6, colors: [0xfbfaf2], center: 0xf0b820, kind: 'daisy', leaf: { style: 'lance', len: 0.16, width: 0.05, along: 2, basal: 4 } },
  sunflower: { height: 1.7, size: 0.2, stems: 3, colors: [0xf4c21a], center: 0x4a2c14, kind: 'sunflower', leaf: { style: 'heart', len: 0.3, width: 0.24, along: 5, basal: 3 }, tilt: 0.5 },
  rose: { height: 0.85, size: 0.062, stems: 7, colors: [0xd0243a], center: 0xe8c040, kind: 'rose', leaf: { style: 'compound', len: 0.12, width: 0.07, along: 4, basal: 2 }, woody: true },
  tulip: { height: 0.42, size: 0.042, stems: 7, colors: [0xe03a52], center: 0x303030, kind: 'tulip', leaf: { style: 'strap', len: 0.3, width: 0.085, along: 0, basal: 3 }, straight: true },
  pompom: { height: 0.34, size: 0.019, stems: 8, colors: [0xf08a1a, 0xf5b020], center: 0x305020, kind: 'pompom', leaf: { style: 'lance', len: 0.11, width: 0.04, along: 5, basal: 3 }, bushy: true, heads: 2 },
  hydrangea: { height: 0.95, size: 0.07, stems: 5, mound: { r: 0.46, h: 0.78, heads: 5, leaf: 0.15 }, colors: [0x5a84d8, 0x8aa8e8, 0x9a90e0], center: 0x405080, kind: 'florets', leaf: { style: 'broad', len: 0.26, width: 0.19, along: 9, basal: 4 }, bushy: true },
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
  const mnd = spreading ? { r: 1.15, h: 0.62, heads: 0, leaf: 0.075 } : def.mound
  const isMound = !!mnd
  const bushy = !!spec.bushy || def.woody === true || def.bushy === true
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
    const h = height * (def.hmin ? rng.range(def.hmin, 1.0) : rng.range(0.72, 1.08))
    const lean = spreading ? height * 1.1 * rng.range(0.7, 1.25) : def.straight ? h * rng.range(0.0, 0.05) : h * rng.range(0.08, bushy ? 0.4 : 0.22)
    const la = ang + rng.range(-0.5, 0.5)
    let tip: Vec3 = spreading ? [base[0] + Math.cos(la) * lean, h * 0.5, base[2] + Math.sin(la) * lean] : [base[0] + Math.cos(la) * lean, h, base[2] + Math.sin(la) * lean]
    if (dry) tip = [tip[0] * 1.4, tip[1] * 0.8, tip[2] * 1.4]
    if (dead) tip = [tip[0] * 2.2, tip[1] * 0.45, tip[2] * 2.2]
    const mid: Vec3 = spreading ? [lerp(base[0], tip[0], 0.5), h * 1.0, lerp(base[2], tip[2], 0.5)] : [lerp(base[0], tip[0], 0.3), tip[1] * 0.55, lerp(base[2], tip[2], 0.3)]
    const ctrl: Vec3[] = [base, mid, tip]
    const path = catmull(ctrl, ctx.pick(3, 2, 1))
    stemsData.push({ base, tip, path, ang })
  }

  const moundR = height * (mnd?.r ?? 1)
  const moundH = height * (mnd?.h ?? 1)
  const mLeaf = mnd?.leaf ?? 0.08
  const mLeafC = dead ? mix(leafBase, [0.42, 0.32, 0.2], 0.8) : dry ? mix(leafBase, [0.55, 0.48, 0.22], 0.5) : leafBase
  const blobs: { c: Vec3; r: number; sq: number }[] = []
  if (isMound) {
    if (spreading) blobs.push({ c: [0, moundH * 0.42, 0], r: moundR, sq: (moundH / moundR) * 0.95 })
    else {
      // leafy bush: a ring of rounded leaf clumps around a taller one
      const nb = ctx.pick(6, 5, 4)
      for (let i = 0; i < nb; i++) {
        const a = i * 2.2 + 0.4
        const ring = i === 0 ? 0 : moundR * 0.5
        blobs.push({ c: [Math.cos(a) * ring, moundH * (i === 0 ? 0.55 : 0.28 + 0.07 * (i % 3)), Math.sin(a) * ring], r: moundR * (i === 0 ? 0.62 : 0.52), sq: 0.95 })
      }
    }
    for (const bl of blobs) clump(ctx.foliage, { center: bl.c, radius: bl.r, squash: bl.sq, detail: ctx.pick(1, 1, 0) as 0 | 1, seed: rng.seed(), base: dead ? mix(leafBase, [0.42, 0.32, 0.2], 0.7) : dry ? mix(leafBase, [0.55, 0.48, 0.22], 0.45) : mix(leafBase, [0.25, 0.55, 0.22], 0.25), swayK: 0.3, noise: 0.16, flatBottom: 0.8, ao: 0.5 })
    const nl = ctx.pick(spreading ? 60 : 66, spreading ? 26 : 30, 0)
    for (let i = 0; i < nl; i++) {
      const bl = blobs[i % blobs.length]
      const a = rng.range(0, TAU)
      const y = rng.range(0.05, 1)
      const r = Math.sqrt(1 - y * y)
      const d: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r]
      const p: Vec3 = [bl.c[0] + d[0] * bl.r * 0.92, bl.c[1] + d[1] * bl.r * bl.sq * 0.92, bl.c[2] + d[2] * bl.r * 0.92]
      const out = norm([d[0], d[1] * 0.8 + 0.3, d[2]])
      leaf(ctx.foliage, p, norm([-d[2] * 0.3 + out[0], out[1] * 0.4 + 0.2, d[0] * 0.3 + out[2]]), out, mLeaf, mLeaf * 0.68, shade(mLeafC, 0.7), mix(mLeafC, [0.6, 0.8, 0.3], dead ? 0 : 0.2), { rows: 2, curl: 0.2, fold: 0.4, swayBase: 0.2, swayTip: 0.6, peak: 0.45, round: 0.7 })
    }
  }
  const radius = isMound ? 0.0001 : Math.max(0.004, height * 0.014) * (def.woody ? 1.2 : 1)
  for (const st of isMound ? [] : stemsData) {
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
    let len = L.len * lscale * lenK * (over ? 1.2 : 1)
    let wid = L.width * lscale * lenK
    if (spreading) {
      len = 0.07 * lenK * (over ? 1.2 : 1)
      wid = 0.045 * lenK
    }
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
  const basalN = isMound ? 0 : basal * Math.max(1, Math.round(stemCount / 3))
  for (let i = 0; i < basalN; i++) {
    const a = rng.range(0, TAU)
    const rr = spreading ? rng.range(0.02, 0.5) : rng.range(0, 0.07)
    const pos: Vec3 = [Math.cos(a) * rr, 0.01, Math.sin(a) * rr]
    makeLeaf(pos, a, spreading ? rng.range(0.15, 0.5) : rng.range(0.5, 1.0), rng.range(0.7, 1.2))
  }
  // leaves along the stems
  if (L.along > 0 && !dead && !isMound) {
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
    if (def.mound) {
      // heads sitting on the leafy mound
      if (i >= def.mound.heads) continue
      const a = i * 2.4 + rng.range(-0.3, 0.3)
      const bl = blobs[i % blobs.length]
      const y = i === 0 ? 1 : rng.range(0.6, 0.95)
      const r = Math.sqrt(1 - y * y)
      const d: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r]
      const p: Vec3 = [bl.c[0] + d[0] * bl.r * 0.9, bl.c[1] + d[1] * bl.r * bl.sq * 0.95, bl.c[2] + d[2] * bl.r * 0.9]
      flowerHead(ctx.flowers, { kind: def.kind, center: p, axis: norm([d[0] * 0.5, 1, d[2] * 0.5]), size: sz * rng.range(0.9, 1.1), colors: hc, centerColor: heart, rng: rng.fork(i), lod: ctx.lod, sway: swayHead })
    } else if (spreading) {
      // five-petal flowers sitting on top of the mound
      const nb = ctx.pick(2, 1, 1) + (i % 3 === 0 ? 1 : 0)
      for (let k = 0; k < nb; k++) {
        const a = rng.range(0, TAU)
        const y = rng.range(0.35, 1)
        const r = Math.sqrt(1 - y * y)
        const d: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r]
        const p: Vec3 = [d[0] * moundR * 0.9, moundH * 0.42 + d[1] * moundH * 0.9, d[2] * moundR * 0.9]
        const nrm = norm([d[0] * 0.5, 0.9 + d[1] * 0.3, d[2] * 0.5])
        blossom(ctx.flowers, add(p, mul(nrm, 0.012)), nrm, sz * rng.range(0.85, 1.1), hc[0], heart, 0.7, ctx.pick(5, 5, 4), rng.range(0, TAU))
      }
    } else if (def.heads && def.heads > 1) {
      const nh = Math.max(1, Math.round(def.heads * ctx.pick(1, 0.7, 0.4)))
      for (let k = 0; k < nh; k++) {
        const s = sampleLine(st.path, k === 0 ? 1 : rng.range(0.55, 0.92))
        const ax = norm([Math.cos(st.ang + k) * 0.5 * (k ? 1 : 0.3), 1, Math.sin(st.ang + k) * 0.5 * (k ? 1 : 0.3)])
        flowerHead(ctx.flowers, { kind: def.kind, center: s.p, axis: ax, size: sz * (k === 0 ? 1 : 0.85), colors: hc, centerColor: heart, rng: rng.fork(i * 7 + k), lod: k === 0 ? ctx.lod : (Math.max(ctx.lod, 1) as 0 | 1 | 2), sway: swayHead })
      }
    } else {
      flowerHead(ctx.flowers, { kind: def.kind, center: add(st.tip, mul(axis, def.kind === 'rose' ? 0 : 0.0)), axis, size: sz, colors: hc, centerColor: heart, rng: rng.fork(i), lod: ctx.lod, sway: swayHead })
    }
  }

  return { collider: null, bendable: true }
}

