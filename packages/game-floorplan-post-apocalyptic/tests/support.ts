/**
 * Shared harness for the floor plan property tests. A port of the old `teste.mjs`
 * checks onto the English API: every property is kept, only the names changed.
 */
import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { register as registerPostApocalyptic } from '../src'

registerResidential(engine)
registerCommercial(engine)
registerPostApocalyptic(engine)

export { engine }
export type Plan = any
type Rect = number[]

export const STATES = ['fortified', 'abandoned', 'normal'] as const
export const CATALOG = engine.catalog as Record<string, any>

export const FULL = process.env.FULL === '1'
/** Seeds per variant and per state: 200 for the full run, 25 by default. */
export const N = Number(process.env.SEEDS) || (FULL ? 200 : 25)

export interface Failures {
  add(category: string, message: string): void
  all(): Record<string, { n: number; ex: string[] }>
  total(): number
  report(): string[]
}

export function createFailures(): Failures {
  const map: Record<string, { n: number; ex: string[] }> = {}
  return {
    add(category, message) {
      const f = (map[category] = map[category] || { n: 0, ex: [] })
      f.n++
      if (f.ex.length < 3) f.ex.push(message)
    },
    all: () => map,
    total: () => Object.values(map).reduce((a, f) => a + f.n, 0),
    report: () => Object.entries(map).map(([c, f]) => `${c}: ${f.n}  ex: ${f.ex.join(' || ')}`),
  }
}

const overlap = (a: Rect, b: Rect, e = 0.011) => a[0] < b[2] - e && a[2] > b[0] + e && a[1] < b[3] - e && a[3] > b[1] + e

const rectOf = (m: any): Rect => {
  const fv = Math.round(Math.cos(m.ry))
  const horizontal = m.frontV !== undefined ? Math.abs(m.frontV) === 1 : Math.abs(fv) === 1
  const eu = horizontal ? m.w : m.d
  const ev = horizontal ? m.d : m.w
  return [m.x - eu / 2, m.z - ev / 2, m.x + eu / 2, m.z + ev / 2]
}

const isSolid = (m: any) => !m.flat && !m.on && (!m.decor || m.mount === 'floor')
const NON_SOLID_MOUNTS = new Set(['window', 'support', 'wall_top', 'ground', 'ceiling', 'wall', 'roof'])
const HEAVY = new Set(['sofa', 'wardrobe', 'wardrobe_large', 'fridge', 'shelf_unit', 'tv_unit', 'buffet', 'china_cabinet', 'pantry', 'bookcase', 'dining_table_large', 'freezer', 'wall_shelving'])
const NO_LIGHT_ROOMS = new Set(['void', 'elevator', 'balcony', 'terrace'])

function openingZone(a: any): Rect[] {
  const h = a.width / 2
  const p = 0.975
  return a.axis === 'u' ? [[a.u - h, a.v - p, a.u + h, a.v + p]] : [[a.u - p, a.v - h, a.u + p, a.v + h]]
}

function openingsOf(res: Plan, floor: number): any[] {
  return floor >= 0 ? res.doors.filter((p: any) => p.floor === floor) : res.doors.filter((p: any) => p.floor === 0 && p.exterior).concat(res.lot ? res.lot.gates : [])
}

const entryPoints = (a: any): number[][] => (a.axis === 'u' ? [[a.u, a.v - 0.55], [a.u, a.v + 0.55]] : [[a.u - 0.55, a.v], [a.u + 0.55, a.v]])
const insideAny = (parts: Rect[], u: number, v: number) => parts.some((p) => u > p[0] + 1e-6 && u < p[2] - 1e-6 && v > p[1] + 1e-6 && v < p[3] - 1e-6)
const openingRect = (a: any): Rect => (a.axis === 'u' ? [a.u - a.width / 2, a.v - 0.1, a.u + a.width / 2, a.v + 0.1] : [a.u - 0.1, a.v - a.width / 2, a.u + 0.1, a.v + a.width / 2])

function pathCheck(parts: Rect[], floor: number, res: Plan, items: Rect[]): string | null {
  const gs = 0.1
  const infl = 0.1
  const usable = parts.map((p) =>
    p.map((x, k) => {
      const open = parts.some((q) => q !== p && (k === 0 ? Math.abs(q[2] - p[0]) < 1e-3 && Math.min(q[3], p[3]) - Math.max(q[1], p[1]) > 0.3 : k === 2 ? Math.abs(q[0] - p[2]) < 1e-3 && Math.min(q[3], p[3]) - Math.max(q[1], p[1]) > 0.3 : k === 1 ? Math.abs(q[3] - p[1]) < 1e-3 && Math.min(q[2], p[2]) - Math.max(q[0], p[0]) > 0.3 : Math.abs(q[1] - p[3]) < 1e-3 && Math.min(q[2], p[2]) - Math.max(q[0], p[0]) > 0.3))
      return open ? x : k < 2 ? x + 0.1 : x - 0.1
    }),
  )
  let u0 = 1e9, v0 = 1e9, u1 = -1e9, v1 = -1e9
  for (const p of parts) { u0 = Math.min(u0, p[0]); v0 = Math.min(v0, p[1]); u1 = Math.max(u1, p[2]); v1 = Math.max(v1, p[3]) }
  const nx = Math.ceil((u1 - u0) / gs)
  const nz = Math.ceil((v1 - v0) / gs)
  const free = new Uint8Array(nx * nz)
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const u = u0 + (i + 0.5) * gs
      const v = v0 + (j + 0.5) * gs
      if (!usable.some((p) => u > p[0] && u < p[2] && v > p[1] && v < p[3])) continue
      if (items.some((r) => u > r[0] - infl && u < r[2] + infl && v > r[1] - infl && v < r[3] + infl)) continue
      free[j * nx + i] = 1
    }
  const ent: number[][] = []
  for (const a of openingsOf(res, floor)) {
    if (a.blocked) continue
    for (const pt of entryPoints(a)) if (insideAny(parts, pt[0], pt[1])) ent.push([Math.floor((pt[0] - u0) / gs), Math.floor((pt[1] - v0) / gs)])
  }
  const cu = (parts[0][0] + parts[0][2]) / 2
  const cv = (parts[0][1] + parts[0][3]) / 2
  let best = -1
  let bd = 1e9
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (free[j * nx + i]) { const d = Math.hypot(u0 + (i + 0.5) * gs - cu, v0 + (j + 0.5) * gs - cv); if (d < bd) { bd = d; best = j * nx + i } }
  if (best < 0) return 'no free area'
  if (!ent.length) return null
  for (const [i, j] of ent) if (!free[j * nx + i]) return 'entrance blocked'
  const seen = new Uint8Array(nx * nz)
  const q = [ent[0][1] * nx + ent[0][0]]
  seen[q[0]] = 1
  for (let h = 0; h < q.length; h++) {
    const k = q[h]
    const i = k % nx
    const j = (k - i) / nx
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di
      const b = j + dj
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue
      const z = b * nx + a
      if (!seen[z] && free[z]) { seen[z] = 1; q.push(z) }
    }
  }
  let nl = 0, nv = 0
  for (let k = 0; k < free.length; k++) if (free[k]) { nl++; if (seen[k]) nv++ }
  if (nv < nl * 0.3) return 'reachable area only ' + Math.round((100 * nv) / nl) + '%'
  if (bd < 0.3 && !seen[best]) return 'centre unreachable'
  for (const [i, j] of ent) if (!seen[j * nx + i]) return 'entrances disconnected'
  return null
}

function windowZone(j: any, outside: boolean): Rect {
  const h = j.width / 2
  const p = 0.45 + 0.075
  let n = j.side === 'front' ? [0, 1] : j.side === 'back' ? [0, -1] : j.side === 'left' ? [1, 0] : [-1, 0]
  if (outside) n = [-n[0], -n[1]]
  if (j.axis === 'u') return n[1] > 0 ? [j.u - h, j.v, j.u + h, j.v + p] : [j.u - h, j.v - p, j.u + h, j.v]
  return n[0] > 0 ? [j.u, j.v - h, j.u + p, j.v + h] : [j.u - p, j.v - h, j.u, j.v + h]
}

function checkDecor(tag: string, res: Plan, F: Failures) {
  const ac = res.items.filter((m: any) => m.type === 'wall_ac')
  const condensers = res.items.filter((m: any) => m.type === 'ac_condenser')
  const apartment = !res.lot
  const style = res.style
  for (const a of ac) {
    const c = res.items.find((m: any) => m.id === a.par)
    if (!c || c.type !== 'ac_condenser' || c.par !== a.id) { F.add('ac unit without pair', tag + ' ' + a.id); continue }
    if (a.y < 2.0 - 1e-6 || a.y + a.h > 2.3 + 1e-6) F.add('ac unit height', tag + ' ' + a.id + ' y=' + a.y)
    if (style === 'budget' && !res.rooms.find((r: any) => r.id === a.room && r.type === 'bedroom')) F.add('budget ac unit outside a bedroom', tag + a.id)
    for (const p of res.doors) if (p.floor === a.floor && overlap(a.aabb, openingRect(p).map((x, k) => x + (k < 2 ? -0.1 : 0.1)), 0.001)) F.add('ac unit over a door', tag + ' ' + a.id)
    if (apartment) {
      const v = res.rooms.find((r: any) => r.id === c.room)
      if (!v || v.type !== 'balcony') F.add('condenser outside the balcony', tag + ' ' + c.id)
    } else {
      const n = [a.frontU, a.frontV]
      const dx = c.x - a.x
      const dz = c.z - a.z
      const perp = dx * n[0] + dz * n[1]
      const par = Math.abs(dx * n[1]) + Math.abs(dz * n[0])
      if (!(perp < -0.15 && perp > -1.0) || par > 1.7) F.add('condenser is not on the outer face of the same wall', tag + ' ' + a.id + ' perp=' + perp.toFixed(2) + ' par=' + par.toFixed(2))
      const onExterior = res.walls.some((p: any) => p.exterior && p.floor === a.floor && p.sides.includes(a.room) && (p.axis === 'u' ? Math.abs(p.v0 - a.z) < 0.45 && a.x >= p.u0 - 0.01 && a.x <= p.u1 + 0.01 : Math.abs(p.u0 - a.x) < 0.45 && a.z >= p.v0 - 0.01 && a.z <= p.v1 + 0.01))
      if (!onExterior) F.add('ac unit off an exterior wall', tag + ' ' + a.id)
    }
  }
  for (const c of condensers) if (!ac.some((a: any) => a.par === c.id)) F.add('orphan condenser', tag + ' ' + c.id)
  if (style === 'mid' || style === 'high') if (!ac.length && res.rooms.some((r: any) => r.type === 'bedroom')) F.add('mid/high without ac', tag)
  for (const q of res.items.filter((m: any) => m.category === 'picture')) {
    const yc = q.y + q.h / 2
    if (yc < 1.4 - 1e-6 || yc > 1.7 + 1e-6) F.add('picture outside 1.4-1.7 m', tag + ' ' + q.id + ' yc=' + yc.toFixed(2))
    for (const j of res.windows) if (j.floor === q.floor && overlap(q.aabb, openingRect(j), 0.001)) F.add('picture over a window', tag + ' ' + q.id + ' ' + j.id)
    for (const p of res.doors) if (p.floor === q.floor && overlap(q.aabb, openingRect(p), 0.001)) F.add('picture over a door', tag + ' ' + q.id + ' ' + p.id)
  }
  for (const c of res.rooms) if (!NO_LIGHT_ROOMS.has(c.type) && !res.items.some((m: any) => m.room === c.id && m.category === 'ceiling_light')) F.add('room without ceiling_light', tag + ' ' + c.id)
  for (const m of res.items.filter((m: any) => m.category === 'curtain')) if (!res.windows.some((j: any) => j.id === m.window)) F.add('curtain without window', tag + m.id)
  if (res.style !== 'budget') for (const j of res.windows) if (!res.items.some((m: any) => m.category === 'curtain' && m.window === j.id) && res.style !== 'commercial') F.add('window without curtain (mid/high)', tag + ' ' + j.id)
  for (const m of res.items.filter((m: any) => m.category === 'ceiling_light')) {
    const ceiling = res.rooms.find((c: any) => c.id === m.room).ceiling
    if (m.y + m.h > ceiling + 1e-6) F.add('light above the ceiling', tag + m.id)
  }
  for (const m of res.items.filter((m: any) => m.category === 'plant' && m.type === 'table_plant')) {
    const parent = res.items.find((p: any) => p.id === m.supportId)
    if (!parent || m.x < parent.aabb[0] - 0.01 || m.x > parent.aabb[2] + 0.01 || m.z < parent.aabb[1] - 0.01 || m.z > parent.aabb[3] + 0.01) F.add('table_plant outside its support', tag + m.id)
  }
}

function checkGround(tag: string, res: Plan, F: Failures) {
  if (!res.lot) return
  for (const z of res.lot.zones) {
    const pieces = res.items.filter((m: any) => m.category === 'ground_cover' && m.zone === z.id && m.layer === 0)
    const areaZ = z.parts.reduce((s: number, p: Rect) => s + (p[2] - p[0]) * (p[3] - p[1]), 0)
    const areaP = pieces.reduce((s: number, m: any) => s + Math.abs(m.polygon[2][0] - m.polygon[0][0]) * Math.abs(m.polygon[2][1] - m.polygon[0][1]), 0)
    if (Math.abs(areaZ - areaP) > 0.05 || pieces.length !== z.parts.length) F.add('ground cover does not fill the zone', tag + ' ' + z.id + ' ' + areaZ.toFixed(1) + ' vs ' + areaP.toFixed(1))
    for (const m of pieces) if (!['lawn', 'tile_floor', 'concrete', 'deck_floor', 'dirt'].includes(m.type) || m.type !== z.ground) F.add('ground cover type', tag + m.id)
    for (const m of res.items.filter((m: any) => m.category === 'ground_cover' && m.zone === z.id && m.layer === 1)) {
      const b = m.aabb
      if (!z.parts.some((p: Rect) => b[0] >= p[0] - 0.02 && b[1] >= p[1] - 0.02 && b[2] <= p[2] + 0.02 && b[3] <= p[3] + 0.02)) F.add('overlay outside the zone', tag + m.id)
    }
  }
}

function checkState(tag: string, res: Plan, F: Failures) {
  const E: any[] = res.stateItems
  const state = res.state
  const find = (x: string) => res.items.find((m: any) => m.id === x)
  const ofType = (t: string) => E.filter((e) => e.type === t)
  if (!['fortified', 'abandoned', 'normal'].includes(state)) F.add('invalid state', tag)
  const blocked = res.doors.filter((p: any) => p.blocked)
  const open = res.doors.filter((p: any) => p.open)
  const boarded = res.windows.filter((j: any) => j.boards)
  if (state === 'normal') {
    if (E.length || blocked.length || open.length || boarded.length || res.items.some((m: any) => m.barricade || m.ransacked || m.doorOpen)) F.add('normal with state marks', tag)
    return
  }
  if (state === 'fortified') {
    if (open.length || res.items.some((m: any) => m.ransacked || m.doorOpen) || (res.lot && res.lot.gates.some((g: any) => g.open))) F.add('fortified with abandonment marks', tag)
    for (const t of ofType('window_boards')) { const j = res.windows.find((x: any) => x.id === t.window); if (!j || !j.boards) F.add('boards without window', tag + t.id) }
    if (boarded.length !== ofType('window_boards').length) F.add('boarded windows != items', tag)
    if (!boarded.length && res.windows.length) F.add('fortified without boards', tag)
    for (const b of ofType('barricade')) {
      const p = res.doors.find((x: any) => x.id === b.door)
      const it = find(b.item)
      if (!p || !p.exterior || p.floor !== 0 || !p.blocked) F.add('barricade without a blocked exterior door', tag + b.id)
      else if (!it || !it.barricade || !p.zones.some((z: Rect) => overlap(it.aabb, z, 0.001))) F.add('barricade away from the door', tag + b.id)
      else if (!HEAVY.has(it.category)) F.add('barricade with a light item', tag + it.type)
    }
    if (blocked.length !== ofType('barricade').length) F.add('blocked doors != barricades', tag)
    if (res.doors.some((p: any) => { const c = res.rooms.find((q: any) => q.id === p.a); return p.exterior && p.side === 'front' && p.model !== 'steel' && p.width <= 2.0 && c && (c.u1 - c.u0) * (c.v1 - c.v0) >= 6 }) && !blocked.length) F.add('fortified without a barricade on the front door', tag)
    if (res.lot) {
      if (res.lot.gates.some((g: any) => g.type !== 'cargo') && !ofType('sandbags').length) F.add('fortified without sandbags', tag)
      for (const s of ofType('sandbags')) { const g = res.lot.gates.find((x: any) => x.id === s.gate); if (!g || Math.hypot(s.x - g.u, s.z - g.v) > 4) F.add('sandbags far from the gate', tag + s.id) }
      for (const t of ['barbed_wire', 'razor_wire']) for (const a of ofType(t)) { const seg = res.lot.perimeter.find((x: any) => x.id === a.perimeter); if (!seg || seg.top !== t) F.add('wall top mismatch', tag + a.id) }
      if (res.lot.perimeter.some((s: any) => s.type !== 'railing') && !E.some((e) => e.type === 'barbed_wire' || e.type === 'razor_wire')) F.add('fortified without barbed or razor wire', tag)
    }
    if (!ofType('floor_mattress').length && res.rooms.some((c: any) => c.floor === 0 && ['bedroom', 'living'].includes(c.type))) F.add('fortified without floor_mattress', tag)
    if (!E.some((e) => e.category === 'stockroom')) F.add('fortified without stock', tag)
    if (!E.some((e) => e.category === 'lantern')) F.add('fortified without lantern/candles', tag)
  } else {
    if (blocked.length || boarded.length || res.items.some((m: any) => m.barricade) || E.some((e) => ['barricade', 'window_boards', 'sandbags', 'floor_mattress'].includes(e.type))) F.add('abandoned with protection marks', tag)
    const pa = ofType('open_doors')[0]
    if (!pa || !pa.doors.length || pa.doors.some((i: string) => !res.doors.find((p: any) => p.id === i && p.open)) || open.length !== pa.doors.length) F.add('open_doors inconsistent', tag)
    const gv = ofType('ransacked_drawers')[0]
    if (gv && gv.items.some((i: string) => !find(i) || !find(i).ransacked)) F.add('ransacked_drawers inconsistent', tag)
    if (!ofType('open_suitcases').length && res.rooms.some((c: any) => c.type === 'bedroom')) F.add('abandoned without open_suitcases', tag)
    if (ofType('clothes_on_floor').length < 2) F.add('abandoned with few clothes_on_floor', tag)
    const nm = ofType('blood_stains').length
    if (nm < 2 || nm > 4) F.add('blood_stains outside 2-4', tag + ' ' + nm)
    const cars = res.items.filter((m: any) => m.category === 'car')
    if (cars.length && !cars.some((c: any) => c.doorOpen)) F.add('abandoned without an open-door car', tag)
    if (res.lot && res.lot.gates.some((g: any) => g.type !== 'cargo') && !res.lot.gates.some((g: any) => g.open)) F.add('abandoned without an open gate', tag)
    if (!ofType('fallen_chair').length) F.add('abandoned without fallen_chair', tag)
  }
}

function checkStairs(tag: string, res: Plan, F: Failures) {
  if (res.floors.length < 2) return
  const stairs = res.items.filter((m: any) => m.type === 'stairs')
  const rooms = res.rooms.filter((c: any) => c.type === 'stairs')
  for (let a = 0; a < res.floors.length - 1; a++) if (!rooms.some((r: any) => r.floor === a)) F.add('floor without stairs', tag + ' floor ' + a)
  if (!rooms.some((r: any) => r.floor === res.floors.length - 1)) F.add('top floor without landing', tag)
  for (const r of rooms) if (r.floor > 0) {
    const base = rooms.find((x: any) => x.floor === 0)
    if (!base || Math.abs(base.u0 - r.u0) > 1e-6 || Math.abs(base.v0 - r.v0) > 1e-6 || Math.abs(base.u1 - r.u1) > 1e-6 || Math.abs(base.v1 - r.v1) > 1e-6) F.add('stairs misaligned', tag + ' ' + r.id)
  }
  for (const e of stairs) { const base = stairs.find((x: any) => x.floor === 0); if (Math.abs(base.x - e.x) > 1e-6 || Math.abs(base.z - e.z) > 1e-6) F.add('stairs item misaligned', tag) }
  for (const e of stairs) {
    const r = rectOf(e)
    const f = [e.frontU, e.frontV]
    const land = f[1] === 1 ? [r[0], r[3], r[2], r[3] + 1] : f[1] === -1 ? [r[0], r[1] - 1, r[2], r[1]] : f[0] === 1 ? [r[2], r[1], r[2] + 1, r[3]] : [r[0] - 1, r[1], r[0], r[3]]
    for (const m of res.items.filter((m: any) => m.floor === e.floor && isSolid(m) && m !== e && !m.barricade)) if (overlap(rectOf(m), land)) F.add('stairs landing blocked', tag + ' ' + m.id)
    for (const m of res.stateItems.filter((m: any) => m.aabb && m.floor === e.floor && m.category !== 'barricade' && m.category !== 'car' && !NON_SOLID_MOUNTS.has(m.mount) && !m.flat)) if (overlap(m.aabb, land)) F.add('stairs landing blocked (state)', tag + ' ' + m.id)
  }
  const adj: Record<string, Set<string>> = {}
  const link = (a: string, b: string) => { (adj[a] = adj[a] || new Set()).add(b); (adj[b] = adj[b] || new Set()).add(a) }
  for (const p of res.doors) if (p.b !== 'outside') link(p.a, p.b)
  for (const [a, b] of res.openPairs) if (res.rooms.some((c: any) => c.id === a) && res.rooms.some((c: any) => c.id === b)) link(a, b)
  for (const r of rooms) for (const q of rooms) if (r !== q && Math.abs(r.floor - q.floor) === 1) link(r.id, q.id)
  const start = res.doors.find((p: any) => p.exterior && p.floor === 0)
  if (!start) return
  const seen = new Set<string>([start.a])
  const queue = [start.a]
  for (let h = 0; h < queue.length; h++) for (const n of adj[queue[h]] || []) if (!seen.has(n)) { seen.add(n); queue.push(n) }
  for (const c of res.rooms) if (c.type !== 'void' && !seen.has(c.id)) F.add('unreachable room', tag + ' ' + c.id)
}

export function checkPlan(name: string, res: Plan, seed: number, seen: Set<string>, F: Failures) {
  const tag = name + '/' + res.state + '#' + seed
  if (res.missing.length) F.add('required item missing', tag + ' ' + JSON.stringify(res.missing))
  const items = res.items.filter(isSolid)
  const stateSolid = res.stateItems.filter((e: any) => e.aabb && e.category !== 'barricade' && e.category !== 'car' && !NON_SOLID_MOUNTS.has(e.mount))
  const all = items.concat(stateSolid)
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i].floor === all[j].floor && overlap(rectOf(all[i]), rectOf(all[j]))) F.add('overlap', tag + ' ' + all[i].id + ' x ' + all[j].id)
  for (const m of res.items.filter((m: any) => m.on)) {
    const parent = res.items.find((p: any) => p.room === m.room && p.slot === m.on)
    if (!parent) F.add('on without a parent', tag + ' ' + m.id)
    else {
      const a = rectOf(m)
      const b = rectOf(parent)
      if (a[0] < b[0] - 0.02 || a[1] < b[1] - 0.02 || a[2] > b[2] + 0.02 || a[3] > b[3] + 0.02) F.add('on outside the parent', tag + ' ' + m.id)
    }
  }
  for (const m of all) {
    const r = rectOf(m)
    for (const a of openingsOf(res, m.outdoor ? -1 : m.floor)) if (!m.barricade && !a.blocked && openingZone(a).some((z) => overlap(r, z))) F.add('door blocked', tag + ' ' + m.id + ' at ' + a.id)
    if (m.barricade) {
      const bl = res.doors.filter((p: any) => p.floor === m.floor && p.blocked)
      for (const a of res.doors.filter((p: any) => p.floor === m.floor && !p.blocked)) if (openingZone(a).some((z) => overlap(r, z))) F.add('barricade covers another door', tag + ' ' + m.id)
      if (!bl.length) F.add('barricade without a blocked door', tag)
    }
  }
  for (const m of all) {
    const r = rectOf(m)
    const cat = CATALOG[m.type]
    for (const j of res.windows) {
      if (j.floor !== (m.outdoor ? 0 : m.floor)) continue
      if (!m.outdoor && j.room !== m.room) continue
      const tall = m.h > 1.0 || !(cat && cat.window)
      if (tall && overlap(r, windowZone(j, m.outdoor)) && !m.barricade) F.add('tall item under a window', tag + ' ' + m.id + ' x ' + j.id)
    }
  }
  for (const c of res.rooms) {
    const its = all.filter((m: any) => m.room === c.id).map(rectOf)
    if (['void', 'elevator'].includes(c.type)) continue
    const e = pathCheck(c.parts, c.floor, res, its)
    if (e) F.add('path', tag + ' ' + c.id + ': ' + e)
  }
  if (res.lot) for (const z of res.lot.zones) {
    const its = all.filter((m: any) => m.room === z.id).map(rectOf)
    const e = pathCheck(z.parts, -1, res, its)
    if (e) F.add('path (lot)', tag + ' ' + z.id + ': ' + e)
  }
  if (res.lot) {
    const L = res.lot
    for (const g of L.gates) {
      const clear = !L.perimeter.some((s: any) => s.side === g.side && s.v0 === g.v && s.v1 === g.v && Math.min(s.u0, s.u1) < g.u && Math.max(s.u0, s.u1) > g.u)
      if (!clear) F.add('gate on a wall', tag + ' ' + g.id)
      if (g.u - g.width / 2 < L.rect[0] - 1e-6 || g.u + g.width / 2 > L.rect[2] + 1e-6) F.add('gate outside the lot', tag + ' ' + g.id)
      if (g.type === 'pedestrian' && g.width !== 1.0) F.add('pedestrian gate width', tag)
      if ((g.type === 'garage' || g.type === 'cargo') && g.width < 3.0) F.add('vehicle gate width', tag)
    }
    for (const c of L.paths) {
      for (const m of all) if (m.outdoor && c.rects.some((z: Rect) => overlap(rectOf(m), z))) F.add('path blocked', tag + ' ' + c.id + ' by ' + m.id)
      const g = L.gates.find((x: any) => x.id === c.from)
      const pt = res.doors.find((x: any) => x.id === c.to)
      // a building at the street line has no pedestrian gate: its entrance path starts at the door (`from` is null)
      if ((!g && c.from != null) || !pt) { F.add('path without ends', tag + c.id); continue }
      const inside = (rs: Rect[], u: number, v: number) => rs.some((r) => u >= r[0] - 1e-6 && u <= r[2] + 1e-6 && v >= r[1] - 1e-6 && v <= r[3] + 1e-6)
      // a path of an exterior door may reach its gate through the paths it touches or through the parking zone (they are paved too)
      const reached: Rect[] = c.rects.slice()
      const pool: Rect[] = L.paths.filter((o: any) => o !== c).flatMap((o: any) => o.rects).concat(L.zones.filter((z: any) => z.id === 'parking').flatMap((z: any) => z.parts))
      for (let grew = true; grew; ) {
        grew = false
        for (const r of pool) if (!reached.includes(r) && reached.some((a) => a[0] <= r[2] + 1e-6 && a[2] >= r[0] - 1e-6 && a[1] <= r[3] + 1e-6 && a[3] >= r[1] - 1e-6)) { reached.push(r); grew = true }
      }
      if ((g && !inside(reached, g.u, g.v)) || !inside(c.rects, pt.u, pt.v)) F.add('path does not join gate and door', tag + ' ' + c.id)
      const joined: Rect[] = [c.rects[0]]
      const rest: Rect[] = c.rects.slice(1)
      let progress = true
      while (rest.length && progress) {
        progress = false
        for (let i = 0; i < rest.length; i++) if (joined.some((a) => a[0] <= rest[i][2] + 1e-6 && a[2] >= rest[i][0] - 1e-6 && a[1] <= rest[i][3] + 1e-6 && a[3] >= rest[i][1] - 1e-6)) { joined.push(rest.splice(i, 1)[0]); progress = true; break }
      }
      if (rest.length) F.add('path is not continuous', tag + ' ' + c.id)
    }
    for (const s of L.perimeter) {
      if (!(s.height > 0) || !['none', 'glass', 'razor_wire', 'railing', 'barbed_wire'].includes(s.top) || !['wall', 'fence', 'railing'].includes(s.type)) F.add('invalid perimeter', tag + ' ' + s.id)
      if (s.type === 'wall' && !(s.height >= 1.7)) F.add('low wall', tag)
    }
    const pools = res.items.filter((m: any) => m.category === 'pool')
    if (L.pool && !pools.length) F.add('pool missing', tag)
    for (const pool of pools) {
      const pr = rectOf(pool)
      const ring = [pr[0] - 1, pr[1] - 1, pr[2] + 1, pr[3] + 1]
      const yard = L.zones.find((z: any) => z.id === pool.room)
      if (!yard || !insideAny(yard.parts, ring[0] + 1e-3, ring[1] + 1e-3) || !insideAny(yard.parts, ring[2] - 1e-3, ring[3] - 1e-3)) F.add('pool ring outside the yard', tag)
      for (const m of all) if (m !== pool && !(CATALOG[m.type] || {}).deck && m.floor === pool.floor && overlap(rectOf(m), ring)) F.add('item in the pool ring', tag + ' ' + m.id)
      for (const m of all) if (m !== pool && overlap(rectOf(m), pr)) F.add('item inside the pool', tag + ' ' + m.id)
    }
  }
  checkDecor(tag, res, F)
  checkGround(tag, res, F)
  checkState(tag, res, F)
  checkStairs(tag, res, F)
  for (const m of res.items) {
    if (m.color == null) F.add('item without colour', tag + m.id)
    else if (typeof m.color === 'string' && !(m.color in res.colors)) F.add('colour role missing in the palette', tag + m.id + ' ' + m.color)
  }
  seen.add(res.items.filter((m: any) => !m.decor).map((m: any) => m.room + ':' + m.slot + '=' + m.type).sort().join('|'))
}

/** Odd seeds use random lot sizes inside the template limits, as the old harness did. */
export function sizes(id: string, s: number, opts: Record<string, unknown>) {
  if (s % 2 === 0) return {}
  const r = engine.createRng(s, 'medidas')
  const L = engine.limitsOf(id, opts).limits
  return { w: Math.round((L.w[0] + r() * (L.w[1] - L.w[0])) * 2) / 2, d: Math.round((L.d[0] + r() * (L.d[1] - L.d[0])) * 2) / 2 }
}

/** Template variants exercised by the suite: [name, template id, extra options]. */
export function variants(): [string, string, Record<string, unknown>][] {
  const out: [string, string, Record<string, unknown>][] = []
  for (const t of engine.listTemplates()) {
    if (t.id === 'apartment_modern') out.push([t.id + '[mid]', t.id, { tier: 'mid' }], [t.id + '[high]', t.id, { tier: 'high' }])
    else if (t.id === 'mansion') out.push([t.id + '[3]', t.id, {}], [t.id + '[2]', t.id, { floors: 2 }], [t.id + '[1]', t.id, { floors: 1 }], [t.id + '[3+elevator]', t.id, { floors: 3, elevator: true }])
    else if (t.id === 'high_end_contemporary') out.push([t.id + '[2]', t.id, {}], [t.id + '[3]', t.id, { floors: 3 }])
    else if (t.id === 'mid_modern_townhouse') out.push([t.id + '[2]', t.id, {}], [t.id + '[3]', t.id, { floors: 3 }])
    else out.push([t.id, t.id, {}])
  }
  return out
}
