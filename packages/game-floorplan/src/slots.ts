import { EPS, MARGIN, TOL } from './constants'
import { cardinal, clamp, eq, extent, inner, overlaps, r2 } from './geometry'
import { registries } from './registry'
import { isOpenSide, openingsOfFloor, windowsOfRoom, zonesOfFloor } from './queries'
import type { Json, Plan, Rect, Room, Slot, SlotDef, Vec2 } from './types'

const SIDE_NORMAL: Record<string, Vec2> = { left: [1, 0], right: [-1, 0], front: [0, 1], back: [0, -1] }
const FIXED_FACING: Record<string, Vec2> = { 'u+': [1, 0], 'u-': [-1, 0], 'v+': [0, 1], 'v-': [0, -1] }
const SIDE_OPPOSITE: Record<string, string> = { front: 'back', back: 'front', left: 'right', right: 'left' }
const WINDOW_SIDE: Record<string, string> = { front: 'front', back: 'back', left: 'left', right: 'right' }

/** Slot definitions of a room after `without`, `overrides`, `extras` and `any`/window expansion. */
export function slotDefsOf(plan: Plan, room: Room): SlotDef[] {
  const name = room.library || room.type
  const key = registries().LIBRARY_ALIAS[name] || name
  const library = room.slots ? room.slots : registries().LIBRARIES[key]
  if (!library) return []
  const R = inner(room.parts[0])
  let defs = typeof library === 'function' ? library({ w: R[2] - R[0], d: R[3] - R[1] }) : library.slice()
  defs = defs.map((x) => Object.assign({}, x))
  for (const id of room.without || []) defs = defs.filter((x) => x.id !== id)
  for (const [id, aj] of Object.entries(room.overrides || {})) {
    const i = defs.findIndex((x) => x.id === id)
    if (i < 0) continue
    if (aj === null) defs.splice(i, 1)
    else defs[i] = Object.assign(defs[i], aj)
  }
  defs.push(...(room.extras || []).map((x) => Object.assign({}, x)))
  const out: SlotDef[] = []
  for (const def of defs) {
    def.parent = def.on
    if (def.anchor === 'wall' && def.side === 'any') for (const l of ['left', 'right', 'front', 'back']) out.push(Object.assign({}, def, { id: def.id + '@' + l, side: l as SlotDef['side'], group: def.group || def.id }))
    else if (def.anchor === 'corner' && def.corner === 'any') for (const l of ['front-left', 'front-right', 'back-left', 'back-right']) out.push(Object.assign({}, def, { id: def.id + '@' + l, corner: l, group: def.group || def.id }))
    else if (def.anchor === 'window' && def.n == null) {
      const windowList = windowsOfRoom(plan, room)
      windowList.forEach((_j, i) => out.push(Object.assign({}, def, { id: def.id + '@w' + i, n: i, group: def.group || def.id })))
    } else out.push(def)
  }
  return out
}

export function resolveSlots(plan: Plan): Slot[] {
  const all: Slot[] = []
  for (const room of plan.rooms.concat(plan.zones)) {
    const defs = slotDefsOf(plan, room)
    const byId: Record<string, Slot> = {}
    // stairs: a door on any storey applies
    const zones = room.type === 'stairs' ? plan.floors.flatMap((_, floorIndex) => zonesOfFloor(plan, floorIndex)) : zonesOfFloor(plan, room.floor)
    for (const def of defs) {
      const s = resolveSlot(plan, room, def, byId, zones)
      byId[def.id] = s
      all.push(s)
    }
  }
  return all
}

export function resolveSlot(plan: Plan, room: Room, def: SlotDef, byId: Record<string, Slot>, zones: Rect[]): Slot {
  const base: Json = {
    id: def.id,
    room: room.id,
    floor: room.floor,
    outdoor: room.outdoor,
    anchor: def.anchor,
    side: def.side || def.corner || null,
    cats: def.cats,
    slide: def.slide,
    required: !!def.required,
    chance: def.required ? 1 : def.chance == null ? 1 : def.chance,
    clearance: def.clearance == null ? 0.5 : def.clearance,
    front: def.facing || 'center',
    group: def.group || null,
    requires: def.requires || null,
    on: def.parent || null,
    target: def.target || null,
    valid: true,
    reason: null,
  }
  const invalid = (m: string): Slot => Object.assign(base, { valid: false, reason: m, x: 0, z: 0, ry: 0, w: 0, d: 0, frontU: 0, frontV: 1, aabb: [0, 0, 0, 0], _cell: null }) as Slot
  if (def.anchor === 'on' || def.anchor === 'inside') {
    const parent = byId[def.parent]
    if (!parent || !parent.valid) return invalid('invalid_parent')
    return Object.assign(base, { x: parent.x, z: parent.z, ry: parent.ry, w: parent.w, d: parent.d, frontU: parent.frontU, frontV: parent.frontV, aabb: parent.aabb, _cell: parent._cell }) as Slot
  }
  const size = def.size as Vec2
  const roomCenter = ((): Vec2 => {
    const R0 = inner(room.parts[0])
    return [(R0[0] + R0[2]) / 2, (R0[1] + R0[3]) / 2]
  })()
  const openings = openingsOfFloor(plan, room.floor)
  let point: Vec2 = [0, 0]
  const targetPoint = (rule: string): Vec2 => {
    if (rule === 'door') {
      let best: Json = null
      let bestDist = 1e9
      for (const ab of openings) {
        const dist = Math.hypot(ab.u - point[0], ab.v - point[1])
        if (dist < bestDist) {
          bestDist = dist
          best = ab
        }
      }
      return best ? [best.u, best.v] : roomCenter
    }
    if (rule === 'target') {
      const t = byId[def.target as string]
      return t && t.valid ? [t.x, t.z] : roomCenter
    }
    return roomCenter
  }
  const free = (rect: Rect) => !!def.floorFree || !zones.some((z) => overlaps(rect, z, room.type === 'stairs' ? -0.011 : EPS))
  const rule: string = def.facing || 'center'
  let R = inner(room.parts[Math.min(def.part || 0, room.parts.length - 1)])
  if (def.anchor === 'wall' || def.anchor === 'window') {
    let side = def.side as string
    let a: number | null = null
    let win: Json = null
    if (def.anchor === 'window') {
      const windowList = windowsOfRoom(plan, room)
      win = windowList[def.n as number]
      if (!win) return invalid('no_window')
      side = room.outdoor ? SIDE_OPPOSITE[win.side] : WINDOW_SIDE[win.side]
      const cand = room.parts
        .map(inner)
        .find(
          (r) =>
            (win.axis === 'u' ? win.u >= r[0] - TOL && win.u <= r[2] + TOL : win.v >= r[1] - TOL && win.v <= r[3] + TOL) &&
            ((side === 'left' && eq(r[0], win.pos + MARGIN)) || (side === 'right' && eq(r[2], win.pos - MARGIN)) || (side === 'front' && eq(r[1], win.pos + MARGIN)) || (side === 'back' && eq(r[3], win.pos - MARGIN))),
        )
      if (!cand) return invalid('window_outside_room')
      R = cand
      a = win.axis === 'u' ? win.u : win.v
    }
    const n = SIDE_NORMAL[side]
    if (!n) return invalid('invalid_side')
    const horizontal = side === 'front' || side === 'back'
    const a0 = horizontal ? R[0] : R[1]
    const a1 = horizontal ? R[2] : R[3]
    const len = a1 - a0
    const depth = size[1]
    if (depth > (horizontal ? R[3] - R[1] : R[2] - R[0]) + EPS) return invalid('larger_than_room')
    const hw = Math.min(size[0], len) / 2
    const cell = (ac: number): Rect =>
      side === 'left' ? [R[0], ac - hw, R[0] + depth, ac + hw] : side === 'right' ? [R[2] - depth, ac - hw, R[2], ac + hw] : side === 'front' ? [ac - hw, R[1], ac + hw, R[1] + depth] : [ac - hw, R[3] - depth, ac + hw, R[3]]
    const nominal = a != null ? a : a0 + hw + (def.pos == null ? 0.5 : def.pos) * Math.max(0, len - 2 * hw) + (def.shift || 0)
    const wp = side === 'left' ? R[0] - MARGIN : side === 'right' ? R[2] + MARGIN : side === 'front' ? R[1] - MARGIN : R[3] + MARGIN
    const pa = clamp(nominal, a0 + hw, a1 - hw)
    let found: number | null = null
    const steps = [0]
    if (def.anchor !== 'window') for (let k = 1; k <= 60; k++) steps.push(k, -k)
    for (const k of steps) {
      const ac = pa + k * 0.05
      if (ac - hw < a0 - EPS || ac + hw > a1 + EPS) continue
      if (free(cell(ac))) {
        found = ac
        break
      }
    }
    if (found == null) return invalid('blocked_by_door')
    const sp: Vec2 = horizontal ? [found, wp - n[1] * 0.1] : [wp - n[0] * 0.1, found]
    if (isOpenSide(plan, room, sp[0], sp[1])) return invalid('open_wall')
    const rect = cell(found)
    return Object.assign(base, { side, x: r2((rect[0] + rect[2]) / 2), z: r2((rect[1] + rect[3]) / 2), frontU: n[0], frontV: n[1], ry: r2(Math.atan2(n[0], n[1])), w: size[0], d: size[1], aabb: rect.map(r2), _cell: { rect, f: n, enclosed: [side], R, size } }) as Slot
  }
  if (def.anchor === 'corner') {
    const [cornerV, cornerU] = (def.corner as string).split('-')
    const normalV = SIDE_NORMAL[cornerV]
    const normalU = SIDE_NORMAL[cornerU]
    if (!normalV || !normalU) return invalid('invalid_corner')
    const kx = cornerU === 'left' ? R[0] : R[2]
    const kz = cornerV === 'front' ? R[1] : R[3]
    point = [kx, kz]
    let f: Vec2
    if (FIXED_FACING[rule]) {
      f = FIXED_FACING[rule]
      if (!((f[0] === normalU[0] && f[1] === normalU[1]) || (f[0] === normalV[0] && f[1] === normalV[1]))) f = normalU
    } else {
      const t = targetPoint(rule)
      f = Math.abs(t[0] - kx) >= Math.abs(t[1] - kz) ? normalU : normalV
    }
    const [extentU, extentV] = extent(size, f)
    if (extentU > R[2] - R[0] + EPS || extentV > R[3] - R[1] + EPS) return invalid('larger_than_room')
    const rect: Rect = [cornerU === 'left' ? R[0] : R[2] - extentU, cornerV === 'front' ? R[1] : R[3] - extentV, cornerU === 'left' ? R[0] + extentU : R[2], cornerV === 'front' ? R[1] + extentV : R[3]]
    if (!free(rect)) return invalid('blocked_by_door')
    for (const sp of [[kx - normalU[0] * (MARGIN + 0.1), (rect[1] + rect[3]) / 2], [(rect[0] + rect[2]) / 2, kz - normalV[1] * (MARGIN + 0.1)]]) if (isOpenSide(plan, room, sp[0], sp[1])) return invalid('open_wall')
    return Object.assign(base, { x: r2((rect[0] + rect[2]) / 2), z: r2((rect[1] + rect[3]) / 2), frontU: f[0], frontV: f[1], ry: r2(Math.atan2(f[0], f[1])), w: size[0], d: size[1], aabb: rect.map(r2), _cell: { rect, f, enclosed: [cornerU, cornerV], R, size } }) as Slot
  }
  if (def.anchor === 'center') {
    let cx = R[0] + (def.fx == null ? 0.5 : def.fx) * (R[2] - R[0]) + (def.dx || 0)
    let cz = R[1] + (def.fz == null ? 0.5 : def.fz) * (R[3] - R[1]) + (def.dz || 0)
    point = [cx, cz]
    let f: Vec2
    if (FIXED_FACING[rule]) f = FIXED_FACING[rule]
    else {
      const t = targetPoint(rule)
      const dx = t[0] - cx
      const dz = t[1] - cz
      f = Math.hypot(dx, dz) < 0.05 ? [0, 1] : cardinal(dx, dz)
    }
    const [extentU, extentV] = extent(size, f)
    if (extentU > R[2] - R[0] + EPS || extentV > R[3] - R[1] + EPS) return invalid('larger_than_room')
    cx = clamp(cx, R[0] + extentU / 2, R[2] - extentU / 2)
    cz = clamp(cz, R[1] + extentV / 2, R[3] - extentV / 2)
    const rect: Rect = [cx - extentU / 2, cz - extentV / 2, cx + extentU / 2, cz + extentV / 2]
    if (!free(rect)) return invalid('blocked_by_door')
    return Object.assign(base, { x: r2(cx), z: r2(cz), frontU: f[0], frontV: f[1], ry: r2(Math.atan2(f[0], f[1])), w: size[0], d: size[1], aabb: rect.map(r2), _cell: { rect, f, enclosed: [], R, size } }) as Slot
  }
  return invalid('unknown_anchor')
}
