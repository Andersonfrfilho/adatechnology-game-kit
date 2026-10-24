import { MARGIN } from './constants'
import { entryPoints, eq, inRect, inner, sharedEdge, usableParts } from './geometry'
import { openingsOfFloor } from './queries'
import type { Json, Plan, Rect, Room } from './types'

export interface Grid {
  gs: number
  u0: number
  v0: number
  nx: number
  nz: number
  inside: Uint8Array
  entries: [number, number][]
  center: [number, number]
}

/** Wall bodies of a storey (the wall line plus half a wall each side); a wall end that stops at a door opening has no extension there. */
function wallBodies(plan: Plan, floor: number): Rect[] {
  const cache = (plan.wallBodies = plan.wallBodies || {})
  if (cache[floor]) return cache[floor]
  const doors = plan.doors.filter((p) => p.floor === floor)
  return (cache[floor] = plan.walls
    .filter((p) => p.floor === floor && (p.type === 'wall' || p.type === 'railing'))
    .map((p) => {
      const a0 = p.axis === 'u' ? p.u0 : p.v0
      const a1 = p.axis === 'u' ? p.u1 : p.v1
      const pos = p.axis === 'u' ? p.v0 : p.u0
      const atDoor = (x: number) => doors.some((q) => q.axis === p.axis && eq(q.pos, pos) && (eq(q.at - q.width / 2, x) || eq(q.at + q.width / 2, x)))
      const e0 = atDoor(a0) ? 0 : MARGIN
      const e1 = atDoor(a1) ? 0 : MARGIN
      return (p.axis === 'u' ? [a0 - e0, pos - MARGIN, a1 + e1, pos + MARGIN] : [pos - MARGIN, a0 - e0, pos + MARGIN, a1 + e1]) as Rect
    }))
}

/**
 * Walkability grid of a room (10 cm cells inside, 30 cm outside). Indoors a cell is walkable only when a player body of `radius`
 * fits between it and the walls. `ignored` lists opening ids to leave out of the entries.
 */
export function createGrid(plan: Plan, room: Room, ignored?: Set<string> | null, radius: number = plan.playerRadius): Grid {
  const gs = room.outdoor ? 0.3 : 0.1
  let u0 = 1e9
  let v0 = 1e9
  let u1 = -1e9
  let v1 = -1e9
  for (const p of room.parts) {
    u0 = Math.min(u0, p[0])
    v0 = Math.min(v0, p[1])
    u1 = Math.max(u1, p[2])
    v1 = Math.max(v1, p[3])
  }
  const nx = Math.ceil((u1 - u0) / gs)
  const nz = Math.ceil((v1 - v0) / gs)
  const insideCells = new Uint8Array(nx * nz)
  const insets = room.outdoor ? usableParts(room, 0.08) : room.parts
  const bodies = room.outdoor ? null : wallBodies(plan, room.floor)
  const tooClose = (u: number, v: number) =>
    (bodies as Rect[]).some((r) => {
      const dx = Math.max(r[0] - u, 0, u - r[2])
      const dz = Math.max(r[1] - v, 0, v - r[3])
      return dx * dx + dz * dz < radius * radius - 1e-9
    })
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const u = u0 + (i + 0.5) * gs
      const v = v0 + (j + 0.5) * gs
      if (insets.some((r) => u >= r[0] && u <= r[2] && v >= r[1] && v <= r[3]) && (room.outdoor || !tooClose(u, v))) insideCells[j * nx + i] = 1
    }
  const entries: [number, number][] = []
  for (const ab of openingsOfFloor(plan, room.floor) as Json[])
    if (!(ignored && ignored.has(ab.id)))
      for (const pt of entryPoints(ab)) {
        if (!inRect(room, pt[0], pt[1])) continue
        const i = Math.floor((pt[0] - u0) / gs)
        const j = Math.floor((pt[1] - v0) / gs)
        if (i >= 0 && j >= 0 && i < nx && j < nz && insideCells[j * nx + i]) entries.push([i, j])
      }
  if (!room.outdoor)
    for (const pair of plan.openPairs[room.floor] || []) {
      const otherId = pair[0] === room.id ? pair[1] : pair[1] === room.id ? pair[0] : null
      const other = otherId && plan.rooms.find((c) => c.id === otherId && c.floor === room.floor)
      if (!other) continue
      const edge = sharedEdge(room, other, null)
      if (!edge || edge.a1 - edge.a0 > 2.0) continue
      const mid = (edge.a0 + edge.a1) / 2
      for (const offset of [-0.4, 0.4]) {
        const pt = edge.axis === 'u' ? [mid, edge.pos + offset] : [edge.pos + offset, mid]
        if (!inRect(room, pt[0], pt[1])) continue
        const i = Math.floor((pt[0] - u0) / gs)
        const j = Math.floor((pt[1] - v0) / gs)
        if (i >= 0 && j >= 0 && i < nx && j < nz && insideCells[j * nx + i]) entries.push([i, j])
      }
    }
  const R = inner(room.parts[0])
  return { gs, u0, v0, nx, nz, inside: insideCells, entries, center: [(R[0] + R[2]) / 2, (R[1] + R[3]) / 2] }
}

/** True when the room centre and every entry stay connected once `solids` (inflated) are blocked. */
export function reachable(g: Grid, solids: Rect[], inflation: number): boolean {
  const { gs, u0, v0, nx, nz, inside } = g
  const blocked = new Uint8Array(nx * nz)
  for (const r of solids) {
    const i0 = Math.max(0, Math.floor((r[0] - inflation - u0) / gs))
    const i1 = Math.min(nx - 1, Math.floor((r[2] + inflation - u0) / gs))
    const j0 = Math.max(0, Math.floor((r[1] - inflation - v0) / gs))
    const j1 = Math.min(nz - 1, Math.floor((r[3] + inflation - v0) / gs))
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const u = u0 + (i + 0.5) * gs
        const v = v0 + (j + 0.5) * gs
        if (u > r[0] - inflation && u < r[2] + inflation && v > r[1] - inflation && v < r[3] + inflation) blocked[j * nx + i] = 1
      }
  }
  let best = -1
  let bestDist = 1e9
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      if (!inside[k] || blocked[k]) continue
      const dist = Math.hypot(u0 + (i + 0.5) * gs - g.center[0], v0 + (j + 0.5) * gs - g.center[1])
      if (dist < bestDist) {
        bestDist = dist
        best = k
      }
    }
  if (best < 0) return false
  if (!g.entries.length) return true
  for (const [i, j] of g.entries) if (blocked[j * nx + i]) return false
  const visited = new Uint8Array(nx * nz)
  const queue = new Int32Array(nx * nz)
  let h = 0
  let t = 0
  const s = g.entries[0][1] * nx + g.entries[0][0]
  visited[s] = 1
  queue[t++] = s
  while (h < t) {
    const k = queue[h++]
    const i = k % nx
    const j = (k - i) / nx
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di
      const b = j + dj
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue
      const q = b * nx + a
      if (visited[q] || !inside[q] || blocked[q]) continue
      visited[q] = 1
      queue[t++] = q
    }
  }
  if (!visited[best]) return false
  for (const [i, j] of g.entries) if (!visited[j * nx + i]) return false
  return true
}
