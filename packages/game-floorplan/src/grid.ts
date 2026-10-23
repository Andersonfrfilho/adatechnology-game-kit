import { entryPoints, inRect, inner, usableParts } from './geometry'
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

/** Coarse walkability grid of a room. `ignored` lists opening ids to leave out of the entries. */
export function createGrid(plan: Plan, room: Room, ignored?: Set<string> | null): Grid {
  const gs = room.outdoor ? 0.3 : 0.2
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
  const insets = usableParts(room, 0.08)
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const u = u0 + (i + 0.5) * gs
      const v = v0 + (j + 0.5) * gs
      if (insets.some((r) => u >= r[0] && u <= r[2] && v >= r[1] && v <= r[3])) insideCells[j * nx + i] = 1
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
