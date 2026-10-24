import type { Rect } from '../types'
import type { Json, Rng } from './shared'
import { isSolid, overlaps, round2 } from './shared'

const WALL = 0.15
const DOOR_WIDTH = 0.85
const DOOR_HEIGHT = 2.1
const USES: Record<string, string[]> = { guest_room: ['single_bed', 'nightstand'], office: ['desk', 'shelf_unit_small'], storage: ['tool_shelf', 'crate'], gourmet: ['dining_table_small', 'workbench'] }
const USE_WEIGHTS: Record<string, number> = { guest_room: 3, office: 2, storage: 2, gourmet: 2 }
const PATH_WIDTH = 1.0

export interface OutbuildingContext {
  plan: Json
  items: Json[]
  catalog: Record<string, Json>
  rngFor(key: string): Rng
}

/**
 * Name of the seeded stream of an outbuilding. It is the name the Visor de casas 3D gave it (`edif:<room>.<slot>` in Portuguese: `quintal.edicula`), kept verbatim so that an
 * old seed draws the same use and furniture; it never appears in the output.
 */
const LEGACY_ROOMS: Record<string, string> = { backyard: 'quintal' }
const LEGACY_SLOTS: Record<string, string> = { outbuilding: 'edicula' }
export const streamOf = (itemId: string): string => {
  const [room = '', ...slot] = itemId.split('.')
  return `edif:${LEGACY_ROOMS[room] ?? room}.${slot.map((part) => LEGACY_SLOTS[part] ?? part).join('.')}`
}

function pickWeighted(rng: Rng, weights: Record<string, number>): string {
  const keys = Object.keys(weights)
  let x = rng() * keys.reduce((sum, key) => sum + weights[key]!, 0)
  for (const key of keys) {
    x -= weights[key]!
    if (x < 0) return key
  }
  return keys[keys.length - 1]!
}

const sideOf = (x: number, z: number): string => (Math.abs(x) > Math.abs(z) ? (x > 0 ? 'right' : 'left') : z > 0 ? 'back' : 'front')

interface Frame {
  n: [number, number]
  t: [number, number]
  cx: number
  cz: number
  depth: number
  width: number
  horizontal: boolean
  sideToMiddle: number
}

const at = (frame: Frame, a: number, b: number): [number, number] => [frame.cx + frame.n[0] * a + frame.t[0] * b, frame.cz + frame.n[1] * a + frame.t[1] * b]

function opening(frame: Frame, id: string, a: number, b: number, vector: [number, number], width: number, extra: Json): Json {
  const [u, v] = at(frame, a, b)
  const alongU = Math.abs(vector[0]) !== 1
  return { id, axis: alongU ? 'u' : 'v', pos: round2(alongU ? v : u), at: round2(alongU ? u : v), u: round2(u), v: round2(v), width: round2(width), side: sideOf(vector[0], vector[1]), ...extra }
}

function wallsOf(box: Rect, door: Json, height: number): Json[] {
  const walls: Json[] = []
  const sides = [
    { axis: 'u', pos: box[1], i0: box[0], i1: box[2], side: 'front' }, { axis: 'u', pos: box[3], i0: box[0], i1: box[2], side: 'back' },
    { axis: 'v', pos: box[0], i0: box[1], i1: box[3], side: 'left' }, { axis: 'v', pos: box[2], i0: box[1], i1: box[3], side: 'right' },
  ]
  for (const w of sides) {
    const cut = w.axis === door.axis && Math.abs(w.pos - door.pos) < 0.02 ? [door.at - door.width / 2, door.at + door.width / 2] : null
    const segments = cut ? [[w.i0, cut[0]!], [cut[1]!, w.i1]] : [[w.i0, w.i1]]
    for (const [x0, x1] of segments) {
      if (x1! - x0! <= 1e-3) continue
      walls.push(w.axis === 'u' ? { axis: 'u', u0: round2(x0!), v0: round2(w.pos), u1: round2(x1!), v1: round2(w.pos), thickness: WALL, h: height, side: w.side } : { axis: 'v', u0: round2(w.pos), v0: round2(x0!), u1: round2(w.pos), v1: round2(x1!), thickness: WALL, h: height, side: w.side })
    }
  }
  return walls
}

function furnish(context: OutbuildingContext, frame: Frame, use: string, interior: Rect, insideDoor: Rect): Json[] {
  const placed: Json[] = []
  USES[use]!.forEach((type, k) => {
    const def = context.catalog[type]!
    const facing: [number, number] = k === 0 ? frame.n : [frame.t[0] * frame.sideToMiddle, frame.t[1] * frame.sideToMiddle]
    const [a, b] = k === 0 ? [-frame.depth / 2 + WALL + def.d / 2, frame.sideToMiddle * -0.4] : [-0.1, -frame.sideToMiddle * (frame.width / 2 - WALL - def.d / 2)]
    const [u, v] = at(frame, a, b)
    const eu = Math.abs(facing[0]) === 1 ? def.d : def.w
    const ev = Math.abs(facing[0]) === 1 ? def.w : def.d
    const box = [u - eu / 2, v - ev / 2, u + eu / 2, v + ev / 2].map(round2) as Rect
    if (box[0] < interior[0] - 0.011 || box[2] > interior[2] + 0.011 || box[1] < interior[1] - 0.011 || box[3] > interior[3] + 0.011 || overlaps(box, insideDoor) || placed.some((o) => overlaps(box, o.aabb))) return
    placed.push({ type, category: def.category, u: round2(u), v: round2(v), w: def.w, d: def.d, h: def.h, ry: Math.atan2(facing[0], facing[1]), frontU: facing[0], frontV: facing[1], aabb: box })
  })
  return placed
}

/**
 * The outbuilding at the back of the yard is a small building of its own: walls with a gap for the door, a door of 0.85 m facing the yard, two windows and the
 * furniture of a drawn use (guest room, office, storage, gourmet space).
 */
export function planOutbuildings(context: OutbuildingContext): Json[] {
  const { plan, items } = context
  const lot = plan.lot
  if (!lot) return []
  const out: Json[] = []
  for (const item of items.filter((m) => m.category === 'outbuilding')) {
    const rng = context.rngFor(streamOf(item.id))
    const [a0, a1, a2, a3] = item.aabb as Rect
    const n: [number, number] = [item.frontU, item.frontV]
    const t: [number, number] = [-item.frontV, item.frontU]
    const horizontal = Math.abs(item.frontU) === 1
    const cx = (a0 + a2) / 2
    const cz = (a1 + a3) / 2
    const depth = horizontal ? a2 - a0 : a3 - a1
    const width = horizontal ? a3 - a1 : a2 - a0
    const sideToMiddle = ((lot.rect[0] + lot.rect[2]) / 2 - cx) * t[0] + ((lot.rect[1] + lot.rect[3]) / 2 - cz) * t[1] >= 0 ? 1 : -1
    const frame: Frame = { n, t, cx, cz, depth, width, horizontal, sideToMiddle }
    const doorOffset = sideToMiddle * (width / 2 - 0.95)
    const door = opening(frame, `${item.id}.d0`, depth / 2, doorOffset, n, DOOR_WIDTH, { height: DOOR_HEIGHT, exterior: true })
    const windowFront = opening(frame, `${item.id}.w0`, depth / 2, -sideToMiddle * (width / 2 - 0.9), n, Math.min(1.0, width / 2 - 0.6), { y0: 1.0, y1: 2.0 })
    const windowSide = opening(frame, `${item.id}.w1`, 0, (sideToMiddle * width) / 2, [t[0] * sideToMiddle, t[1] * sideToMiddle], Math.min(1.0, depth - 0.8), { y0: 1.0, y1: 2.0 })
    const [p, q] = [at(frame, depth / 2, doorOffset), at(frame, depth / 2 - 0.9, doorOffset)]
    door.zone = (horizontal ? [Math.min(p[0], q[0]), p[1] - door.width / 2, Math.max(p[0], q[0]), p[1] + door.width / 2] : [p[0] - door.width / 2, Math.min(p[1], q[1]), p[0] + door.width / 2, Math.max(p[1], q[1])]).map(round2)
    const interior: Rect = [a0 + WALL, a1 + WALL, a2 - WALL, a3 - WALL]
    const use = pickWeighted(rng, USE_WEIGHTS)
    out.push({ id: item.id, type: 'outbuilding', use, floor: 0, aabb: (item.aabb as Rect).slice(), interior: [interior.map(round2)], ceiling: item.h, thickness: WALL, front: n, walls: wallsOf(item.aabb, door, item.h), doors: [door], windows: [windowFront, windowSide], items: furnish(context, frame, use, interior, door.zone) })
  }
  return out
}

/** A pedestrian path from every door of an outbuilding: a 1 m stub out of the door and an L to the nearest existing path, away from furniture, the building and the fence. */
export function addOutbuildingPaths(lot: Json, outbuildings: Json[], items: Json[]): void {
  const half = PATH_WIDTH / 2
  const rect = lot.rect as Rect
  const solids = items.filter((m) => m.outdoor && m.aabb && isSolid(m)).map((m) => m.aabb as Rect)
  const fence = lot.perimeter.map((q: Json) => [Math.min(q.u0, q.u1) - 0.075, Math.min(q.v0, q.v1) - 0.075, Math.max(q.u0, q.u1) + 0.075, Math.max(q.v0, q.v1) + 0.075] as Rect)
  const strip = (p: number[], q: number[]): Rect => [Math.min(p[0]!, q[0]!) - half, Math.min(p[1]!, q[1]!) - half, Math.max(p[0]!, q[0]!) + half, Math.max(p[1]!, q[1]!) + half]
  for (const building of outbuildings) {
    for (const door of building.doors as Json[]) {
      if (lot.paths.some((c: Json) => c.to === door.id)) continue
      const z = door.zone as Rect
      const zc = door.axis === 'v' ? (z[0] + z[2]) / 2 : (z[1] + z[3]) / 2
      const outside = zc > door.pos ? -1 : 1
      const A = door.axis === 'v' ? [door.pos, door.at] : [door.at, door.pos]
      const S = door.axis === 'v' ? [door.pos + outside * PATH_WIDTH, door.at] : [door.at, door.pos + outside * PATH_WIDTH]
      const stub: Rect = door.axis === 'v' ? [Math.min(A[0]!, S[0]!), A[1]! - half, Math.max(A[0]!, S[0]!), A[1]! + half] : [A[0]! - half, Math.min(A[1]!, S[1]!), A[0]! + half, Math.max(A[1]!, S[1]!)]
      const cost = (rs: Rect[]): number => {
        let n = 0
        for (const r of rs) {
          const c: Rect = [r[0] + 0.02, r[1] + 0.02, r[2] - 0.02, r[3] - 0.02]
          for (const q of solids) if (overlaps(c, q, 0.011)) n += 2
          if (overlaps(c, building.aabb, 0.011)) n += 3
          for (const q of fence) if (overlaps(c, q, 0.011)) n += 3
          if (r[0] < rect[0] || r[1] < rect[1] || r[2] > rect[2] || r[3] > rect[3]) n += 3
        }
        return n
      }
      let best: { v: number; k: { rects: Rect[]; points: number[][] }; from: string | null } | null = null
      for (const c of lot.paths.filter((p: Json) => p.type === 'pedestrian' || p.id === 'cargo_path')) {
        for (const r of c.rects as Rect[]) {
          const T = [Math.min(Math.max(S[0]!, r[0] + half), r[2] - half), Math.min(Math.max(S[1]!, r[1] + half), r[3] - half)]
          const candidates: { rects: Rect[]; points: number[][] }[] = []
          if (Math.abs(T[0]! - S[0]!) < 1e-6 && Math.abs(T[1]! - S[1]!) < 1e-6) candidates.push({ rects: [stub], points: [A, S] })
          else for (const via of [[T[0]!, S[1]!], [S[0]!, T[1]!]]) candidates.push({ rects: [stub, strip(S, via), strip(via, T)].filter((q) => q[2] - q[0] > 1e-6), points: [A, S, via, T] })
          for (const k of candidates) {
            const distance = k.points.slice(1).reduce((sum, q, i) => sum + Math.abs(q[0]! - k.points[i]![0]!) + Math.abs(q[1]! - k.points[i]![1]!), 0)
            const value = cost(k.rects.slice(1)) * 100 + distance
            if (!best || value < best.v) best = { v: value, k, from: c.from }
          }
        }
      }
      const chosen = best ? best.k : { rects: [stub], points: [A, S] }
      lot.paths.push({ id: `path_${door.id}`, type: 'pedestrian', from: best ? best.from : null, to: door.id, width: PATH_WIDTH, rects: chosen.rects.map((q) => q.map(round2)), points: chosen.points.map((q) => q.map(round2)) })
    }
  }
}
