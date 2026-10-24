import type { Layout } from './electrical'
import { keyOf } from './electrical'
import type { Json } from './shared'
import { distanceToRect } from './shared'
import { atDoor, hasWindowAt } from './wall-points'
import type { WallPoint } from './wall-points'

/** Categories that need a socket of their own. */
const APPLIANCES = ['fridge', 'display_fridge', 'freezer', 'tv', 'appliance', 'washing_machine', 'air_conditioner', 'cash_register', 'table_light']
const COUNTERS = ['kitchen_cabinet', 'workbench', 'checkout_counter']
const LAMPS = ['table_light', 'lamp']

const needsSocket = (item: Json): boolean => APPLIANCES.includes(item.category) || item.category === 'shower'

interface Pick {
  point: WallPoint
  y: number
  score: number
}

/** Sockets: one for each appliance (the shower heater too), then enough for the size of each room, two at counter height in a kitchen with a counter. */
export function addOutlets(layout: Layout): void {
  const { plan, items, rooms, electrical, pointsOf } = layout
  let counter = 0
  const outletsOf = (room: Json): Json[] => electrical.outlets.filter((t) => t.room === room.id && t.floor === room.floor)
  const newOutlet = (room: Json, point: WallPoint, y: number): Json => {
    const outlet = { id: `outlet${++counter}`, room: room.id, floor: room.floor, u: point.u, v: point.v, y, c: point.c, axis: point.axis, pos: point.pos, frontU: point.nu, frontV: point.nv, type: '2P+T', voltage: 127 }
    electrical.outlets.push(outlet)
    return outlet
  }
  const counters = items.filter((m) => COUNTERS.includes(m.category) && !m.outdoor)
  const heightFor = (room: Json, point: WallPoint): number =>
    room.type === 'kitchen' && counters.some((m) => m.floor === room.floor && m.room === room.id && distanceToRect(point.u, point.v, m.aabb) < 0.45) ? 1.1 : 0.3
  const valid = (room: Json, point: WallPoint, y: number): boolean =>
    !hasWindowAt(point, y, 0.25) && !atDoor(plan, room, point, 0.45) && !outletsOf(room).some((t) => Math.hypot(t.u - point.u, t.v - point.v) < 0.5 && t.y === y)
  const pick = (room: Json, score: (point: WallPoint) => number, fixedY: number | null, ignoreBlocked?: boolean): Pick | null => {
    let best: Pick | null = null
    for (const point of pointsOf.get(keyOf(room)) ?? []) {
      const y = fixedY ?? heightFor(room, point)
      if (!valid(room, point, y)) continue
      const total = score(point) + (point.blocked(y) && !ignoreBlocked ? 5 : 0)
      if (!best || total < best.score) best = { point, y, score: total }
    }
    return best
  }
  const roomOf = (item: Json): Json | undefined => rooms.find((x) => x.id === item.room && x.floor === item.floor)
  const appliances = items.filter((m) => !m.outdoor && needsSocket(m) && rooms.some((c) => c.id === m.room && c.floor === m.floor) && m.category !== 'table_light')
  for (const item of appliances) connectAppliance(item)
  function connectAppliance(item: Json): void {
    const room = roomOf(item)!
    const target = item.aabb
    const nearest = outletsOf(room).map((t) => ({ t, d: distanceToRect(t.u, t.v, target) })).filter((o) => o.d <= 1.2 && o.t.y <= 1.1).sort((a, b) => a.d - b.d)[0]
    const isShower = item.category === 'shower'
    let outlet: Json | null = nearest && !isShower ? nearest.t : null
    if (!outlet) {
      const height = isShower ? 1.1 : item.y > 0.7 ? 1.1 : null
      const best = pick(room, (p) => { const d = distanceToRect(p.u, p.v, target); return isShower && d < 0.6 ? 50 + d : d }, height)
      let chosen = best
      if (!isShower && (!best || distanceToRect(best.point.u, best.point.v, target) > 1.4)) {
        const behind = pick(room, (p) => distanceToRect(p.u, p.v, target), item.y > 0.7 ? 1.1 : null, true)
        if (behind && (!best || distanceToRect(behind.point.u, behind.point.v, target) < distanceToRect(best.point.u, best.point.v, target))) chosen = behind
      }
      if (chosen) outlet = newOutlet(room, chosen.point, chosen.y)
    }
    if (!outlet) return
    item.outlet = outlet.id
    if (isShower) item.showerHeater = { electric: true, powerW: 5500, outlet: outlet.id }
  }
  for (const room of rooms) {
    const area = room.parts.reduce((sum: number, q: number[]) => sum + (q[2]! - q[0]!) * (q[3]! - q[1]!), 0)
    const wanted = Math.max(room.type === 'kitchen' ? 3 : 2, Math.min(6, Math.round(area / 7)))
    const farthest = (existing: Json[]) => (p: WallPoint) => -Math.min(9, ...existing.map((t) => Math.hypot(t.u - p.u, t.v - p.v)))
    for (let guard = 0; outletsOf(room).length < wanted && guard < 12; guard++) {
      const best = pick(room, farthest(outletsOf(room)), null)
      if (!best) break
      newOutlet(room, best.point, best.y)
    }
    if (room.type !== 'kitchen' || !counters.some((m) => m.room === room.id)) continue
    for (let guard = 0; outletsOf(room).filter((t) => t.y === 1.1).length < 2 && guard < 4; guard++) {
      const existing = outletsOf(room)
      const best = pick(room, (p) => (heightFor(room, p) === 1.1 ? 0 : 20) - Math.min(9, ...existing.map((t) => Math.hypot(t.u - p.u, t.v - p.v))), 1.1)
      if (!best) break
      newOutlet(room, best.point, 1.1)
    }
  }
  for (const item of appliances) {
    if (item.category === 'shower' || !item.outlet) continue
    const room = roomOf(item)!
    const current = outletsOf(room).find((t) => t.id === item.outlet)
    if (!current || distanceToRect(current.u, current.v, item.aabb) <= 1.2) continue
    const other = outletsOf(room).filter((t) => t.y <= 1.1).map((t) => ({ t, d: distanceToRect(t.u, t.v, item.aabb) })).sort((a, b) => a.d - b.d)[0]
    if (other && other.d < distanceToRect(current.u, current.v, item.aabb) && other.d <= 1.2) item.outlet = other.t.id
  }
  for (const item of items.filter((m) => LAMPS.includes(m.category) && !m.outdoor)) {
    const room = roomOf(item)
    if (!room) continue
    const nearest = outletsOf(room).map((t) => ({ t, d: distanceToRect(t.u, t.v, item.aabb) })).sort((a, b) => a.d - b.d)[0]
    if (nearest) item.outlet = nearest.t.id
  }
}

