import { EPS, MARGIN, TOL, WALL_THICKNESS } from './constants'
import type { PlacedItem, Rect, Room, RoomDef, Vec2 } from './types'

export const r2 = (x: number): number => Math.round(x * 100) / 100
export const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x))
export const overlaps = (a: Rect, b: Rect, e = EPS): boolean => a[0] < b[2] - e && a[2] > b[0] + e && a[1] < b[3] - e && a[3] > b[1] + e
export const inner = (p: Rect): Rect => [p[0] + MARGIN, p[1] + MARGIN, p[2] - MARGIN, p[3] - MARGIN]
export const eq = (a: number, b: number): boolean => Math.abs(a - b) < TOL
export const inflate = (r: Rect, e: number): Rect => [r[0] - e, r[1] - e, r[2] + e, r[3] + e]
export const areaOf = (r: Rect): number => (r[2] - r[0]) * (r[3] - r[1])
export const topOf = (m: PlacedItem): number => (m.y || 0) + m.h

/** Footprint of an item of `size` facing `f` (cardinal). */
export const extent = (size: Vec2, f: Vec2): Vec2 => (Math.abs(f[1]) === 1 ? [size[0], size[1]] : [size[1], size[0]])
export const cardinal = (dx: number, dz: number): Vec2 => (Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz) || 1])

export function clearRect(r: Rect, f: Vec2, clearance: number): Rect {
  return f[1] === 1 ? [r[0], r[3], r[2], r[3] + clearance] : f[1] === -1 ? [r[0], r[1] - clearance, r[2], r[1]] : f[0] === 1 ? [r[2], r[1], r[2] + clearance, r[3]] : [r[0] - clearance, r[1], r[0], r[3]]
}

export function insideUnion(r: Rect, inners: Rect[]): boolean {
  const e = 1e-4
  const points: Vec2[] = [
    [r[0] + e, r[1] + e],
    [r[2] - e, r[1] + e],
    [r[0] + e, r[3] - e],
    [r[2] - e, r[3] - e],
    [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2],
  ]
  return points.every((p) => inners.some((q) => p[0] >= q[0] - 1e-6 && p[0] <= q[2] + 1e-6 && p[1] >= q[1] - 1e-6 && p[1] <= q[3] + 1e-6))
}

export function cutIntervals(intervals: [number, number][], a: number, b: number): [number, number][] {
  const out: [number, number][] = []
  for (const [x, y] of intervals) {
    if (b <= x || a >= y) {
      out.push([x, y])
      continue
    }
    if (a > x) out.push([x, a])
    if (b < y) out.push([b, y])
  }
  return out
}

export interface Edge {
  axis: 'u' | 'v'
  pos: number
  a0: number
  a1: number
}

export function exteriorEdge(room: Room, side: string, w: number, d: number, c?: number | null): Edge | null {
  const cand: Edge[] = []
  for (const p of room.parts) {
    if (side === 'front' && eq(p[1], 0)) cand.push({ axis: 'u', pos: 0, a0: p[0], a1: p[2] })
    else if (side === 'back' && eq(p[3], d)) cand.push({ axis: 'u', pos: d, a0: p[0], a1: p[2] })
    else if (side === 'left' && eq(p[0], 0)) cand.push({ axis: 'v', pos: 0, a0: p[1], a1: p[3] })
    else if (side === 'right' && eq(p[2], w)) cand.push({ axis: 'v', pos: w, a0: p[1], a1: p[3] })
  }
  if (!cand.length) return null
  if (c != null) {
    const k = cand.find((x) => c >= x.a0 - TOL && c <= x.a1 + TOL)
    if (k) return k
  }
  return cand.sort((x, y) => y.a1 - y.a0 - (x.a1 - x.a0))[0]
}

export function sharedEdge(A: Room, B: Room, c?: number | null): Edge | null {
  const cand: Edge[] = []
  for (const pa of A.parts)
    for (const pb of B.parts) {
      let o: [number, number]
      if (eq(pa[2], pb[0]) || eq(pa[0], pb[2])) {
        o = [Math.max(pa[1], pb[1]), Math.min(pa[3], pb[3])]
        if (o[1] - o[0] > TOL) cand.push({ axis: 'v', pos: eq(pa[2], pb[0]) ? pa[2] : pa[0], a0: o[0], a1: o[1] })
      }
      if (eq(pa[3], pb[1]) || eq(pa[1], pb[3])) {
        o = [Math.max(pa[0], pb[0]), Math.min(pa[2], pb[2])]
        if (o[1] - o[0] > TOL) cand.push({ axis: 'u', pos: eq(pa[3], pb[1]) ? pa[3] : pa[1], a0: o[0], a1: o[1] })
      }
    }
  if (!cand.length) return null
  if (c != null) {
    const k = cand.find((x) => c >= x.a0 - TOL && c <= x.a1 + TOL)
    if (k) return k
  }
  return cand.sort((x, y) => y.a1 - y.a0 - (x.a1 - x.a0))[0]
}

export function openingZones(u: number, v: number, axis: 'u' | 'v', width: number, depth: number): Rect[] {
  const h = width / 2
  return axis === 'u' ? [[u - h, v - depth, u + h, v], [u - h, v, u + h, v + depth]] : [[u - depth, v - h, u, v + h], [u, v - h, u + depth, v + h]]
}
export const openingDepth = (width: number, leaf: number): number => Math.max(0.9, leaf) + MARGIN

/** Points 0.55 m on each side of an opening. */
export function entryPoints(ab: { axis: 'u' | 'v'; u: number; v: number }): Vec2[] {
  return ab.axis === 'u' ? [[ab.u, ab.v - 0.55], [ab.u, ab.v + 0.55]] : [[ab.u - 0.55, ab.v], [ab.u + 0.55, ab.v]]
}

export function normalizeRoom(c: Partial<RoomDef> & { id: string; type: string; rect: number[] }, floorIndex: number): Room {
  const parts = [c.rect as number[]].concat(c.parts || []).map((p) => p.map(r2) as Rect)
  return {
    id: c.id,
    type: c.type,
    label: c.label,
    floor: floorIndex,
    parts,
    library: c.library || null,
    without: c.without || [],
    overrides: c.overrides || {},
    extras: c.extras || [],
    slots: c.slots || null,
    link: c.link || null,
    outdoor: !!c.outdoor,
    ceiling: c.ceiling || null,
    seedKey: c.seedKey,
  }
}

/** Usable parts: inset only on sides with a real wall (sides open to another part of the same room are not inset). */
export function usableParts(room: Room, extra?: number): Rect[] {
  return room.parts.map((p) => {
    const isOpen = (k: number) =>
      room.parts.some(
        (q) =>
          q !== p &&
          (k === 0
            ? eq(q[2], p[0]) && Math.min(q[3], p[3]) - Math.max(q[1], p[1]) > 0.3
            : k === 2
              ? eq(q[0], p[2]) && Math.min(q[3], p[3]) - Math.max(q[1], p[1]) > 0.3
              : k === 1
                ? eq(q[3], p[1]) && Math.min(q[2], p[2]) - Math.max(q[0], p[0]) > 0.3
                : eq(q[1], p[3]) && Math.min(q[2], p[2]) - Math.max(q[0], p[0]) > 0.3),
      )
    const m = MARGIN + (extra || 0)
    return [p[0] + (isOpen(0) ? 0 : m), p[1] + (isOpen(1) ? 0 : m), p[2] - (isOpen(2) ? 0 : m), p[3] - (isOpen(3) ? 0 : m)] as Rect
  })
}

export const inRect = (room: Room, u: number, v: number): boolean => room.parts.some((p) => u > p[0] + EPS && u < p[2] - EPS && v > p[1] + EPS && v < p[3] - EPS)

export interface WallBuildDoor {
  axis: 'u' | 'v'
  pos: number
  at: number
  width: number
}

/** Walls of one storey, split where rooms meet and cut where doors open. */
export function buildWalls(rooms: Room[], doors: WallBuildDoor[], openPairs: [string, string][], floorIndex: number) {
  const groups: Record<string, { axis: 'u' | 'v'; pos: number; es: { a: number; b: number; id: string; side: number }[] }> = {}
  const add = (axis: 'u' | 'v', pos: number, a: number, b: number, id: string, side: number) => {
    const k = axis + '|' + pos.toFixed(2)
    ;(groups[k] = groups[k] || { axis, pos, es: [] }).es.push({ a, b, id, side })
  }
  for (const c of rooms)
    for (const p of c.parts) {
      add('u', p[1], p[0], p[2], c.id, 1)
      add('u', p[3], p[0], p[2], c.id, -1)
      add('v', p[0], p[1], p[3], c.id, 1)
      add('v', p[2], p[1], p[3], c.id, -1)
    }
  const par = (x: string, y: string) => openPairs.some((o) => (o[0] === x && o[1] === y) || (o[0] === y && o[1] === x))
  const typeOf: Record<string, string> = {}
  for (const c of rooms) typeOf[c.id] = c.type
  const out: Record<string, unknown>[] = []
  for (const g of Object.values(groups)) {
    const breaks = [...new Set(g.es.flatMap((e) => [r2(e.a), r2(e.b)]))].sort((x, y) => x - y)
    const segs: { A: string; B: string; p: number; q: number }[] = []
    for (let i = 0; i < breaks.length - 1; i++) {
      const p = breaks[i]
      const q = breaks[i + 1]
      const m = (p + q) / 2
      const after = g.es.find((e) => e.side === 1 && m > e.a && m < e.b)
      const before = g.es.find((e) => e.side === -1 && m > e.a && m < e.b)
      if (!after && !before) continue
      const A = before ? before.id : 'outside'
      const B = after ? after.id : 'outside'
      if (A === B || (A !== 'outside' && B !== 'outside' && par(A, B))) continue
      const last = segs[segs.length - 1]
      if (last && last.A === A && last.B === B && eq(last.q, p)) last.q = q
      else segs.push({ A, B, p, q })
    }
    for (const s of segs) {
      let pieces: [number, number][] = [[s.p, s.q]]
      for (const pt of doors) {
        if (pt.axis !== g.axis || !eq(pt.pos, g.pos)) continue
        const c0 = pt.at - pt.width / 2
        const c1 = pt.at + pt.width / 2
        const n: [number, number][] = []
        for (const [x, y] of pieces) {
          if (c1 <= x + TOL || c0 >= y - TOL) {
            n.push([x, y])
            continue
          }
          if (c0 > x + TOL) n.push([x, c0])
          if (c1 < y - TOL) n.push([c1, y])
        }
        pieces = n
      }
      for (const [x, y] of pieces) {
        const isOpen = (t: string) => t === 'balcony' || t === 'terrace'
        const isVoid = typeOf[s.A] === 'void' || typeOf[s.B] === 'void'
        if (isVoid && (s.A === 'outside' || s.B === 'outside')) continue
        const railing = isVoid || (isOpen(typeOf[s.A]) && s.B === 'outside') || (isOpen(typeOf[s.B]) && s.A === 'outside')
        out.push({
          floor: floorIndex,
          axis: g.axis,
          u0: g.axis === 'u' ? x : g.pos,
          v0: g.axis === 'u' ? g.pos : x,
          u1: g.axis === 'u' ? y : g.pos,
          v1: g.axis === 'u' ? g.pos : y,
          thickness: WALL_THICKNESS,
          sides: [s.A, s.B],
          exterior: s.A === 'outside' || s.B === 'outside',
          type: railing ? 'railing' : 'wall',
          h: railing ? 1.1 : 0,
        })
      }
    }
  }
  return out
}
