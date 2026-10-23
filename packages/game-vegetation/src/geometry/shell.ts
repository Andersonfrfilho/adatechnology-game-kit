import type { Vec3 } from '../types'
import { add, mul, norm, sub, dot, clamp, smooth, lerp, dist, type Frame, toWorld } from '../math'
import { jitter, lighten, mix, shade } from '../color'
import { Rng } from '../rng'
import type { MeshBuilder } from './builder'
import { icoTemplate } from './ico'
import { leaf } from './leaf'

export interface ShellVertex {
  p: Vec3
  /** unit direction from the shell center (local space) */
  dir: Vec3
  /** 0 at the bottom, 1 at the top */
  h: number
}

export interface ShellOptions {
  center: Vec3
  /** radii along local x / y / z */
  radii: Vec3
  frame?: Frame
  detail: 0 | 1 | 2
  rng?: Rng
  /** radial noise amplitude (fraction of radius) */
  noise: number
  /** squash of the lower part (0 none .. 1 flat bottom) */
  flatBottom?: number
  color: (v: ShellVertex) => Vec3
  sway: (v: ShellVertex) => number
}

/** Faceted, noisy, flat shaded ellipsoid shell. Returns the displaced vertices. */
export function icoShell(b: MeshBuilder, o: ShellOptions): ShellVertex[] {
  const tpl = icoTemplate(o.detail)
  const verts: ShellVertex[] = tpl.verts.map((u) => {
    let r = 1 + (o.rng && o.noise ? o.rng.gauss() * o.noise : 0)
    let y = u[1]
    if (o.flatBottom && y < 0) y *= 1 - o.flatBottom * 0.7 * Math.min(1, -y * 1.4)
    r = Math.max(0.5, r)
    const l: Vec3 = [u[0] * o.radii[0] * r, y * o.radii[1] * r, u[2] * o.radii[2] * r]
    const p = o.frame ? toWorld(o.frame, l) : add(o.center, l)
    return { p, dir: u, h: clamp((u[1] + 1) / 2, 0, 1) }
  })
  const origin = o.frame ? o.frame.o : o.center
  const colors = verts.map((v) => o.color(v))
  const sways = verts.map((v) => o.sway(v))
  for (const [a, bb, c] of tpl.faces) {
    const hint = sub(add(add(verts[a].p, verts[bb].p), verts[c].p), mul(origin, 3))
    b.flatTri(verts[a].p, verts[bb].p, verts[c].p, colors[a], colors[bb], colors[c], sways[a], sways[bb], sways[c], hint)
  }
  return verts
}

export interface ClumpOptions {
  center: Vec3
  radius: number
  /** vertical radius ratio (default 0.78) */
  squash?: number
  detail: 0 | 1 | 2
  seed: number
  /** base leaf color (sRGB) */
  base: Vec3
  /** crown center: vertices facing away from it are brighter, facing it darker */
  crown?: Vec3
  /** accent color mixed on top (flowers / new growth), 0..1 amount */
  accent?: { color: Vec3; amount: number }
  /** leaves poking out of the surface: count (LOD0 only) and length */
  leaves?: { count: number; length: number; width?: number }
  /** sway multiplier (trees move little, shrubs more) */
  swayK: number
  noise?: number
  flatBottom?: number
  /** minimum brightness at the bottom (default 0.5) */
  ao?: number
}

/** Leaf clump: deformed low poly shell with gradient colors and optional small leaves on the surface. */
export function clump(b: MeshBuilder, o: ClumpOptions): void {
  const rng = new Rng(o.seed)
  const base = jitter(o.base, rng, 0.015, 0.07, 0.05)
  const crown = o.crown
  const ao = o.ao ?? 0.5
  const accent = o.accent
  const sq = o.squash ?? 0.78
  icoShell(b, {
    center: o.center,
    radii: [o.radius, o.radius * sq, o.radius],
    detail: o.detail,
    rng,
    noise: o.noise ?? 0.2,
    flatBottom: o.flatBottom ?? 0.5,
    color: (v) => {
      const tHeight = smooth(v.h)
      let k = lerp(ao, 1.04, tHeight)
      if (crown) {
        const out = norm(sub(v.p, crown))
        const f = dot(out, norm(sub(v.p, o.center)))
        k *= lerp(0.8, 1.06, clamp((f + 1) / 2, 0, 1))
      }
      let c = shade(base, k)
      if (v.h > 0.62) c = mix(c, lighten(base, 1), clamp((v.h - 0.62) * 1.7, 0, 0.6))
      c = shade(c, 0.94 + ((Math.sin(v.p[0] * 91.7 + v.p[1] * 53.3 + v.p[2] * 37.1) + 1) / 2) * 0.12)
      if (accent && accent.amount > 0) {
        const m = clamp(accent.amount * (0.35 + v.h * 0.9), 0, 1)
        c = mix(c, shade(accent.color, 0.7 + 0.35 * tHeight), m)
      }
      return c
    },
    sway: (v) => o.swayK * (0.45 + 0.55 * v.h),
  })
}

/** Surface leaves for a clump, emitted separately so callers can skip them at lower LODs. */
export function clumpLeaves(b: MeshBuilder, o: ClumpOptions): void {
  if (!o.leaves || o.leaves.count <= 0) return
  const rng = new Rng(o.seed ^ 0x9e3779b9)
  const base = jitter(o.base, new Rng(o.seed), 0.015, 0.07, 0.05)
  const sq = o.squash ?? 0.78
  for (let i = 0; i < o.leaves.count; i++) {
    // direction biased to the upper / outer half
    const a = rng.range(0, Math.PI * 2)
    const y = rng.range(-0.25, 1)
    const r = Math.sqrt(1 - y * y)
    const d: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r]
    const p: Vec3 = [o.center[0] + d[0] * o.radius * 0.92, o.center[1] + d[1] * o.radius * sq * 0.92, o.center[2] + d[2] * o.radius * 0.92]
    let out = d
    if (o.crown) out = norm(add(d, mul(norm(sub(p, o.crown)), 0.6)))
    // leaves lie on the surface like shingles, pointing up-and-out, with the tips lifted off the shell
    let t: Vec3 = sub([0, 1, 0], mul(out, out[1]))
    if (dot(t, t) < 0.05) t = [Math.cos(a + 1.3), 0, Math.sin(a + 1.3)]
    const dir = norm(add(mul(norm(t), 0.8), mul(out, 0.22)))
    const k = lerp(o.ao ?? 0.5, 1.1, clamp((y + 0.4) / 1.4, 0, 1))
    const c0 = shade(base, Math.max(0.6, k * 0.9))
    const c1 = lighten(shade(base, Math.min(1.1, k)), 0.9)
    const len = o.leaves.length * rng.range(0.8, 1.25)
    const start = sub(p, mul(out, len * 0.05))
    leaf(b, start, dir, out, len, o.leaves.width ?? len * 0.8, c0, c1, { swayBase: o.swayK * 0.8, swayTip: Math.min(1, o.swayK * 1.4), curl: 0.06, fold: 0.12, round: 0.8, peak: 0.45 })
  }
}

/** Greedily merge points with radii into at most k groups (used by the far LOD). */
export function mergeAnchors<T extends { p: Vec3; r: number }>(items: T[], k: number): { p: Vec3; r: number; members: T[] }[] {
  if (items.length <= k) return items.map((i) => ({ p: i.p, r: i.r, members: [i] }))
  const seeds: T[] = [items.reduce((a, b2) => (b2.r > a.r ? b2 : a), items[0])]
  while (seeds.length < k) {
    let best: T | undefined
    let bd = -1
    for (const it of items) {
      let md = Infinity
      for (const s of seeds) md = Math.min(md, dist(it.p, s.p))
      if (md > bd) {
        bd = md
        best = it
      }
    }
    seeds.push(best as T)
  }
  const groups = seeds.map((s) => ({ s, members: [] as T[] }))
  for (const it of items) {
    let bi = 0
    let bd = Infinity
    for (let i = 0; i < seeds.length; i++) {
      const d = dist(it.p, seeds[i].p)
      if (d < bd) {
        bd = d
        bi = i
      }
    }
    groups[bi].members.push(it)
  }
  return groups
    .filter((g) => g.members.length > 0)
    .map((g) => {
      let cx = 0
      let cy = 0
      let cz = 0
      let w = 0
      for (const m of g.members) {
        cx += m.p[0] * m.r
        cy += m.p[1] * m.r
        cz += m.p[2] * m.r
        w += m.r
      }
      const p: Vec3 = [cx / w, cy / w, cz / w]
      let r = 0
      for (const m of g.members) r = Math.max(r, dist(p, m.p) + m.r * 0.85)
      return { p, r, members: g.members }
    })
}

/** Tiny faceted blob (8 triangles) for small fruit / buds. */
export function octa(b: MeshBuilder, center: Vec3, radii: Vec3, color: (h: number) => Vec3, sway: number): void {
  const pts: Vec3[] = [
    [radii[0], 0, 0], [0, 0, radii[2]], [-radii[0], 0, 0], [0, 0, -radii[2]],
  ].map((p) => add(center, [p[0], p[1] + 0.0, p[2]] as Vec3))
  const top: Vec3 = add(center, [0, radii[1], 0])
  const bot: Vec3 = add(center, [0, -radii[1], 0])
  for (let i = 0; i < 4; i++) {
    const a = pts[i]
    const c = pts[(i + 1) % 4]
    const out = sub(add(a, c), mul(center, 2))
    b.flatTri(a, c, top, color(0.5), color(0.5), color(1), sway, sway, sway, add(out, [0, 1, 0]))
    b.flatTri(c, a, bot, color(0.5), color(0.5), color(0), sway, sway, sway, add(out, [0, -1, 0]))
  }
}
