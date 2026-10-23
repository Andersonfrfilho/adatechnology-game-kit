import type { Vec3 } from '../types'
import { add, cross, mul, norm, perp, sub, TAU, dot } from '../math'
import type { MeshBuilder } from './builder'

export interface TubeOptions {
  sides: number
  /** radius per path point */
  radii: number[]
  /** color by position along the path (0..1) and angle fraction around (0..1) */
  color: (t: number, a: number) => Vec3
  /** wind sway by position along the path */
  sway: (t: number) => number
  /** close the far end: 'point' adds a short rounded tip, 'flat' a flat cap, 'none' leaves it open */
  end?: 'point' | 'flat' | 'none'
  /** smooth radial normals (default true) or flat faces */
  smooth?: boolean
  /** radius jitter per ring vertex for a hand-cut look, 0..0.3 */
  rough?: (ring: number, i: number) => number
}

/** Frames along a polyline by parallel transport. */
export function pathFrames(path: Vec3[]): { t: Vec3; n: Vec3; b: Vec3 }[] {
  const out: { t: Vec3; n: Vec3; b: Vec3 }[] = []
  let n: Vec3 | undefined
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)]
    const c = path[Math.min(path.length - 1, i + 1)]
    const tan = norm(sub(c, a))
    if (!n) n = perp(tan)
    else {
      // project previous normal onto the plane perpendicular to the new tangent
      n = sub(n, mul(tan, dot(n, tan)))
      n = norm(n)
    }
    out.push({ t: tan, n, b: norm(cross(tan, n)) })
  }
  return out
}

/** Tapered tube along a polyline. Returns the ring start indices so callers can attach things. */
export function tube(b: MeshBuilder, path: Vec3[], o: TubeOptions): void {
  const n = path.length
  if (n < 2) return
  const frames = pathFrames(path)
  const S = o.sides
  const smooth = o.smooth !== false
  const rings: { p: Vec3; nr: Vec3; c: Vec3 }[][] = []
  for (let k = 0; k < n; k++) {
    const f = frames[k]
    const r = o.radii[k]
    const t = k / (n - 1)
    const ring: { p: Vec3; nr: Vec3; c: Vec3 }[] = []
    for (let i = 0; i < S; i++) {
      const a = (i / S) * TAU
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const dir: Vec3 = [f.n[0] * ca + f.b[0] * sa, f.n[1] * ca + f.b[1] * sa, f.n[2] * ca + f.b[2] * sa]
      const rr = r * (1 + (o.rough ? o.rough(k, i) : 0))
      ring.push({ p: add(path[k], mul(dir, rr)), nr: dir, c: o.color(t, i / S) })
    }
    rings.push(ring)
  }
  const sw = (k: number): number => o.sway(k / (n - 1))
  if (smooth) {
    const base: number[] = []
    for (let k = 0; k < n; k++) {
      base.push(b.vertexCount)
      for (let i = 0; i < S; i++) b.vert(rings[k][i].p, rings[k][i].nr, rings[k][i].c, sw(k))
    }
    for (let k = 0; k < n - 1; k++) {
      for (let i = 0; i < S; i++) {
        const j = (i + 1) % S
        const a0 = base[k] + i
        const a1 = base[k] + j
        const b0 = base[k + 1] + i
        const b1 = base[k + 1] + j
        b.tri(a0, a1, b0)
        b.tri(a1, b1, b0)
      }
    }
  } else {
    for (let k = 0; k < n - 1; k++) {
      for (let i = 0; i < S; i++) {
        const j = (i + 1) % S
        const hint = add(rings[k][i].nr, rings[k][j].nr)
        b.flatQuad(
          rings[k][i].p, rings[k + 1][i].p, rings[k + 1][j].p, rings[k][j].p,
          rings[k][i].c, rings[k + 1][i].c, rings[k + 1][j].c, rings[k][j].c,
          sw(k), sw(k + 1), sw(k + 1), sw(k), hint,
        )
      }
    }
  }
  const end = o.end ?? 'point'
  const last = n - 1
  if (end === 'point') {
    const tip = add(path[last], mul(frames[last].t, Math.max(o.radii[last] * 1.2, 0.005)))
    const tc = rings[last][0].c
    for (let i = 0; i < S; i++) {
      const j = (i + 1) % S
      b.flatTri(rings[last][i].p, rings[last][j].p, tip, rings[last][i].c, rings[last][j].c, tc, sw(last), sw(last), sw(last), add(rings[last][i].nr, frames[last].t))
    }
  } else if (end === 'flat') {
    const tc = rings[last][0].c
    for (let i = 0; i < S; i++) {
      const j = (i + 1) % S
      b.flatTri(rings[last][i].p, rings[last][j].p, path[last], rings[last][i].c, rings[last][j].c, tc, sw(last), sw(last), sw(last), frames[last].t)
    }
  }
}

export interface RibbedOptions {
  ribs: number
  /** ridge radius per path point */
  radii: number[]
  /** valley radius as a fraction of the ridge radius */
  valley: number
  color: (t: number, ridge: boolean, rib: number) => Vec3
  sway: (t: number) => number
  /** extra rings that round off the end (dome) */
  dome?: number
  /** wobble of ridge radius for organic look (per ring, per rib) */
  rough?: (ring: number, rib: number) => number
}

export interface RibbedInfo {
  /** ridge world positions per ring and rib (for attaching spines) */
  ridges: { p: Vec3; n: Vec3; t: number; rib: number; ring: number }[]
  end: Vec3
}

/** Ribbed column (cactus): 2*ribs vertices per ring alternating ridge and valley, flat shaded. */
export function ribbedTube(b: MeshBuilder, path: Vec3[], o: RibbedOptions): RibbedInfo {
  const frames = pathFrames(path)
  const pts = path.slice()
  const radii = o.radii.slice()
  const fr = frames.slice()
  const domeN = o.dome ?? 0
  const lastR = o.radii[o.radii.length - 1]
  const lastF = frames[frames.length - 1]
  const lastP = path[path.length - 1]
  for (let j = 1; j <= domeN; j++) {
    const a = (j / (domeN + 1)) * (Math.PI / 2)
    pts.push(add(lastP, mul(lastF.t, lastR * Math.sin(a) * 0.9)))
    radii.push(lastR * Math.cos(a))
    fr.push(lastF)
  }
  const apex = add(lastP, mul(lastF.t, lastR * (domeN > 0 ? 0.95 : 0.2)))
  const S = o.ribs * 2
  const N = pts.length
  const rings: { p: Vec3; nr: Vec3; c: Vec3 }[][] = []
  const info: RibbedInfo = { ridges: [], end: apex }
  const swayAt = (k: number): number => o.sway(k / (N - 1))
  for (let k = 0; k < N; k++) {
    const f = fr[k]
    const ring: { p: Vec3; nr: Vec3; c: Vec3 }[] = []
    for (let i = 0; i < S; i++) {
      const ridge = i % 2 === 0
      const rib = i >> 1
      const a = (i / S) * TAU
      const dir: Vec3 = [f.n[0] * Math.cos(a) + f.b[0] * Math.sin(a), f.n[1] * Math.cos(a) + f.b[1] * Math.sin(a), f.n[2] * Math.cos(a) + f.b[2] * Math.sin(a)]
      const wob = o.rough ? o.rough(k, rib) : 0
      const rr = radii[k] * (ridge ? 1 + wob : o.valley)
      const p = add(pts[k], mul(dir, rr))
      const c = o.color(Math.min(1, k / (path.length - 1)), ridge, rib)
      ring.push({ p, nr: dir, c })
      if (ridge && k < path.length) info.ridges.push({ p, n: dir, t: k / (path.length - 1), rib, ring: k })
    }
    rings.push(ring)
  }
  for (let k = 0; k < N - 1; k++) {
    for (let i = 0; i < S; i++) {
      const j = (i + 1) % S
      const hint = add(rings[k][i].nr, rings[k][j].nr)
      b.flatQuad(
        rings[k][i].p, rings[k + 1][i].p, rings[k + 1][j].p, rings[k][j].p,
        rings[k][i].c, rings[k + 1][i].c, rings[k + 1][j].c, rings[k][j].c,
        swayAt(k), swayAt(k + 1), swayAt(k + 1), swayAt(k), hint,
      )
    }
  }
  const lastRing = rings[N - 1]
  for (let i = 0; i < S; i++) {
    const j = (i + 1) % S
    b.flatTri(lastRing[i].p, lastRing[j].p, apex, lastRing[i].c, lastRing[j].c, lastRing[0].c, swayAt(N - 1), swayAt(N - 1), swayAt(N - 1), add(lastRing[i].nr, lastF.t))
  }
  return info
}
