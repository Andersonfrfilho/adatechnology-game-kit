import { EPS, MARGIN, OVERHEAD_TOP } from './constants'
import { eq, inRect } from './geometry'
import type { FurnitureDef, Json, Plan, Rect, Room } from './types'

/** Door and path zones of a storey (storey -1 is the lot). */
export function zonesOfFloor(plan: Plan, floorIndex: number): Rect[] {
  const out: Rect[] = []
  if (floorIndex >= 0) {
    for (const p of plan.doors) if (p.floor === floorIndex) out.push(...p.zones)
  } else {
    for (const p of plan.doors) if (p.floor === 0 && p.exterior) out.push(...p.zones)
    for (const g of plan.gates) out.push(...g.zones)
    for (const c of plan.paths) out.push(...c.rects)
    out.push(...plan.reservations)
  }
  return out
}

export function openingsOfFloor(plan: Plan, floorIndex: number): Json[] {
  if (floorIndex >= 0) return plan.doors.filter((p) => p.floor === floorIndex)
  return plan.doors.filter((p) => p.floor === 0 && p.exterior).concat(plan.gates)
}

/** Keep-out zone of a window (inside, or outside for the lot). */
export function windowZone(j: Json, outside?: boolean): Rect {
  const h = j.width / 2 + 0.1
  const depth = 0.5
  let n: [number, number]
  if (j.side === 'front') n = [0, 1]
  else if (j.side === 'back') n = [0, -1]
  else if (j.side === 'left') n = [1, 0]
  else n = [-1, 0]
  if (outside) n = [-n[0], -n[1]]
  const u = j.u
  const v = j.v
  if (j.axis === 'u') return n[1] > 0 ? [u - h, v - MARGIN, u + h, v + depth] : [u - h, v - depth, u + h, v + MARGIN]
  return n[0] > 0 ? [u - MARGIN, v - h, u + depth, v + h] : [u - depth, v - h, u + MARGIN, v + h]
}

/** `overheadOff`: the counter sits under the window without its wall cabinet. */
export function blocksWindow(it: Pick<FurnitureDef, 'window' | 'overhead' | 'windowHeight'> & { h: number }, win: Json, overheadOff?: boolean): boolean {
  const height = Math.max(it.h, it.windowHeight || 0, it.overhead && !overheadOff ? OVERHEAD_TOP : 0)
  return !it.window || it.h > 1.0 + EPS || height > win.y0 - 0.05 + EPS
}

export function windowsOfRoom(plan: Plan, room: Room): Json[] {
  if (!room.outdoor) return plan.windows.filter((j) => j.room === room.id)
  return plan.windows.filter(
    (j) =>
      j.floor === 0 &&
      room.parts.some((p) => {
        if (j.side === 'front') return eq(p[3], j.pos) && j.u >= p[0] && j.u <= p[2]
        if (j.side === 'back') return eq(p[1], j.pos) && j.u >= p[0] && j.u <= p[2]
        if (j.side === 'left') return eq(p[2], j.pos) && j.v >= p[1] && j.v <= p[3]
        return eq(p[0], j.pos) && j.v >= p[1] && j.v <= p[3]
      }),
  )
}

export function roomAt(plan: Plan, u: number, v: number, floorIndex: number): Room | null {
  const list = floorIndex < 0 ? plan.zones : plan.rooms
  return list.find((c) => c.floor === floorIndex && inRect(c, u, v)) || null
}

export function isOpenSide(plan: Plan, room: Room, pu: number, pv: number): boolean {
  const o = roomAt(plan, pu, pv, room.floor)
  if (!o) return false
  if (o.id === room.id) return true
  if (room.outdoor) return true
  return (plan.openPairs[room.floor] || []).some((x) => (x[0] === room.id && x[1] === o.id) || (x[1] === room.id && x[0] === o.id))
}
