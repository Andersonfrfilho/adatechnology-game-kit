import type { Lod, Vec3 } from '../types'
import { add, frameFromAxis, mul, norm, TAU, toWorld, dirToWorld, type Frame, lerp } from '../math'
import { shade, lighten, mix, jitter } from '../color'
import type { Rng } from '../rng'
import type { MeshBuilder } from './builder'
import { leaf } from './leaf'
import { icoShell } from './shell'
import { tube } from './tube'

/** Small flat flower (default 5 petals) lying on a surface, normal pointing out. */
export function blossom(b: MeshBuilder, center: Vec3, normal: Vec3, size: number, color: Vec3, heart: Vec3, sway: number, petals = 5, twist = 0): void {
  const f = frameFromAxis(center, normal, twist)
  const peak = toWorld(f, [0, size * 0.3, 0])
  for (let i = 0; i < petals; i++) {
    const a0 = (i / petals) * TAU
    const a1 = ((i + 1) / petals) * TAU
    const am = (a0 + a1) / 2
    const p0 = toWorld(f, [Math.cos(a0) * size * 0.75, 0, Math.sin(a0) * size * 0.75])
    const p1 = toWorld(f, [Math.cos(a1) * size * 0.75, 0, Math.sin(a1) * size * 0.75])
    const pm = toWorld(f, [Math.cos(am) * size * 1.1, size * 0.08, Math.sin(am) * size * 1.1])
    const c = i % 2 ? shade(color, 0.93) : color
    b.flatTri(peak, p0, pm, heart, c, lighten(c, 0.4), sway, sway, sway, normal)
    b.flatTri(peak, pm, p1, heart, lighten(c, 0.4), c, sway, sway, sway, normal)
  }
}

export type FlowerKind = 'daisy' | 'sunflower' | 'rose' | 'tulip' | 'hibiscus' | 'cluster' | 'lily' | 'bird_of_paradise' | 'trumpet' | 'passion' | 'bract' | 'bell' | 'pompom' | 'florets'

export interface HeadOptions {
  kind: FlowerKind
  center: Vec3
  /** direction the flower faces (stem tip direction) */
  axis: Vec3
  /** head radius in meters */
  size: number
  colors: Vec3[]
  centerColor: Vec3
  rng: Rng
  lod: Lod
  sway: number
  twist?: number
}

interface PetalOpts {
  angle: number
  r0: number
  elev: number
  length: number
  width: number
  c0: Vec3
  c1: Vec3
  curl: number
  rows?: number
  face?: 'axis' | 'radial'
  fold?: number
  peak?: number
  round?: number
  swayK: number
}

function petal(b: MeshBuilder, f: Frame, o: PetalOpts): void {
  const ca = Math.cos(o.angle)
  const sa = Math.sin(o.angle)
  const ce = Math.cos(o.elev)
  const se = Math.sin(o.elev)
  const baseL: Vec3 = [ca * o.r0, 0, sa * o.r0]
  const dirL: Vec3 = [ca * ce, se, sa * ce]
  const faceL: Vec3 = o.face === 'radial' ? [ca, 0, sa] : [0, 1, 0]
  leaf(b, toWorld(f, baseL), dirToWorld(f, dirL), dirToWorld(f, faceL), o.length, o.width, o.c0, o.c1, {
    rows: o.rows ?? 2,
    curl: o.curl,
    fold: o.fold ?? 0.25,
    swayBase: o.swayK,
    swayTip: o.swayK,
    peak: o.peak ?? 0.55,
    round: o.round ?? 0.8,
    edge: 0.96,
  })
}

function dome(b: MeshBuilder, f: Frame, radius: number, height: number, c0: Vec3, c1: Vec3, sway: number, detail: 0 | 1 = 0): void {
  icoShell(b, {
    center: f.o,
    frame: f,
    radii: [radius, height, radius],
    detail,
    noise: 0,
    color: (v) => mix(c0, c1, Math.max(0, v.h - 0.2) * 1.2),
    sway: () => sway,
  })
}

/** A flower head built from folded petals (no flat cards). Sizes are in meters. */
export function flowerHead(b: MeshBuilder, o: HeadOptions): void {
  const f = frameFromAxis(o.center, o.axis, o.twist ?? o.rng.range(0, TAU))
  const s = o.size
  const rng = o.rng
  const col = (i: number): Vec3 => o.colors[i % o.colors.length]
  const sw = o.sway
  const heart = o.centerColor
  if (o.lod === 2 && o.kind !== 'cluster' && o.kind !== 'bird_of_paradise') {
    blossom(b, o.center, o.axis, s * 1.2, col(0), heart, sw, 4, o.twist ?? 0)
    return
  }
  switch (o.kind) {
    case 'daisy': {
      const n = o.lod === 0 ? 12 : o.lod === 1 ? 8 : 5
      for (let i = 0; i < n; i++) {
        const c = jitter(col(i), rng, 0.005, 0.03, 0.02)
        petal(b, f, { angle: (i / n) * TAU + rng.range(-0.05, 0.05), r0: s * 0.18, elev: 0.12 + rng.range(-0.05, 0.08), length: s * 0.95, width: s * 0.42 * (12 / n) ** 0.5, c0: shade(c, 0.88), c1: lighten(c, 0.2), curl: -0.08, swayK: sw })
      }
      dome(b, f, s * 0.3, s * 0.2, shade(heart, 0.75), lighten(heart, 0.5), sw)
      break
    }
    case 'sunflower': {
      const n = o.lod === 0 ? 14 : o.lod === 1 ? 10 : 6
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < n; i++) {
          const c = jitter(col(i), rng, 0.006, 0.04, 0.03)
          petal(b, f, { angle: ((i + layer * 0.5) / n) * TAU, r0: s * 0.5, elev: layer ? 0.02 : 0.2, length: s * 0.62, width: s * 0.3, c0: shade(c, 0.85), c1: lighten(c, 0.18), curl: -0.1 + layer * 0.12, swayK: sw, peak: 0.45 })
        }
        if (o.lod > 0) break
      }
      dome(b, f, s * 0.58, s * 0.2, shade(heart, 0.6), shade(mix(heart, [0.55, 0.38, 0.12], 0.5), 1.2), sw, o.lod === 0 ? 1 : 0)
      break
    }
    case 'rose': {
      const layers = o.lod === 0 ? [{ n: 5, r: 0.55, e: 0.5, k: 1 }, { n: 5, r: 0.38, e: 0.85, k: 0.82 }, { n: 4, r: 0.22, e: 1.15, k: 0.62 }, { n: 3, r: 0.1, e: 1.4, k: 0.42 }] : [{ n: 5, r: 0.5, e: 0.7, k: 1 }, { n: 4, r: 0.25, e: 1.2, k: 0.6 }]
      layers.forEach((L, li) => {
        for (let i = 0; i < L.n; i++) {
          const base = col(i)
          const c = jitter(base, rng, 0.004, 0.03, 0.02)
          petal(b, f, { angle: (i / L.n) * TAU + li * 0.9 + rng.range(-0.1, 0.1), r0: s * L.r * 0.5, elev: L.e, length: s * (0.75 + L.r * 0.5), width: s * (0.85 - li * 0.1), c0: shade(c, 0.5 * L.k + 0.35), c1: lighten(shade(c, 0.95), 0.3), curl: 0.12, face: 'radial', swayK: sw, peak: 0.6, rows: 2, fold: 0.1 })
        }
      })
      break
    }
    case 'tulip': {
      const n = o.lod === 2 ? 4 : 6
      for (let i = 0; i < n; i++) {
        const c = jitter(col(i), rng, 0.004, 0.03, 0.02)
        const inner = i % 2
        petal(b, f, { angle: (i / n) * TAU + (inner ? 0.5 : 0), r0: s * (inner ? 0.2 : 0.35), elev: inner ? 1.35 : 1.15, length: s * (inner ? 1.7 : 1.9), width: s * 1.05, c0: shade(c, 0.78), c1: lighten(c, 0.22), curl: 0.28, face: 'radial', rows: o.lod === 0 ? 3 : 2, swayK: sw, peak: 0.45 })
      }
      break
    }
    case 'hibiscus': {
      const n = 5
      for (let i = 0; i < n; i++) {
        const c = jitter(col(i), rng, 0.004, 0.03, 0.02)
        petal(b, f, { angle: (i / n) * TAU + rng.range(-0.08, 0.08), r0: s * 0.04, elev: 0.5, length: s * 1.2, width: s * 1.15, c0: shade(mix(c, [0.35, 0.02, 0.05], 0.7), 0.9), c1: lighten(c, 0.2), curl: -0.05, rows: o.lod === 0 ? 3 : 2, swayK: sw, peak: 0.55, round: 0.6, fold: 0.15 })
      }
      if (o.lod < 2) {
        const tip = toWorld(f, [0, s * 1.0, 0])
        tube(b, [f.o, add(f.o, mul(f.y, s * 0.5)), tip], { sides: 3, radii: [s * 0.05, s * 0.04, s * 0.03], color: () => [0.95, 0.75, 0.3], sway: () => sw, end: 'none' })
        if (o.lod === 0) {
          dome(b, { ...f, o: tip }, s * 0.14, s * 0.08, [0.95, 0.78, 0.2], [1, 0.9, 0.4], sw)
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU
            dome(b, { ...f, o: toWorld(f, [Math.cos(a) * s * 0.2, s * 0.85, Math.sin(a) * s * 0.2]) }, s * 0.06, s * 0.05, [0.95, 0.5, 0.15], [1, 0.8, 0.3], sw)
          }
        }
      }
      break
    }
    case 'cluster': {
      const detail: 0 | 1 = o.lod === 0 ? 1 : 0
      icoShell(b, {
        center: o.center,
        radii: [s, s * 0.85, s],
        detail,
        rng,
        noise: 0.12,
        color: (v) => {
          const h = (Math.sin(v.p[0] * 131 + v.p[1] * 71 + v.p[2] * 97) + 1) / 2
          const c = mix(col(0), col(1 % o.colors.length), h)
          return shade(c, lerp(0.7, 1.1, v.h))
        },
        sway: () => sw,
      })
      break
    }
    case 'lily': {
      const n = 6
      for (let i = 0; i < n; i++) {
        const c = jitter(col(i), rng, 0.004, 0.03, 0.02)
        petal(b, f, { angle: (i / n) * TAU + (i % 2 ? 0.2 : 0), r0: s * 0.06, elev: 0.55, length: s * 1.25, width: s * 0.55, c0: shade(mix(c, [0.2, 0.4, 0.1], 0.35), 0.85), c1: lighten(c, 0.2), curl: -0.28, rows: o.lod === 0 ? 3 : 2, swayK: sw, peak: 0.5, fold: 0.3 })
      }
      if (o.lod === 0) {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + 0.4
          const p1 = toWorld(f, [Math.cos(a) * s * 0.25, s * 0.55, Math.sin(a) * s * 0.25])
          tube(b, [f.o, p1], { sides: 3, radii: [s * 0.02, s * 0.015], color: () => [0.9, 0.9, 0.7], sway: () => sw, end: 'none' })
          dome(b, { ...f, o: p1 }, s * 0.06, s * 0.04, [0.8, 0.35, 0.1], [0.95, 0.55, 0.15], sw)
        }
      }
      break
    }
    case 'bird_of_paradise': {
      const green: Vec3 = [0.3, 0.5, 0.25]
      const red: Vec3 = [0.7, 0.15, 0.15]
      // boat shaped bract, then the orange and blue petals standing from it
      leaf(b, o.center, norm(add(f.x, mul(f.y, 0.5))), f.y, s * 1.5, s * 0.5, shade(green, 0.7), red, { rows: 2, curl: -0.15, fold: 0.6, swayBase: sw, swayTip: sw, peak: 0.45 })
      for (let i = 0; i < (o.lod === 2 ? 2 : 3); i++) {
        const c = col(0)
        const a = (i - 1) * 0.35
        const dir = norm(add(mul(f.y, 0.75), add(mul(f.x, 0.55 + Math.abs(a) * 0.1), mul(f.z, a))))
        leaf(b, add(o.center, mul(f.y, s * 0.15)), dir, f.z, s * 1.2, s * 0.32, shade(c, 0.85), lighten(c, 0.2), { rows: 2, curl: 0.2, fold: 0.35, swayBase: sw, swayTip: sw, peak: 0.4 })
      }
      if (o.lod < 2) {
        const c2 = col(1 % o.colors.length)
        for (let i = 0; i < 2; i++) {
          const dir = norm(add(mul(f.y, 0.4), add(mul(f.x, 0.8), mul(f.z, i ? 0.2 : -0.2))))
          leaf(b, add(o.center, mul(f.y, s * 0.1)), dir, f.z, s * 1.1, s * 0.22, shade(c2, 0.8), c2, { rows: 2, curl: 0.1, fold: 0.35, swayBase: sw, swayTip: sw, peak: 0.4 })
        }
      }
      break
    }
    case 'trumpet': {
      const n = o.lod === 0 ? 8 : 6
      for (let i = 0; i < n; i++) {
        const c = jitter(col(i), rng, 0.004, 0.03, 0.02)
        petal(b, f, { angle: (i / n) * TAU, r0: s * 0.08, elev: 0.75, length: s * 1.3, width: s * 0.38, c0: shade(c, 0.85), c1: c, curl: -0.1, rows: 2, swayK: sw, peak: 0.45 })
      }
      dome(b, f, s * 0.2, s * 0.15, shade(heart, 0.8), heart, sw)
      break
    }
    case 'passion': {
      const n = o.lod === 0 ? 10 : 6
      for (let i = 0; i < n; i++) {
        const c = col(i % 2)
        petal(b, f, { angle: (i / n) * TAU, r0: s * 0.1, elev: 0.1, length: s * 0.95, width: s * 0.4, c0: shade(c, 0.9), c1: lighten(c, 0.1), curl: -0.05, rows: 2, swayK: sw, peak: 0.5 })
      }
      if (o.lod < 2) {
        const cor = o.colors[o.colors.length - 1]
        for (let i = 0; i < (o.lod === 0 ? 12 : 6); i++) {
          petal(b, f, { angle: (i / (o.lod === 0 ? 12 : 6)) * TAU, r0: s * 0.12, elev: 0.5, length: s * 0.45, width: s * 0.1, c0: shade(cor, 0.7), c1: lighten(cor, 0.3), curl: -0.2, rows: 2, swayK: sw })
        }
        dome(b, { ...f, o: add(f.o, mul(f.y, s * 0.25)) }, s * 0.12, s * 0.12, [0.45, 0.55, 0.2], [0.7, 0.8, 0.35], sw)
      }
      break
    }
    case 'bract': {
      // bougainvillea: three papery heart-shaped bracts around a tiny white flower
      const n = 3
      for (let i = 0; i < n; i++) {
        const c = jitter(col(i), rng, 0.008, 0.06, 0.03)
        petal(b, f, { angle: (i / n) * TAU + rng.range(0, 0.5), r0: s * 0.05, elev: 0.5, length: s * 1.1, width: s * 1.0, c0: shade(c, 0.85), c1: lighten(c, 0.2), curl: -0.1, rows: 2, swayK: sw, peak: 0.55, round: 0.6 })
      }
      break
    }
    case 'pompom': {
      // marigold: ruffled little ball, faceted, orange with yellow streaks, on a green calyx
      const c0 = col(0)
      const c1 = col(1 % o.colors.length)
      const ctr = add(o.center, mul(o.axis, s * 0.55))
      icoShell(b, {
        center: ctr,
        radii: [s, s * 0.82, s],
        detail: o.lod === 0 ? 1 : 0,
        rng,
        noise: o.lod === 0 ? 0.16 : 0.1,
        color: (v) => {
          const h = (Math.sin(v.p[0] * 311 + v.p[1] * 177 + v.p[2] * 233) + 1) / 2
          return shade(mix(c0, c1, h), lerp(0.72, 1.12, v.h))
        },
        sway: () => sw,
      })
      dome(b, { ...f, o: add(o.center, mul(o.axis, s * 0.05)) }, s * 0.5, s * 0.35, [0.2, 0.4, 0.15], [0.3, 0.5, 0.2], sw)
      break
    }
    case 'florets': {
      // hydrangea: a ball of many small four-petal florets over a dark core
      const n = o.lod === 0 ? 44 : 22
      const R = s
      const ctr = add(o.center, mul(o.axis, R * 0.75))
      icoShell(b, { center: ctr, radii: [R * 0.84, R * 0.8, R * 0.84], detail: 0, noise: 0, color: (v) => shade(mix(col(0), [0.15, 0.3, 0.2], 0.55), 0.65 + v.h * 0.3), sway: () => sw })
      const w = R * 0.34 * Math.sqrt(44 / n)
      for (let i = 0; i < n; i++) {
        const y = 1 - (i + 0.5) * (2 / n)
        const r = Math.sqrt(Math.max(0, 1 - y * y))
        const a = i * 2.399963
        const d: Vec3 = norm([Math.cos(a) * r, y, Math.sin(a) * r])
        const fr = frameFromAxis(add(ctr, mul(d, R * 0.97)), d, a)
        const c = jitter(col(i), rng, 0.01, 0.07, 0.05)
        const base = shade(c, lerp(0.7, 1.08, (y + 1) / 2))
        const tip = lighten(base, 0.35)
        const pk = toWorld(fr, [0, w * 0.35, 0])
        const ps: Vec3[] = [toWorld(fr, [w, 0, 0]), toWorld(fr, [0, 0, w]), toWorld(fr, [-w, 0, 0]), toWorld(fr, [0, 0, -w])]
        for (let k = 0; k < 4; k++) {
          const q = ps[k]
          const q2 = ps[(k + 1) % 4]
          b.flatTri(pk, q, q2, tip, base, base, sw, sw, sw, d)
          if (o.lod === 0 && k % 2 === 0) b.flatTri(q, q2, add(ctr, mul(d, R * 0.8)), shade(base, 0.7), shade(base, 0.7), shade(base, 0.6), sw, sw, sw, d)
        }
      }
      break
    }
    case 'bell': {
      // drooping bell (fuchsia / abutilon like): 5 petals hanging, narrow at the stem
      for (let i = 0; i < 5; i++) {
        const c = jitter(col(i), rng, 0.004, 0.03, 0.02)
        petal(b, f, { angle: (i / 5) * TAU, r0: s * 0.05, elev: 0.5, length: s * 1.1, width: s * 0.8, c0: shade(c, 0.8), c1: lighten(c, 0.15), curl: 0.2, rows: 2, face: 'radial', swayK: sw, peak: 0.6 })
      }
      break
    }
  }
}
