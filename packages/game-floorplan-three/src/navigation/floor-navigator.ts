/*
 * Floor navigator: walking on several floors of a house (stairs, banisters, path field, occlusion). Literal port of the team's AndaresSDK
 * (sdk/andares), with English names. Coordinates are the house's. The ground floor can keep using the game's own grid: `blocked` answers -1
 * ("use the ground grid") unless the house is registered with `own: true`.
 *
 * House: { id, floors: [{ y, h, solids: [[x0, z0, x1, z1], ...] }], stairs: [[x0, z0, x1, z1, from, to, axis], ...], groups: [obj | [obj] ...], roof }
 *  - a stair climbs from x0/z0 to x1/z1 (x0 > x1 reverses); stairs with the same footprint become a U-turn (one lane for each flight).
 *  - groups[f] = what is drawn of floor f (an Object3D with .visible, or a function show(bool)); roof the same.
 *
 * Additions over the team's code (spec 001, T2.4d): `openCells` and `closeCells` change the fine grid at run time, so a breach (stage 2) opens the
 * cells of a wall and a slab that collapses or fractures removes the cells of its floor (`bindNavigator`, ./bind.ts).
 */

/** A rectangle `[x0, z0, x1, z1]` in the house's coordinates. */
export type NavRect = [number, number, number, number]
/** `[x0, z0, x1, z1, from, to, axis]`: a flight from floor `from` to floor `to` along `axis`. */
export type NavStair = [number, number, number, number, number, number, 'x' | 'z']

export interface NavFloor {
  /** Absolute height of the floor level. */
  y: number
  /** Height of the storey. */
  h: number
  solids?: NavRect[]
}

export interface NavHouseDef {
  id: string
  floors: NavFloor[]
  stairs?: NavStair[]
  groups?: unknown[]
  roof?: unknown
  /** The fine grid also rules the ground floor inside the house (default: the ground floor uses the game's grid, except stairs and banisters). */
  own?: boolean
  /** The house's rectangle (default: the union of its solids and stairs). */
  rect?: NavRect
}

/** A shape on the plan: a rectangle `[x0, z0, x1, z1]` or a circle `[cx, cz, radius]`. */
export type NavShape = { rect: NavRect } | { circle: [number, number, number] }

export interface NavResult {
  y: number
  floor: number
  dx: number
  dz: number
  t: number
  stair: NavFlight | null
}

export interface NavFlight {
  x0: number; z0: number; x1: number; z1: number
  axis: 0 | 1
  from: number
  to: number
  group: any
  yFrom: number
  yTo: number
  dir: number
  lo: number
  len: number
  e: number
}

export interface NavHouse {
  id: string
  own: boolean
  floors: NavFloor[]
  groups: unknown[]
  roof: unknown
  flights: NavFlight[]
  grids: Uint8Array[]
  fields: any[]
  /** Triples (floor, cell, previous value) of the run-time changes of the grid. */
  journal: number[]
  shown: number
  x0: number; z0: number; x1: number; z1: number
  ox: number; oz: number; nx: number; nz: number
  n: number
}

const CELL = 0.1 // fine cell, 10 cm
const COARSE = 2 // coarse cell of the path field = 2 x 2 fine ones
const OPEN_END = 0.7 // at the ends, the side stays open for 0.7 m (entry/exit by the side)
const SLACK = 0.45 // flat stretch at the ends of a stair (m): there one can enter and leave by the sides
const SOLID = 1
const FREE = 2 // forced free (inside the stair)
const VOID = 4 // no floor (a collapsed slab)
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

export function createFloorNavigator() {
  const N: any = { houses: [] as NavHouse[], x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9, currentHouse: null as NavHouse | null, currentFloor: 0, time: 0, result: { y: 0, floor: 0, dx: 0, dz: 0, t: 0, stair: null } as NavResult }

  // ----- fine grid of a floor: bit 1 solid, bit 2 forced free (inside the stair), bit 4 no floor -----
  function paint(c: NavHouse, g: Uint8Array, x0: number, z0: number, x1: number, z1: number, v: number) {
    const i0 = Math.max(0, Math.ceil((x0 - c.ox) / CELL - 0.5)), i1 = Math.min(c.nx - 1, Math.floor((x1 - c.ox) / CELL - 0.5))
    const j0 = Math.max(0, Math.ceil((z0 - c.oz) / CELL - 0.5)), j1 = Math.min(c.nz - 1, Math.floor((z1 - c.oz) / CELL - 0.5))
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { if (v === FREE) g[j * c.nx + i] = FREE; else g[j * c.nx + i] |= v }
  }

  function register(def: NavHouseDef): NavHouse {
    const c: NavHouse = { id: def.id, own: !!def.own, floors: def.floors, groups: def.groups || [], roof: def.roof || null, flights: [], grids: [], fields: [], journal: [], shown: -2, x0: 0, z0: 0, x1: 0, z1: 0, ox: 0, oz: 0, nx: 0, nz: 0, n: def.floors.length }
    // the house's rectangle: union of the solids and stairs of all floors (or the given one)
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9
    const env = (r: any) => { x0 = Math.min(x0, r[0], r[2]); z0 = Math.min(z0, r[1], r[3]); x1 = Math.max(x1, r[0], r[2]); z1 = Math.max(z1, r[1], r[3]) }
    if (def.rect) env(def.rect); else { for (const a of def.floors) for (const s of a.solids || []) env(s); for (const e of def.stairs || []) env(e) }
    c.x0 = x0; c.z0 = z0; c.x1 = x1; c.z1 = z1
    c.ox = x0 - 0.5; c.oz = z0 - 0.5; c.nx = Math.ceil((x1 - x0 + 1) / CELL); c.nz = Math.ceil((z1 - z0 + 1) / CELL)
    // stairs: groups the ones with the same footprint; each flight takes a lane and the odd ones climb backwards (U-turn)
    const groups: any[] = []
    for (const e of def.stairs || []) {
      const r = [Math.min(e[0], e[2]), Math.min(e[1], e[3]), Math.max(e[0], e[2]), Math.max(e[1], e[3])], ax = e[6] === 'z' ? 1 : 0, inv = ax ? e[3] < e[1] : e[2] < e[0]
      let g = groups.find((q) => q.ax === ax && Math.abs(q.r[0] - r[0]) < 0.08 && Math.abs(q.r[1] - r[1]) < 0.08 && Math.abs(q.r[2] - r[2]) < 0.08 && Math.abs(q.r[3] - r[3]) < 0.08)
      if (!g) groups.push((g = { ax, r, m: [] }))
      g.m.push({ from: e[4], to: e[5], inv })
    }
    for (const g of groups) {
      g.m.sort((a: any, b: any) => a.from - b.from)
      const k = g.m.length, lat = g.ax ? 0 : 1 // lateral axis
      g.m.forEach((m: any, q: number) => {
        const r = g.r.slice(), l0 = g.r[lat], w = (g.r[lat + 2] - l0) / k
        r[lat] = l0 + w * q; r[lat + 2] = l0 + w * (q + 1)
        const s: NavFlight = { x0: r[0], z0: r[1], x1: r[2], z1: r[3], axis: g.ax, from: m.from, to: m.to, group: g, yFrom: def.floors[m.from].y, yTo: def.floors[m.to].y, dir: 0, lo: 0, len: 0, e: 0 }
        s.dir = q & 1 ? (m.inv ? 1 : -1) : m.inv ? -1 : 1 // direction of the axis when climbing
        s.lo = g.ax ? r[1] : r[0]; s.len = (g.ax ? r[3] : r[2]) - s.lo; s.e = Math.min(0.3, SLACK / s.len)
        c.flights.push(s)
      })
    }
    // fine grid per floor
    for (let a = 0; a < c.n; a++) {
      const g = new Uint8Array(c.nx * c.nz); c.grids.push(g)
      for (const s of def.floors[a].solids || []) paint(c, g, Math.min(s[0], s[2]), Math.min(s[1], s[3]), Math.max(s[0], s[2]), Math.max(s[1], s[3]), SOLID)
    }
    // banister: sides and caps closed, except at the open ends of that floor; inside of the stair free
    const T = 0.22
    for (const g of groups) {
      const [rx0, rz0, rx1, rz1] = g.r, ax = g.ax, lo = ax ? rz0 : rx0, hi = ax ? rz1 : rx1, len = hi - lo, f = Math.min(OPEN_END, len * 0.3)
      const pe = (a0: number, b0: number, a1: number, b1: number, grd: Uint8Array, v = SOLID) => (ax ? paint(c, grd, b0, a0, b1, a1, v) : paint(c, grd, a0, b0, a1, b1, v)) // (axis, lateral)
      const l0 = ax ? rx0 : rz0, l1 = ax ? rx1 : rz1
      const floors = new Set<number>(); for (const m of g.m) { floors.add(m.from); floors.add(m.to) }
      for (const a of floors) pe(lo, l0, hi, l1, c.grids[a], FREE) // inside of the stair free
      for (const a of floors) {
        const grd = c.grids[a]
        // open end on the axis: base (lowest coordinate) or top; depends on the direction of each flight
        let openLo = false, openHi = false
        for (const s of c.flights) if (s.group === g) {
          const baseLo = s.dir > 0 // the base is at the lowest coordinate
          if (s.from === a) { if (baseLo) openLo = true; else openHi = true }
          if (s.to === a) { if (baseLo) openHi = true; else openLo = true }
        }
        // outer sides and dividers between lanes, outside the open-end zones
        const ini = openLo ? lo + f : lo - T, fim = openHi ? hi - f : hi + T
        pe(ini, l0 - T, fim, l0, grd); pe(ini, l1, fim, l1 + T, grd)
        const k = g.m.length; for (let q = 1; q < k; q++) { const lm = l0 + ((l1 - l0) * q) / k; pe(lo + f, lm - 0.05, hi - f, lm + 0.05, grd) }
        if (!openLo) pe(lo - T, l0, lo, l1, grd)
        if (!openHi) pe(hi, l0, hi + T, l1, grd)
      }
    }
    N.houses.push(c); N.x0 = Math.min(N.x0, x0); N.z0 = Math.min(N.z0, z0); N.x1 = Math.max(N.x1, x1); N.z1 = Math.max(N.z1, z1)
    return c
  }

  const houseAt = (x: number, z: number): NavHouse | null => {
    if (x < N.x0 || x > N.x1 || z < N.z0 || z > N.z1) return null
    for (let k = 0; k < N.houses.length; k++) { const c = N.houses[k]; if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1) return c }
    return null
  }
  // cell of the fine grid (value 0..7) or -1 outside the house
  const cell = (c: NavHouse, a: number, x: number, z: number): number => {
    const i = Math.floor((x - c.ox) / CELL), j = Math.floor((z - c.oz) / CELL)
    return i < 0 || j < 0 || i >= c.nx || j >= c.nz ? -1 : c.grids[a][j * c.nx + i]
  }
  // block per floor: 1 blocked, 0 free, -1 "use the ground grid" (floor 0 with nothing special there)
  function blocked(x: number, z: number, floor: number): number {
    const c = houseAt(x, z)
    if (!c) return floor > 0 ? 1 : -1
    if (floor >= c.n) return 1
    const v = cell(c, floor, x, z)
    if (v === FREE) return 0
    if (v >= 0 && v & VOID) return 1
    if (floor > 0 || c.own) return v < 0 || v & SOLID ? 1 : 0 // own: the fine grid of the house also rules the ground floor
    return v > 0 ? 1 : -1
  }
  // level: y and floor of the point, considering the stair. Returns true when it is on a stair (result in N.result)
  function level(x: number, z: number, floor: number): boolean {
    const r: NavResult = N.result, c = houseAt(x, z); r.stair = null
    if (!c) { r.floor = floor; r.y = 0; return false }
    for (let k = 0; k < c.flights.length; k++) {
      const s = c.flights[k]
      if ((floor !== s.from && floor !== s.to) || x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue
      let t = ((s.axis ? z : x) - s.lo) / s.len; if (s.dir < 0) t = 1 - t
      const u = clamp((t - s.e) / (1 - 2 * s.e), 0, 1)
      r.y = s.yFrom + (s.yTo - s.yFrom) * u; r.t = t; r.floor = t < 0.5 ? s.from : s.to; r.stair = s
      return true
    }
    r.floor = floor; r.y = c.floors[floor] ? c.floors[floor].y : 0
    return false
  }
  // point at an end of the stair, at the centre of the lane; inside > 0 towards the inside of the end, < 0 towards the outside
  function landing(s: NavFlight, top: boolean, inside: number, out: number[]): number[] {
    const lo = top ? s.dir < 0 : s.dir > 0, a = lo ? s.lo + inside : s.lo + s.len - inside, b = s.axis ? (s.x0 + s.x1) / 2 : (s.z0 + s.z1) / 2
    out[0] = s.axis ? b : a; out[1] = s.axis ? a : b
    return out
  }
  // stair that takes floor a to floor b (b > a climbs, b < a descends) in the house; null if there is none
  function stairTo(c: NavHouse, a: number, b: number): NavFlight | null {
    for (const s of c.flights) if (b > a ? s.from === a : s.to === a) return s
    return null
  }
  // ----- path field per floor (BFS on the coarse grid) to a point; recomputed only when the target changes cell -----
  function field(c: NavHouse, a: number) {
    const f = c.fields[a]; if (f) return f
    const gx = Math.ceil(c.nx / COARSE), gz = Math.ceil(c.nz / COARSE), free = new Uint8Array(gx * gz), g = c.grids[a]
    for (let j = 0; j < gz; j++) for (let i = 0; i < gx; i++) {
      let b = 0
      for (let q = 0; q < COARSE && !b; q++) for (let p = 0; p < COARSE; p++) {
        const ii = i * COARSE + p, jj = j * COARSE + q
        if (ii < c.nx && jj < c.nz) { const v = g[jj * c.nx + ii]; if (v === SOLID || v & VOID) { b = 1; break } }
      }
      free[j * gx + i] = b ? 0 : 1
    }
    return (c.fields[a] = { gx, gz, free, d: new Int16Array(gx * gz), q: new Int32Array(gx * gz), target: -1, t: -9 })
  }
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DZ = [0, 0, 1, -1, 1, -1, 1, -1]
  // direction (in N.result.dx/dz, unit) from (x,z) towards (tx,tz) walking on floor a; false if there is no path (go straight)
  function heading(c: NavHouse, a: number, x: number, z: number, tx: number, tz: number): boolean {
    const f = field(c, a), cs = CELL * COARSE
    const ci = clamp(Math.floor((tx - c.ox) / cs), 0, f.gx - 1), cj = clamp(Math.floor((tz - c.oz) / cs), 0, f.gz - 1), ca = cj * f.gx + ci
    if (ca !== f.target && N.time - f.t > 0.15) { // BFS from the target
      f.target = ca; f.t = N.time; f.d.fill(-1); let h = 0, e = 0; f.q[e++] = ca; f.d[ca] = 0
      while (h < e) {
        const k = f.q[h++], i = k % f.gx, j = (k / f.gx) | 0
        for (let n = 0; n < 8; n++) {
          const ni = i + DX[n], nj = j + DZ[n]; if (ni < 0 || nj < 0 || ni >= f.gx || nj >= f.gz) continue
          const nk = nj * f.gx + ni; if (f.d[nk] >= 0 || !f.free[nk]) continue
          if (n > 3 && (!f.free[j * f.gx + ni] || !f.free[nj * f.gx + i])) continue // a diagonal does not cut a corner
          f.d[nk] = f.d[k] + 1; f.q[e++] = nk
        }
      }
    }
    const i = Math.floor((x - c.ox) / cs), j = Math.floor((z - c.oz) / cs)
    if (i < 0 || j < 0 || i >= f.gx || j >= f.gz) return false
    const k0 = j * f.gx + i, r: NavResult = N.result
    let best = f.d[k0] >= 0 ? f.d[k0] : 1e9, bi = -1 // blocked cell (e.g. inside the stair): leaves by the neighbour closest to the target
    if (f.target < 0) return false
    for (let n = 0; n < 8; n++) {
      const ni = i + DX[n], nj = j + DZ[n]; if (ni < 0 || nj < 0 || ni >= f.gx || nj >= f.gz) continue
      const d = f.d[nj * f.gx + ni]; if (d < 0 || d >= best) continue
      if (n > 3 && (!f.free[j * f.gx + ni] || !f.free[nj * f.gx + i])) continue
      best = d; bi = n
    }
    if (bi < 0) return false
    const px = c.ox + (i + DX[bi] + 0.5) * cs, pz = c.oz + (j + DZ[bi] + 0.5) * cs, dx = px - x, dz = pz - z, l = Math.hypot(dx, dz) || 1
    r.dx = dx / l; r.dz = dz / l
    return true
  }
  // ceiling of a floor: the next floor's level minus the slab; on the last one, the storey height
  const ceilingOf = (c: NavHouse, a: number): number => (a + 1 < c.n ? c.floors[a + 1].y - 0.2 : c.floors[a].y + c.floors[a].h)
  // ray against the grids and the floor's ceiling: distance until it hits or -1
  function ray(c: NavHouse, a: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number {
    const top = ceilingOf(c, a)
    for (let s = 0.1; s <= max; s += 0.1) {
      const x = ox + dx * s, y = oy + dy * s, z = oz + dz * s
      if (y > top || y < c.floors[a].y) return s
      const v = cell(c, a, x, z); if (v < 0 || v === SOLID) return s
    }
    return -1
  }
  function apply(c: NavHouse, floor: number) {
    if (c.shown === floor) return
    c.shown = floor
    const show = (o: any, v: boolean) => { if (!o) return; if (typeof o === 'function') o(v); else if (Array.isArray(o)) o.forEach((q) => show(q, v)); else o.visible = v }
    for (let a = 0; a < c.groups.length; a++) show(c.groups[a], floor < 0 || a <= floor)
    show(c.roof, floor < 0)
  }
  // occlusion: hides the floors above whoever is inside, and the roof; outside, shows everything
  function occlude(x: number, z: number, floor: number): NavHouse | null {
    const c = houseAt(x, z)
    if (c !== N.currentHouse && N.currentHouse) apply(N.currentHouse, -1)
    N.currentHouse = c; N.currentFloor = floor
    if (c) apply(c, floor)
    return c
  }

  // ----- run-time changes of the grid (destruction) -----
  const houseOf = (id: string): NavHouse | null => N.houses.find((h: NavHouse) => h.id === id) || null
  /** Visits the cells of the fine grid inside `shape` on `floor`. Returns how many it visited. */
  function each(c: NavHouse, floor: number, shape: NavShape, fn: (g: Uint8Array, k: number) => void): number {
    const g = c.grids[floor]; if (!g) return 0
    let x0: number, z0: number, x1: number, z1: number
    const circle = 'circle' in shape ? shape.circle : null
    if (circle) { x0 = circle[0] - circle[2]; z0 = circle[1] - circle[2]; x1 = circle[0] + circle[2]; z1 = circle[1] + circle[2] } else [x0, z0, x1, z1] = (shape as { rect: NavRect }).rect
    const i0 = Math.max(0, Math.ceil((Math.min(x0, x1) - c.ox) / CELL - 0.5)), i1 = Math.min(c.nx - 1, Math.floor((Math.max(x0, x1) - c.ox) / CELL - 0.5))
    const j0 = Math.max(0, Math.ceil((Math.min(z0, z1) - c.oz) / CELL - 0.5)), j1 = Math.min(c.nz - 1, Math.floor((Math.max(z0, z1) - c.oz) / CELL - 0.5))
    let n = 0
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (circle) { const dx = c.ox + (i + 0.5) * CELL - circle[0], dz = c.oz + (j + 0.5) * CELL - circle[1]; if (dx * dx + dz * dz > circle[2] * circle[2]) continue }
      fn(g, j * c.nx + i); n++
    }
    return n
  }
  /** A wall or a banister opened (breach, fracture): the solid cells inside `shape` on `floor` become free. Returns the cells it visited. */
  function openCells(houseId: string, floor: number, shape: NavShape): number {
    const c = houseOf(houseId); if (!c) return 0
    const n = each(c, floor, shape, (g, k) => { if (g[k] !== FREE && g[k] & SOLID) { c.journal.push(floor, k, g[k]); g[k] &= ~SOLID } })
    c.fields[floor] = null
    return n
  }
  /** A slab collapsed or fractured: the cells inside `shape` on `floor` have no floor any more (blocked, and the path field avoids them). */
  function closeCells(houseId: string, floor: number, shape: NavShape): number {
    const c = houseOf(houseId); if (!c) return 0
    const n = each(c, floor, shape, (g, k) => { if (!(g[k] & VOID)) { c.journal.push(floor, k, g[k]); g[k] = (g[k] === FREE ? 0 : g[k]) | VOID } })
    c.fields[floor] = null
    return n
  }
  /** Puts the grid of the house back to what it was (after a world reset): undoes every `openCells` and `closeCells`. */
  function undoChanges(houseId: string): void {
    const c = houseOf(houseId); if (!c) return
    const j = c.journal
    for (let k = j.length - 3; k >= 0; k -= 3) { c.grids[j[k]][j[k + 1]] = j[k + 2]; c.fields[j[k]] = null }
    j.length = 0
  }

  return Object.assign(N, { register, houseAt, blocked, level, landing, stairTo, heading, ray, ceilingOf, occlude, cell, apply, houseOf, openCells, closeCells, undoChanges }) as FloorNavigator
}

export interface FloorNavigator {
  houses: NavHouse[]
  /** Frame time in seconds; the path field is recomputed at most every 0.15 s of it. */
  time: number
  currentHouse: NavHouse | null
  currentFloor: number
  /** Result of the last `level` and `heading` call (no allocation per query). */
  result: NavResult
  register(def: NavHouseDef): NavHouse
  houseAt(x: number, z: number): NavHouse | null
  blocked(x: number, z: number, floor: number): number
  level(x: number, z: number, floor: number): boolean
  landing(flight: NavFlight, top: boolean, inside: number, out: number[]): number[]
  stairTo(house: NavHouse, from: number, to: number): NavFlight | null
  heading(house: NavHouse, floor: number, x: number, z: number, tx: number, tz: number): boolean
  ray(house: NavHouse, floor: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number
  ceilingOf(house: NavHouse, floor: number): number
  occlude(x: number, z: number, floor: number): NavHouse | null
  cell(house: NavHouse, floor: number, x: number, z: number): number
  apply(house: NavHouse, floor: number): void
  houseOf(id: string): NavHouse | null
  openCells(houseId: string, floor: number, shape: NavShape): number
  closeCells(houseId: string, floor: number, shape: NavShape): number
  undoChanges(houseId: string): void
}
