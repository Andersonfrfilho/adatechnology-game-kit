import { quat } from './math'
import type { Fragment, FractureStyle, Quat, Vec3 } from './types'

/** A fragment in the part's local space (centre, size in the fragment's own axes, orientation relative to the part). */
export interface PlannedFragment {
  center: Vec3
  size: Vec3
  q: Quat
  shape: Fragment['shape']
  /** Share of the part's mass (unnormalised). */
  weight: number
  /** Cut from inside a stack of sheets (a page of a book), not from its cover. */
  inner?: boolean
}

export interface PlanInput {
  style: FractureStyle
  /** Bounding box dimensions in part axes. */
  dims: Vec3
  thickness: number
  /** Index 0..2 of the grain axis, if any. */
  grain?: number
  /** Impact point in part space. */
  hit: Vec3
  fragmentSize: [number, number]
  maxFragments: number
  rnd: () => number
  /** Thickness of one sheet of the material (`MaterialDef.sheet`): a `tear` part thicker than a few sheets comes apart as loose sheets. */
  sheet?: number
  /**
   * The part broke across at this point of its long axis (part space), not everywhere at once (`sever`): two stubs either side of a band `gap`
   * wide that comes apart in splinters. Used by `splinter` (a board, a batten, a beam).
   */
  cut?: { at: number; gap: number }
}

interface Box {
  c: Vec3
  s: Vec3
}

/** Split a box into `count` pieces by cutting the largest piece along its longest allowed axis. */
const bsp = (root: Box, count: number, axes: number[], rnd: () => number): Box[] => {
  const pieces: Box[] = [root]
  const vol = (b: Box) => axes.reduce((v, a) => v * b.s[a], 1)
  while (pieces.length < count) {
    let bi = 0
    for (let i = 1; i < pieces.length; i++) if (vol(pieces[i]) > vol(pieces[bi])) bi = i
    const b = pieces[bi]
    let ax = axes[0]
    for (const a of axes) if (b.s[a] > b.s[ax]) ax = a
    if (b.s[ax] < 1e-4) break
    const r = 0.3 + 0.4 * rnd()
    const l1 = b.s[ax] * r
    const l2 = b.s[ax] - l1
    const c1: Vec3 = [b.c[0], b.c[1], b.c[2]]
    const c2: Vec3 = [b.c[0], b.c[1], b.c[2]]
    c1[ax] = b.c[ax] - b.s[ax] / 2 + l1 / 2
    c2[ax] = b.c[ax] + b.s[ax] / 2 - l2 / 2
    const s1: Vec3 = [b.s[0], b.s[1], b.s[2]]
    const s2: Vec3 = [b.s[0], b.s[1], b.s[2]]
    s1[ax] = l1
    s2[ax] = l2
    pieces[bi] = { c: c1, s: s1 }
    pieces.push({ c: c2, s: s2 })
  }
  return pieces
}

const parity = (p: [number, number, number]): number => {
  let inv = 0
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (p[i] > p[j]) inv++
  return inv % 2 === 0 ? 1 : -1
}

/** Orientation whose x, y, z axes are the part axes `ax`, `ay`, `az`, then rotated by `angle` around its own z. */
const frame = (ax: number, ay: number, az: number, angle = 0): Quat => {
  const e = (i: number): Vec3 => [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0]
  const z = e(az)
  const sg = parity([ax, ay, az])
  const q = quat.fromColumns(e(ax), e(ay), [z[0] * sg, z[1] * sg, z[2] * sg])
  return angle === 0 ? q : quat.mul(q, quat.fromAxisAngle([0, 0, 1], angle))
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/** Long splinters along the grain (`grain`, default the longest axis) out of `box`. */
const splinterBox = (inp: PlanInput, box: Box, limit = inp.maxFragments): PlannedFragment[] => {
  const { rnd } = inp
  const dims = box.s
  const [fmin, fmax] = inp.fragmentSize
  const g = inp.grain ?? [0, 1, 2].sort((a, b) => dims[b] - dims[a])[0]
  const [a, b] = [0, 1, 2].filter((i) => i !== g)
  const w = Math.max(fmin * 1.5, 0.01)
  const c = clamp(Math.round((dims[a] * dims[b]) / (w * w)), 3, Math.max(3, Math.floor(limit / 2)))
  const maxLen = fmax * 4
  const cells = bsp(box, c, [a, b], rnd)
  const pieces: Box[] = []
  for (const cell of cells) {
    const extra = rnd() < 0.4 ? 1 : 0
    const k = Math.max(1, Math.ceil(dims[g] / maxLen)) + extra
    for (const p of bsp(cell, k, [g], rnd)) pieces.push(p)
  }
  return pieces.slice(0, limit).map((p) => ({ center: p.c, size: [p.s[g], p.s[a], p.s[b]] as Vec3, q: frame(g, a, b), shape: 'splinter' as const, weight: p.s[0] * p.s[1] * p.s[2] }))
}

/** Broken across at `at` along the longest axis: a stub each side and splinters (lumps for `snap`) out of the band `gap` wide between them. */
const severAt = (inp: PlanInput, root: Box, at: number, gap: number): PlannedFragment[] => {
  const dims = root.s
  const L = [0, 1, 2].sort((x, y) => dims[y] - dims[x])[0]
  const half = dims[L] / 2
  const lo = clamp(at - gap / 2, -half, half), hi = clamp(at + gap / 2, -half, half)
  const out: PlannedFragment[] = []
  const stub = (from: number, to: number) => {
    if (to - from < 0.02) return
    const c: Vec3 = [root.c[0], root.c[1], root.c[2]], sz: Vec3 = [dims[0], dims[1], dims[2]]
    c[L] = (from + to) / 2
    sz[L] = to - from
    out.push({ center: c, size: sz, q: quat.identity(), shape: 'slab', weight: sz[0] * sz[1] * sz[2] })
  }
  stub(-half, lo)
  stub(hi, half)
  const band: Box = { c: [root.c[0], root.c[1], root.c[2]], s: [dims[0], dims[1], dims[2]] }
  band.c[L] = (lo + hi) / 2
  band.s[L] = Math.max(hi - lo, 0.01)
  // a snapping board (MDF, plastic) crumbles in the band; the splinters of a splintering one lie along the grain when it runs across the cut,
  // else they are short slivers of the band
  if (inp.style === 'snap') {
    for (const b of bsp(band, Math.max(3, Math.min(6, inp.maxFragments - out.length)), [0, 1, 2], inp.rnd)) out.push({ center: b.c, size: b.s, q: quat.identity(), shape: 'chunk', weight: b.s[0] * b.s[1] * b.s[2] })
  } else for (const p of splinterBox(inp, band, Math.max(3, inp.maxFragments - out.length))) out.push(p)
  return out
}

/** Leaves of a stack torn apart (a book, a ream): `layers` of thin scraps through the thickness, a little askew; one scrap in four is cover, the rest pages. */
const tearStack = (inp: PlanInput, root: Box, t: number, u: number, v: number, n: number, sheet: number): PlannedFragment[] => {
  const { dims, rnd, maxFragments } = inp
  const layers = clamp(Math.ceil(dims[t] / STACK_LAYER), 2, 4)
  const per = clamp(n, 3, Math.max(3, Math.floor(maxFragments / layers)))
  const out: PlannedFragment[] = []
  for (let k = 0; k < layers; k++) {
    const off = -dims[t] / 2 + ((k + 0.5) * dims[t]) / layers
    for (const b of bsp(root, per, [u, v], rnd)) {
      if (out.length >= maxFragments) return out
      const c: Vec3 = [b.c[0], b.c[1], b.c[2]]
      c[t] = off
      out.push({ center: c, size: [b.s[u], b.s[v], sheet], q: frame(u, v, t, (rnd() - 0.5) * 0.8), shape: 'scrap', weight: b.s[u] * b.s[v], inner: out.length % 4 !== 0 })
    }
  }
  return out
}

/** Metres of a stack of sheets that one layer of scraps stands for. */
const STACK_LAYER = 0.012

/** Deterministic fragment layout for a failed part, in part space. */
export const planFragments = (inp: PlanInput): PlannedFragment[] => {
  const { style, dims, rnd, maxFragments } = inp
  const [fmin, fmax] = inp.fragmentSize
  const mean = (fmin + fmax) / 2
  const root: Box = { c: [0, 0, 0], s: [dims[0], dims[1], dims[2]] }
  const idq = quat.identity()
  const out: PlannedFragment[] = []
  const sorted = [0, 1, 2].sort((a, b) => dims[a] - dims[b])
  const t = sorted[0]
  const [u, v] = [sorted[1], sorted[2]].sort((a, b) => a - b)

  if (style === 'snap') {
    if (inp.cut) return severAt(inp, root, inp.cut.at, inp.cut.gap)
    const n = Math.min(maxFragments, 2 + Math.floor(rnd() * 3))
    for (const b of bsp(root, n, [0, 1, 2], rnd)) out.push({ center: b.c, size: b.s, q: idq, shape: 'slab', weight: b.s[0] * b.s[1] * b.s[2] })
    return out
  }
  if (style === 'crumble' || style === 'none') {
    const n = clamp(Math.ceil((dims[0] * dims[1] * dims[2]) / (mean * mean * mean)), 4, maxFragments)
    for (const b of bsp(root, n, [0, 1, 2], rnd)) out.push({ center: b.c, size: b.s, q: idq, shape: 'chunk', weight: b.s[0] * b.s[1] * b.s[2] })
    return out
  }
  if (style === 'splinter') {
    if (inp.cut) return severAt(inp, root, inp.cut.at, inp.cut.gap)
    for (const p of splinterBox(inp, root)) out.push(p)
    return out
  }
  if (style === 'tear') {
    const n = clamp(Math.round((dims[u] * dims[v]) / (mean * mean)), 3, maxFragments)
    const sheet = inp.sheet ?? 0
    if (sheet > 0 && dims[t] > sheet * 4) return tearStack(inp, root, t, u, v, n, sheet)
    const th = Math.min(inp.thickness, dims[t])
    for (const b of bsp(root, n, [u, v], rnd)) {
      out.push({ center: [b.c[0], b.c[1], b.c[2]], size: [b.s[u], b.s[v], th], q: frame(u, v, t), shape: 'scrap', weight: b.s[u] * b.s[v] })
    }
    return out
  }
  // shatter: thin shards radiating from the impact
  const th = Math.min(inp.thickness, dims[t])
  const Hu = dims[u] / 2, Hv = dims[v] / 2
  const hu = clamp(inp.hit[u], -Hu * 0.95, Hu * 0.95)
  const hv = clamp(inp.hit[v], -Hv * 0.95, Hv * 0.95)
  const R = Math.max(Math.hypot(Hu + Math.abs(hu), Hv + Math.abs(hv)), 0.02)
  const n = clamp(Math.round((dims[u] * dims[v]) / (mean * mean)), 6, maxFragments)
  const sectors = clamp(Math.round(Math.sqrt(n * 1.6)), 5, 10)
  const rings = Math.max(1, Math.ceil(n / sectors))
  const radii: number[] = []
  for (let k = 0; k <= rings; k++) radii.push(R * Math.pow(k / rings, 1.3))
  const cap = fmax * 1.5
  for (let j = 0; j < sectors && out.length < maxFragments; j++) {
    const theta = (j + (rnd() - 0.5) * 0.4) * ((Math.PI * 2) / sectors)
    for (let k = 0; k < rings && out.length < maxFragments; k++) {
      const rm = (radii[k] + radii[k + 1]) / 2
      const cu = hu + rm * Math.cos(theta)
      const cv = hv + rm * Math.sin(theta)
      if (Math.abs(cu) > Hu + 0.01 || Math.abs(cv) > Hv + 0.01) continue
      const radial = clamp(radii[k + 1] - radii[k], 0.01, cap)
      const tang = clamp(radii[k + 1] * ((Math.PI * 2) / sectors) * 0.9, 0.01, cap)
      const c: Vec3 = [0, 0, 0]
      c[u] = clamp(cu, -Hu * 0.98, Hu * 0.98)
      c[v] = clamp(cv, -Hv * 0.98, Hv * 0.98)
      c[t] = 0
      out.push({ center: c, size: [radial, tang, th], q: frame(u, v, t, theta), shape: 'shard', weight: radial * tang })
    }
  }
  if (out.length === 0) out.push({ center: [0, 0, 0], size: [dims[u], dims[v], th], q: frame(u, v, t), shape: 'shard', weight: 1 })
  return out
}
