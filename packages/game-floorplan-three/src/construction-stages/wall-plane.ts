/** A rectangle in the plane of a wall: along the wall (a) and up (y). */
export interface WallRect {
  readonly a0: number
  readonly a1: number
  readonly y0: number
  readonly y1: number
}

const EPS = 1e-4

/** What is left of `base` once each of `holes` is taken out of it: rectangles that do not overlap each other nor any hole. */
export function subtractRects(base: WallRect, holes: readonly WallRect[]): WallRect[] {
  let pieces: WallRect[] = [base]
  for (const h of holes) {
    const next: WallRect[] = []
    for (const r of pieces) {
      const a0 = Math.max(r.a0, h.a0), a1 = Math.min(r.a1, h.a1), y0 = Math.max(r.y0, h.y0), y1 = Math.min(r.y1, h.y1)
      if (a1 - a0 < EPS || y1 - y0 < EPS) {
        next.push(r)
        continue
      }
      if (y0 - r.y0 > EPS) next.push({ a0: r.a0, a1: r.a1, y0: r.y0, y1: y0 })
      if (r.y1 - y1 > EPS) next.push({ a0: r.a0, a1: r.a1, y0: y1, y1: r.y1 })
      if (a0 - r.a0 > EPS) next.push({ a0: r.a0, a1: a0, y0, y1 })
      if (r.a1 - a1 > EPS) next.push({ a0: a1, a1: r.a1, y0, y1 })
    }
    pieces = next
  }
  return pieces
}

/** A wall's line in plan: the axis it runs along, the line across it and its thickness. */
export interface WallLine {
  readonly alongU: boolean
  readonly line: number
  readonly thickness: number
}

/** The plan box [u0, v0, u1, v1] of a wall part as a line. */
export function wallLineOf(aabb: readonly number[]): WallLine & { readonly a0: number; readonly a1: number } {
  const [u0, v0, u1, v1] = aabb as [number, number, number, number]
  const alongU = u1 - u0 >= v1 - v0
  return alongU ? { alongU, line: (v0 + v1) / 2, thickness: v1 - v0, a0: u0, a1: u1 } : { alongU, line: (u0 + u1) / 2, thickness: u1 - u0, a0: v0, a1: v1 }
}

/**
 * The part of a solid (plan box and heights) that stands in the wall, as a rectangle of the wall's plane, or null when it takes too little of the wall's
 * thickness (a solid beside the wall leaves its bricks alone).
 */
export function cutOf(wall: WallLine, aabb: readonly number[], y0: number, y1: number): WallRect | null {
  const [u0, v0, u1, v1] = aabb as [number, number, number, number]
  const across0 = wall.alongU ? v0 : u0, across1 = wall.alongU ? v1 : u1
  // a solid that takes a good part of the wall's thickness (a pillar set a little off the wall's line) owns that stretch of it
  const half = wall.thickness / 2
  const covered = Math.min(across1, wall.line + half) - Math.max(across0, wall.line - half)
  if (covered < Math.min(wall.thickness * 0.3, across1 - across0) - EPS) return null
  return wall.alongU ? { a0: u0, a1: u1, y0, y1 } : { a0: v0, a1: v1, y0, y1 }
}
