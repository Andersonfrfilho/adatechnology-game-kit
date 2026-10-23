import { EPS } from './constants'
import { clearRect, extent, insideUnion, overlaps, r2, usableParts } from './geometry'
import { createGrid, reachable } from './grid'
import { blocksWindow, windowZone, windowsOfRoom, zonesOfFloor } from './queries'
import { CATALOG, SEED_KEYS } from './registry'
import { weightedOrder } from './rng'
import type { Rng } from './rng'
import type { ItemDef, Json, PlacedItem, Plan, Rect, Room, Slot, Vec2, Weights } from './types'

function candidatesOf(cats: Weights): { it: ItemDef; weight: number }[] {
  const out: { it: ItemDef; weight: number }[] = []
  for (const [cat, weight] of Object.entries(cats)) {
    const exact = cat[0] === '='
    const its = Object.values(CATALOG).filter((i) => !i.decor && (exact ? i.type === cat.slice(1) : i.category === cat || i.type === cat))
    for (const it of its) out.push({ it, weight: weight / its.length })
  }
  return out
}

function itemRect(slot: Slot, it: ItemDef, shift: number): Rect {
  const c = slot._cell
  const f: Vec2 = c.f
  const [extentU, extentV] = extent([it.w, it.d], f)
  const R: Rect = c.R
  // centre without rounding
  let u0 = (c.rect ? (c.rect[0] + c.rect[2]) / 2 : slot.x) - extentU / 2
  let v0 = (c.rect ? (c.rect[1] + c.rect[3]) / 2 : slot.z) - extentV / 2
  if (shift) {
    if (slot.side === 'left' || slot.side === 'right') v0 += shift
    else u0 += shift
  }
  for (const s of c.enclosed) {
    if (s === 'left') u0 = R[0]
    else if (s === 'right') u0 = R[2] - extentU
    else if (s === 'front') v0 = R[1]
    else if (s === 'back') v0 = R[3] - extentV
  }
  return [u0, v0, u0 + extentU, v0 + extentV]
}

const MESH_FRONT: Record<string, Vec2> = { '+z': [0, 1], '-z': [0, -1], '+x': [1, 0], '-x': [-1, 0] }

/** Rotation that makes a mesh whose front is `front` face `f`. */
export function rotationFor(f: Vec2, front: string): number {
  const meshFront = MESH_FRONT[front] || [0, 1]
  let ry = Math.atan2(f[0], f[1]) - Math.atan2(meshFront[0], meshFront[1])
  if (ry > Math.PI + EPS) ry -= 2 * Math.PI
  if (ry < -Math.PI - EPS) ry += 2 * Math.PI
  return r2(ry)
}

/** Fills the slots of one room with catalogue items, honouring clearances, doors, windows and reachability. */
export function fillRoom(plan: Plan, room: Room, slots: Slot[], rng: Rng): { items: PlacedItem[]; missing: { room: string; slot: string }[] } {
  const items: PlacedItem[] = []
  const missing: { room: string; slot: string }[] = []
  const state: Record<string, PlacedItem> = {}
  const solids: Rect[] = []
  const reserves: Rect[] = []
  const rims: Rect[] = []
  const inners = usableParts(room, 0)
  const grid = createGrid(plan, room)
  const zones = zonesOfFloor(plan, room.floor)
  const windowZones = windowsOfRoom(plan, room).map((j) => ({ z: windowZone(j, room.outdoor), j }))
  const inflation = room.outdoor ? 0.15 : 0.12
  interface Unit {
    group: string | null
    members: Slot[]
    required?: boolean
  }
  const units: Unit[] = []
  const seen: Record<string, Unit> = {}
  for (const s of slots) {
    if (s.group) {
      if (seen[s.group]) {
        seen[s.group].members.push(s)
        continue
      }
      const u: Unit = { group: s.group, members: [s] }
      seen[s.group] = u
      units.push(u)
    } else units.push({ group: null, members: [s] })
  }
  for (const u of units) u.required = u.members.some((m) => m.required)
  const queue = units.filter((u) => u.required).concat(units.filter((u) => !u.required))
  const dependencies = (u: Unit) =>
    u.members
      .flatMap((m) => [m.requires, m.on])
      .filter(Boolean)
      .filter((id) => slots.some((s) => s.id === id && !u.members.includes(s)))
  const done = new Set<string>()
  const ready = (u: Unit) => dependencies(u).every((id) => done.has(id as string))
  const make = (s: Slot, it: ItemDef, r: Rect, parent: PlacedItem | null) => {
    const f: Vec2 = [s.frontU, s.frontV]
    const id = room.id + '.' + s.id
    const m: Json = {
      id,
      type: it.type,
      category: it.category,
      x: r2((r[0] + r[2]) / 2),
      z: r2((r[1] + r[3]) / 2),
      ry: rotationFor(f, it.front),
      w: it.w,
      d: it.d,
      h: it.h,
      y: parent ? r2((parent.y || 0) + parent.h) : 0,
      frontU: f[0],
      frontV: f[1],
      room: room.id,
      floor: room.floor,
      outdoor: !!room.outdoor,
      slot: s.id,
      on: parent ? s.on : null,
      mode: parent ? (s.anchor === 'inside' ? 'inside' : 'on') : null,
      clearance: s.clearance,
      flat: it.flat,
      low: it.low,
      aabb: r.map(r2),
      _r: r,
      _seedId: SEED_KEYS.items[id] ?? id,
    }
    if (parent && s.anchor === 'inside') m.y = r2(parent.y || 0)
    if (room.link) m.link = { from: room.link[0], to: room.link[1] }
    state[s.id] = m
    items.push(m as PlacedItem)
    return m as PlacedItem
  }
  const tryFit = (s: Slot, relax: boolean): PlacedItem | null => {
    const cands = weightedOrder(candidatesOf(s.cats), rng)
    if (s.anchor === 'on' || s.anchor === 'inside') {
      const parent = state[s.on as string]
      if (!parent) return null
      for (const { it } of cands) {
        if (it.w > parent.w + EPS || it.d > parent.d + EPS) continue
        const f: Vec2 = [parent.frontU, parent.frontV]
        const r: Rect = parent.aabb
        const [extentU, extentV] = extent([it.w, it.d], f)
        const cu = (r[0] + r[2]) / 2 - f[0] * (parent.d / 2 - it.d / 2)
        const cv = (r[1] + r[3]) / 2 - f[1] * (parent.d / 2 - it.d / 2)
        return make(s, it, [cu - extentU / 2, cv - extentV / 2, cu + extentU / 2, cv + extentV / 2], parent)
      }
      return null
    }
    for (const { it } of cands) {
      if (it.w > s.w + EPS || it.d > s.d + EPS) continue
      const f: Vec2 = [s.frontU, s.frontV]
      const slide = s.anchor === 'wall' ? (s.slide == null ? 2.0 : s.slide) : 0
      const shifts = [0]
      for (let k = 1; k * 0.1 <= slide + 1e-9; k++) shifts.push(k * 0.1, -k * 0.1)
      let found: { rect: Rect; cl?: Rect | null; rimRect?: Rect | null } | null = null
      for (const shift of shifts) {
        const r = itemRect(s, it, shift)
        if (!insideUnion(r, inners)) continue
        if (it.flat) {
          found = { rect: r }
          break
        }
        if (zones.some((z) => overlaps(r, z))) continue
        if (windowZones.some(({ z, j }) => blocksWindow(it, j) && overlaps(r, z))) continue
        if (solids.some((o) => overlaps(r, o))) continue
        if (!it.deck && rims.some((a) => overlaps(r, a))) continue
        let cl: Rect | null = null
        if (!relax && s.clearance > 0 && !it.low) {
          cl = clearRect(r, f, s.clearance)
          if (!insideUnion(cl, inners)) continue
          if (items.some((m) => !m.low && !m.flat && !m.on && overlaps(cl as Rect, m._r))) continue
        }
        if (!it.low && reserves.some((q) => overlaps(r, q))) continue
        let rimRect: Rect | null = null
        if (it.rim) {
          rimRect = [r[0] - it.rim, r[1] - it.rim, r[2] + it.rim, r[3] + it.rim]
          if (!insideUnion(rimRect, inners) || solids.some((o) => overlaps(rimRect as Rect, o)) || zones.some((z) => overlaps(rimRect as Rect, z))) continue
        }
        if (!reachable(grid, solids.concat([r]), inflation)) continue
        found = { rect: r, cl, rimRect }
        break
      }
      if (!found) continue
      const { rect: r, cl, rimRect } = found
      if (it.flat) return make(s, it, r, null)
      const m = make(s, it, r, null)
      if (cl) reserves.push(cl)
      if (rimRect) rims.push(rimRect)
      solids.push(r)
      return m
    }
    return null
  }
  const process = (u: Unit) => {
    const pr = u.members[0].chance as number
    const x = rng()
    const arr = u.members.slice()
    const members: Slot[] = []
    while (arr.length) members.push(arr.splice(arr.length > 1 ? Math.floor(rng() * arr.length) : 0, 1)[0])
    const applicable = members.filter((m) => m.valid && (!m.requires || state[m.requires]) && (!m.on || state[m.on]))
    if (!u.required && x >= pr) return
    let ok = false
    for (const m of applicable) {
      if (tryFit(m, false)) {
        ok = true
        break
      }
    }
    if (!ok && u.required)
      for (const m of applicable) {
        if (tryFit(m, true)) {
          ok = true
          break
        }
      }
    if (!ok && u.required && (applicable.length || !u.members.some((m) => m.requires))) missing.push({ room: room.id, slot: u.group || u.members[0].id })
  }
  const pending = queue.slice()
  while (pending.length) {
    let i = pending.findIndex(ready)
    if (i < 0) i = 0
    const u = pending.splice(i, 1)[0]
    process(u)
    for (const m of u.members) done.add(m.id)
  }
  return { items, missing }
}
