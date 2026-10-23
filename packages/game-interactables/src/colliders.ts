import type { ColliderOptions, WorldCollider } from './types'

interface Box {
  ids: string[]
  object: string
  u0: number
  u1: number
  v0: number
  v1: number
  y0: number
  y1: number
}

const volume = (b: Box): number => (b.u1 - b.u0) * (b.v1 - b.v0) * (b.y1 - b.y0)
const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

function tryMerge(a: Box, b: Box, gap: number, slack: number): Box | null {
  if (a.u0 - gap > b.u1 || b.u0 - gap > a.u1) return null
  if (a.v0 - gap > b.v1 || b.v0 - gap > a.v1) return null
  if (a.y0 - gap > b.y1 || b.y0 - gap > a.y1) return null
  const u0 = Math.min(a.u0, b.u0)
  const u1 = Math.max(a.u1, b.u1)
  const v0 = Math.min(a.v0, b.v0)
  const v1 = Math.max(a.v1, b.v1)
  const y0 = Math.min(a.y0, b.y0)
  const y1 = Math.max(a.y1, b.y1)
  const hull = (u1 - u0) * (v1 - v0) * (y1 - y0)
  const common = overlap(a.u0, a.u1, b.u0, b.u1) * overlap(a.v0, a.v1, b.v0, b.v1) * overlap(a.y0, a.y1, b.y0, b.y1)
  const real = volume(a) + volume(b) - common
  if (hull > real * (1 + slack) + 1e-9) return null
  return { ids: [...a.ids, ...b.ids], object: a.object, u0, u1, v0, v1, y0, y1 }
}

/**
 * Union overlapping or adjacent colliders of the same object (same rotation) into fewer OBBs.
 * A merge happens only when the merged box adds at most `slack` extra volume over the real union, so coverage is never lost
 * and never grows noticeably. Colliders of different objects or rotations are left alone.
 */
export function mergeColliders(list: WorldCollider[], options: Pick<ColliderOptions, 'gap' | 'slack'> = {}): WorldCollider[] {
  const gap = options.gap ?? 0.02
  const slack = options.slack ?? 0.1
  const groups = new Map<string, WorldCollider[]>()
  for (const c of list) {
    const key = `${c.object}|${Math.round(c.ry * 1000)}`
    const g = groups.get(key)
    if (g) g.push(c)
    else groups.set(key, [c])
  }
  const out: WorldCollider[] = []
  for (const g of groups.values()) {
    const ry = g[0]?.ry ?? 0
    const cs = Math.cos(ry)
    const sn = Math.sin(ry)
    let boxes: Box[] = g.map((c) => {
      const u = c.cx * cs - c.cz * sn
      const v = c.cx * sn + c.cz * cs
      return { ids: [c.id], object: c.object, u0: u - c.hw, u1: u + c.hw, v0: v - c.hd, v1: v + c.hd, y0: c.y0, y1: c.y1 }
    })
    let changed = boxes.length > 1
    while (changed) {
      changed = false
      outer: for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const m = tryMerge(boxes[i] as Box, boxes[j] as Box, gap, slack)
          if (!m) continue
          boxes = boxes.filter((_, k) => k !== i && k !== j)
          boxes.push(m)
          changed = true
          break outer
        }
      }
    }
    for (const b of boxes) {
      const u = (b.u0 + b.u1) / 2
      const v = (b.v0 + b.v1) / 2
      out.push({
        id: b.ids.length === 1 ? (b.ids[0] as string) : `${b.ids[0]}+${b.ids.length - 1}`,
        object: b.object,
        cx: u * cs + v * sn,
        cz: -u * sn + v * cs,
        hw: (b.u1 - b.u0) / 2,
        hd: (b.v1 - b.v0) / 2,
        ry,
        y0: b.y0,
        y1: b.y1,
      })
    }
  }
  return out
}
