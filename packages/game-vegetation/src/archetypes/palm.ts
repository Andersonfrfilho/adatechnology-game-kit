import type { PalmSpec, Vec3 } from '../types'
import type { ArchResult, Ctx } from '../ctx'
import { TAU, add, catmull, dirFromAngles, lerp, mul, norm } from '../math'
import { jitter, mix, rgb, shade, tintGreen, lighten } from '../color'
import { tube } from '../geometry/tube'
import { pinnateFrond } from '../geometry/fronds'
import { leaf } from '../geometry/leaf'
import { icoShell } from '../geometry/shell'

interface Defaults {
  height: number
  trunkRadius: number
  frondCount: number
  frondLength: number
  leaf: number
  trunk: number
  lean: number
}
const DEF: Record<NonNullable<PalmSpec['variant']>, Defaults> = {
  coconut: { height: 7, trunkRadius: 0.17, frondCount: 18, frondLength: 2.7, leaf: 0x4e9a3c, trunk: 0xa08a68, lean: 0.2 },
  royal: { height: 11, trunkRadius: 0.27, frondCount: 13, frondLength: 3.8, leaf: 0x4a9a3c, trunk: 0xbab4a4, lean: 0.01 },
  fan: { height: 3.2, trunkRadius: 0.2, frondCount: 16, frondLength: 1.5, leaf: 0x5a9a44, trunk: 0x7a5c3c, lean: 0.03 },
  areca: { height: 2.6, trunkRadius: 0.03, frondCount: 5, frondLength: 1.5, leaf: 0x78ae3e, trunk: 0x9aa860, lean: 0.25 },
  date: { height: 6, trunkRadius: 0.24, frondCount: 20, frondLength: 3, leaf: 0x6a9a58, trunk: 0x8a6a48, lean: 0.05 },
}

export function generatePalm(spec: PalmSpec, ctx: Ctx): ArchResult {
  const variant = spec.variant ?? 'coconut'
  const d = DEF[variant]
  const rng = ctx.rng
  const dead = ctx.condition === 'dead'
  const dry = ctx.condition === 'dry'
  const over = ctx.condition === 'overgrown'
  const H = (spec.height ?? d.height) * (over ? 1.08 : 1)
  const R = spec.trunkRadius ?? d.trunkRadius
  const trunkC = rgb(spec.trunkColor ?? d.trunk)
  const leafBase = tintGreen(rgb(spec.leafColor ?? d.leaf), ctx.condition)
  const lean = (spec.lean ?? d.lean) * (dead ? 1.4 : 1)
  const stems = variant === 'areca' || (variant === 'fan' && (spec.stems ?? 1) > 1) ? (spec.stems ?? 6) : 1
  const clump = stems > 1
  const frondN = Math.round((spec.frondCount ?? d.frondCount) * (dead ? 0.5 : dry ? 0.75 : over ? 1.2 : 1))
  const frondL = (spec.frondLength ?? d.frondLength) * (over ? 1.1 : 1)
  const c0 = shade(leafBase, 0.62)
  const c1 = mix(shade(leafBase, 1.12), [0.7, 0.85, 0.35], 0.12)
  const deadC = [0.45, 0.36, 0.22] as Vec3
  const crowns: { p: Vec3; r: number }[] = []

  const buildStem = (si: number, stemH: number, stemR: number, stemLean: number, az: number): void => {
    const trunkId = si === 0 ? 'trunk' : `stem${si}`
    ctx.piece(trunkId, si === 0 ? 'trunk' : 'stem')
    const srng = rng.fork(si * 101 + 7)
    const nPts = Math.max(4, Math.round(stemH / (clump ? 0.35 : 0.2)))
    const ctrl: Vec3[] = []
    const wob = srng.range(0, TAU)
    for (let i = 0; i <= 4; i++) {
      const t = i / 4
      const off = stemLean * stemH * (variant === 'coconut' ? 0.35 * t + 0.65 * t * t : t * t) + Math.sin(t * 3 + wob) * (variant === 'coconut' ? 0.045 : 0.02) * stemH
      ctrl.push([Math.cos(az) * off, stemH * t, Math.sin(az) * off])
    }
    const full = catmull(ctrl, Math.max(1, Math.round(nPts / 4)))
    const stride = ctx.pick(1, 2, Math.max(1, Math.floor(full.length / 3)))
    const path: Vec3[] = []
    for (let i = 0; i < full.length; i += stride) path.push(full[i])
    if ((full.length - 1) % stride !== 0) path.push(full[full.length - 1])
    const scars = variant === 'areca' ? 4 : variant === 'royal' ? 2.5 : 3.2
    const radii = path.map((_, i) => {
      const t = i / (path.length - 1)
      let r = stemR * (variant === 'royal' ? 1.02 + 0.18 * Math.sin(Math.min(1, t * 1.4) * Math.PI) - 0.28 * t : 1.0 - 0.22 * t)
      r *= 1 + 0.5 * Math.exp(-t * (variant === 'royal' ? 16 : 22))
      const ringPhase = Math.cos(t * stemH * scars * TAU)
      r *= 1 + (ctx.lod === 0 ? 0.045 : 0.02) * ringPhase
      return r
    })
    const sides = ctx.pick(clump ? 5 : 8, clump ? 4 : 6, 4)
    tube(ctx.wood, path, {
      sides,
      radii,
      color: (t, a) => {
        const ring = 0.84 + 0.16 * Math.cos(t * stemH * scars * TAU)
        const stripe = 0.94 + 0.06 * Math.cos(a * TAU * 3 + t * 4)
        let c = shade(trunkC, ring * stripe * (0.78 + 0.22 * Math.min(1, t * 6)))
        if (variant === 'royal') c = mix(c, [0.62, 0.62, 0.55], 0.25)
        if (dead) c = mix(c, [0.4, 0.37, 0.32], 0.5)
        return c
      },
      sway: (t) => 0.05 * t * t,
      end: 'flat',
    })
    const top = path[path.length - 1]
    let crownTop: Vec3 = top
    if (variant === 'royal') {
      // smooth green crownshaft
      const shaft: Vec3[] = [top, add(top, [0, 0.5, 0]), add(top, [0.0, 1.25, 0])]
      const shaftC = mix(leafBase, [0.55, 0.75, 0.3], 0.3)
      tube(ctx.wood, shaft, { sides: ctx.pick(7, 5, 4), radii: [stemR * 0.9, stemR * 0.95, stemR * 0.7], color: (t) => shade(shaftC, 0.8 + 0.3 * t), sway: () => 0.05, end: 'flat' })
      crownTop = add(top, [0, 1.25, 0])
    } else if (variant !== 'areca') {
      icoShell(ctx.wood, { center: add(top, [0, stemR * 0.7, 0]), radii: [stemR * 1.35, stemR * 1.0, stemR * 1.35], detail: 0, rng: srng, noise: 0.06, color: (v) => shade(mix(trunkC, [0.35, 0.45, 0.2], 0.55), 0.7 + v.h * 0.5), sway: () => 0.05 })
      crownTop = add(top, [0, stemR * 0.9, 0])
    }
    crowns.push({ p: crownTop, r: frondL })
    ctx.piece(si === 0 ? 'crown' : `crown${si}`, 'crown', trunkId)

    const n = clump ? Math.max(3, Math.round(frondN)) : frondN
    for (let i = 0; i < n; i++) {
      if (ctx.lod === 2 && variant === 'fan' && i % 2 === 1) continue
      const f = srng.fork(i)
      const ring = i % 3
      const az2 = (i / n) * TAU * 1.0 + f.range(-0.2, 0.2) + si
      let elev: number
      let droop: number
      if (variant === 'royal') {
        elev = [1.1, 0.65, 0.2][ring] + f.range(-0.1, 0.1)
        droop = [0.35, 0.65, 1.0][ring]
      } else if (variant === 'date') {
        elev = [1.15, 0.8, 0.45][ring] + f.range(-0.08, 0.08)
        droop = [0.3, 0.5, 0.75][ring]
      } else if (variant === 'areca') {
        elev = [1.1, 0.8, 0.5][ring] + f.range(-0.1, 0.1)
        droop = [0.45, 0.8, 1.1][ring]
      } else if (variant === 'fan') {
        elev = [1.3, 0.95, 0.6][ring] + f.range(-0.1, 0.1)
        droop = [0.25, 0.35, 0.5][ring]
      } else {
        elev = [1.15, 0.75, 0.38][ring] + f.range(-0.1, 0.1)
        droop = [0.45, 0.78, 1.1][ring]
      }
      if (dead) {
        elev = elev * 0.4 - 0.3
        droop *= 1.4
      }
      if (dry) droop *= 1.15
      const len = frondL * f.range(0.85, 1.1) * (ring === 2 ? 0.92 : 1)
      const colA = dead ? mix(c0, deadC, 0.8) : c0
      const colB = dead ? mix(c1, deadC, 0.7) : ring === 2 && dry ? mix(c1, deadC, 0.4) : c1
      if (variant === 'fan') {
        fanFrond(ctx, f, crownTop, az2, elev, len, droop, colA, colB)
      } else {
        pinnateFrond(ctx.foliage, {
          origin: crownTop,
          az: az2,
          elev,
          length: len,
          droop,
          leafletLen: variant === 'areca' ? 0.24 : variant === 'date' ? 0.2 : variant === 'coconut' ? 0.25 : 0.24,
          pairs: variant === 'areca' ? 10 : variant === 'royal' ? 26 : variant === 'coconut' ? 28 : 18,
          c0: colA,
          c1: colB,
          lod: ctx.lod,
          rng: f,
          swayBase: 0.25,
          swayTip: 1,
          hang: variant === 'date' ? 0.2 : variant === 'royal' ? 0.5 : variant === 'coconut' ? 0.8 : 0.45,
          leafletWidth: variant === 'date' ? 0.12 : variant === 'coconut' ? 0.13 : 0.2,
        })
      }
    }
    // fruit cluster
    if (spec.fruit && !dead && ctx.lod < 2) {
      const fc = rgb(spec.fruit.color)
      const fr = spec.fruit.radius ?? (variant === 'coconut' ? 0.1 : 0.03)
      const count = Math.round(spec.fruit.count * (ctx.lod === 0 ? 1 : 0.5))
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + srng.range(0, 1)
        const rr = stemR * 1.3 + fr * 0.8
        const p: Vec3 = [crownTop[0] + Math.cos(a) * rr, crownTop[1] - fr * (0.6 + srng.range(0, 1.4)) - 0.05, crownTop[2] + Math.sin(a) * rr]
        ctx.fruitItem(() => icoShell(ctx.fruit, { center: p, radii: [fr, fr * 1.15, fr], detail: 0, rng: srng, noise: 0.04, color: (v) => mix(shade(fc, 0.6), lighten(fc, 0.3), v.h), sway: () => 0.1 }))
      }
    }
  }

  if (!clump) {
    buildStem(0, H, R, lean, rng.range(0, TAU))
  } else {
    for (let i = 0; i < stems; i++) {
      const az = (i / stems) * TAU + rng.range(-0.4, 0.4)
      const hh = H * rng.range(0.62, 1.0)
      buildStem(i, hh, R * rng.range(0.85, 1.1), (spec.lean ?? d.lean) * rng.range(0.6, 1.3), az)
    }
  }
  const maxR = crowns.reduce((m, c) => Math.max(m, Math.hypot(c.p[0], c.p[2])), 0)
  return clump
    ? { collider: { kind: 'cylinder', radius: Math.max(0.15, maxR * 0.5 + R * 2), height: H * 0.5 }, bendable: true }
    : { collider: { kind: 'cylinder', radius: R * 1.15, height: H * 0.85 }, bendable: false }
}

/** Palmate frond: long petiole ending in a round, ribbed fan of folded segments whose tips droop. */
function fanFrond(ctx: Ctx, rng: import('../rng').Rng, origin: Vec3, az: number, elev: number, len: number, droop: number, c0: Vec3, c1: Vec3): void {
  const horiz = dirFromAngles(az, 0)
  const petL = len * 0.82
  const pe = Math.max(0.15, elev)
  const tipPet: Vec3 = [origin[0] + horiz[0] * petL * Math.cos(pe) * 0.8, origin[1] + petL * (Math.sin(pe) * 0.9 - droop * 0.12), origin[2] + horiz[2] * petL * Math.cos(pe) * 0.8]
  const mid: Vec3 = [lerp(origin[0], tipPet[0], 0.5), lerp(origin[1], tipPet[1], 0.5) + petL * 0.06, lerp(origin[2], tipPet[2], 0.5)]
  tube(ctx.foliage, [origin, mid, tipPet], { sides: 3, radii: [len * 0.02, len * 0.015, len * 0.011], color: (t) => shade(mix(c0, [0.55, 0.5, 0.25], 0.35), 0.85 + 0.2 * t), sway: (t) => 0.1 + 0.5 * t, end: 'none' })
  const segs: number = ctx.pick(len < 1.3 ? 9 : 15, 7, 4)
  const span = 3.7
  const bR = len * 0.46
  const tilt = Math.min(1.1, pe) * 0.65
  const A: Vec3 = norm([horiz[0] * Math.cos(tilt), Math.sin(tilt) * 0.95, horiz[2] * Math.cos(tilt)])
  const B: Vec3 = [-horiz[2], 0, horiz[0]]
  for (let i = 0; i < segs; i++) {
    const u = segs === 1 ? 0 : i / (segs - 1) - 0.5
    const th = u * span
    const dir = norm(add(add(mul(A, Math.cos(th)), mul(B, Math.sin(th))), [0, 0.02 - Math.abs(u) * 0.12, 0]))
    const cc = jitter(mix(c0, c1, 0.45), rng, 0.01, 0.07, 0.05)
    const w = ((bR * (span / segs)) * 0.75) / 0.78 + 0.02
    leaf(ctx.foliage, tipPet, dir, [0, 1, 0], bR * (0.92 + 0.08 * Math.cos(th)), w, shade(cc, 0.7), lighten(c1, 0.95), { rows: ctx.pick(3, 2, 2), curl: 0.22 + Math.abs(u) * 0.14, fold: 0.5, swayBase: 0.35, swayTip: 1, peak: 0.82, round: 0.45, baseWidth: 0.04 })
  }
}
