import type { Json } from './shared'
import { HALF_WALL, isSolid, round2 } from './shared'

export interface WallPoint {
  u: number
  v: number
  /** Position along the wall. */
  c: number
  axis: 'u' | 'v'
  pos: number
  side: number
  nu: number
  nv: number
  a0: number
  a1: number
  exterior: boolean
  windows: Json[]
  /** A solid item within 12 cm of the point reaches higher than `height`. */
  blocked(height: number): boolean
}

const STEP = 0.05
const SURFACE_OFFSET = 0.012

/** Points on the inner face of the walls of a room, away from corners (`margin`), where sockets, switches and a panel may go. */
export function wallPointsOf(plan: Json, room: Json, items: Json[], margin = 0.3): WallPoint[] {
  const points: WallPoint[] = []
  const windows = plan.windows.filter((w: Json) => w.floor === room.floor)
  const solids = items.filter((m) => m.floor === room.floor && !m.outdoor && m.room === room.id && isSolid(m))
  for (const wall of plan.walls) {
    if (wall.floor !== room.floor || wall.type !== 'wall' || !wall.sides.includes(room.id)) continue
    const side = wall.sides[1] === room.id ? 1 : -1
    const a0 = wall.axis === 'u' ? Math.min(wall.u0, wall.u1) : Math.min(wall.v0, wall.v1)
    const a1 = wall.axis === 'u' ? Math.max(wall.u0, wall.u1) : Math.max(wall.v0, wall.v1)
    const pos = wall.axis === 'u' ? wall.v0 : wall.u0
    const nearby = windows.filter((w: Json) => w.axis === wall.axis && Math.abs(w.pos - pos) < 1e-3 && w.at + w.width / 2 > a0 && w.at - w.width / 2 < a1)
    for (let c = a0 + margin; c <= a1 - margin + 1e-9; c += STEP) {
      const u = wall.axis === 'u' ? c : pos + side * (HALF_WALL + SURFACE_OFFSET)
      const v = wall.axis === 'u' ? pos + side * (HALF_WALL + SURFACE_OFFSET) : c
      points.push({
        u: round2(u), v: round2(v), c: round2(c), axis: wall.axis, pos, side, nu: wall.axis === 'u' ? 0 : side, nv: wall.axis === 'u' ? side : 0, a0, a1, exterior: wall.exterior, windows: nearby,
        blocked: (height) => solids.some((m) => m.aabb && Math.hypot(Math.max(m.aabb[0] - u, 0, u - m.aabb[2]), Math.max(m.aabb[1] - v, 0, v - m.aabb[3])) < 0.12 && (m.y || 0) + m.h > height),
      })
    }
  }
  return points
}

export const hasWindowAt = (point: WallPoint, y: number, clearance = 0.2): boolean =>
  point.windows.some((w) => y + 0.1 > w.y0 - 0.05 && y - 0.1 < w.y1 + 0.05 && Math.abs(point.c - w.at) < w.width / 2 + clearance)

export const atDoor = (plan: Json, room: Json, point: WallPoint, clearance: number): boolean =>
  plan.doors.some((d: Json) => d.floor === room.floor && d.axis === point.axis && Math.abs(d.pos - point.pos) < 1e-3 && Math.abs(d.at - point.c) < d.width / 2 + clearance)
