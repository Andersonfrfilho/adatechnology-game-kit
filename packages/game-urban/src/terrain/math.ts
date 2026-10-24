import type { Point, Rect } from './types'

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** Smoothstep between `a` and `b`; with `a > b` it falls instead of rising. */
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/** The team's cheap hash of two numbers into [0, 1). */
export const hash2 = (a: number, b: number): number => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return n - Math.floor(n)
}
/** Distance from a point to the nearest segment of a polyline. */
export function distanceToPolyline(px: number, py: number, points: readonly Point[]): number {
  let best = 1e9
  for (let index = 0; index < points.length - 1; index++) {
    const [ax, ay] = points[index] as Point
    const [bx, by] = points[index + 1] as Point
    const dx = bx - ax
    const dy = by - ay
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    const d = Math.hypot(px - ax - t * dx, py - ay - t * dy)
    if (d < best) best = d
  }
  return best
}
/** Inside the rectangle grown by `margin` on every side. */
export const insideRect = (px: number, py: number, r: Rect, margin: number): boolean => px > r[0] - margin && px < r[2] + margin && py > r[1] - margin && py < r[3] + margin
/** Inside an ellipse given by its centre and radii. */
export const insideEllipse = (px: number, py: number, center: Point, radius: Point): boolean => Math.hypot((px - center[0]) / radius[0], (py - center[1]) / radius[1]) < 1
