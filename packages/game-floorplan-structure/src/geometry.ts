import type { Rect, SourceWall } from './types'

export const WALL_THICKNESS = 0.15

export const round2 = (value: number): number => Math.round(value * 100) / 100

export function touches(a: Rect, b: Rect, tolerance: number): boolean {
  return a[0] < b[2] + tolerance && a[2] > b[0] - tolerance && a[1] < b[3] + tolerance && a[3] > b[1] - tolerance
}

export function distanceBetween(a: Rect, b: Rect): number {
  return Math.hypot(Math.max(a[0] - b[2], b[0] - a[2], 0), Math.max(a[1] - b[3], b[1] - a[3], 0))
}

export function unionOf(rects: readonly Rect[]): Rect {
  const out: Rect = [1e9, 1e9, -1e9, -1e9]
  for (const rect of rects) {
    out[0] = Math.min(out[0], rect[0])
    out[1] = Math.min(out[1], rect[1])
    out[2] = Math.max(out[2], rect[2])
    out[3] = Math.max(out[3], rect[3])
  }
  return out
}

/** The wall's centre line thickened to its box in the plan. */
export function wallBox(wall: Pick<SourceWall, 'u0' | 'v0' | 'u1' | 'v1' | 'thickness'>): Rect {
  const half = (wall.thickness ?? WALL_THICKNESS) / 2
  return [Math.min(wall.u0, wall.u1) - half, Math.min(wall.v0, wall.v1) - half, Math.max(wall.u0, wall.u1) + half, Math.max(wall.v0, wall.v1) + half]
}

export const centreOf = (rect: Rect): [number, number] => [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2]

/** The nearest `count` of `candidates` to `target`, nearest first. */
export function nearestTo<T extends { aabb: Rect }>(target: Rect, candidates: readonly T[], count: number): T[] {
  return candidates.slice().sort((a, b) => distanceBetween(target, a.aabb) - distanceBetween(target, b.aabb)).slice(0, count)
}
