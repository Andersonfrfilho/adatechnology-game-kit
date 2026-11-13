import { PLASTER_PER_FACE } from '@adatechnology/game-floorplan-structure'

/** A 4x2 wall box (NBR 5410 rough-in), portrait as its plate: across the wall's face, high and deep, metres. The real box is 101 x 54 mm and 50 mm deep. */
export const WALL_BOX = { along: 0.054, high: 0.101, deep: 0.05 } as const

/**
 * How far the box's face stands proud of the planned masonry face, metres (negative: set back into the cut): the drawn bricks and mortar stand a few millimetres
 * proud of their planned line, so a box flush with that line has its face within a millimetre of theirs and flickers. Set 3 mm back it is clear of them, still
 * flush to the eye, and the render, 15 mm thick, closes 18 mm over it.
 */
export const WALL_BOX_PROUD = -0.003

/** An outlet or switch as the plan places it: just in front of the rendered wall face, `y` above its storey floor, `frontU/frontV` pointing into the room. */
export interface WallBoxPoint {
  readonly u: number
  readonly v: number
  readonly y: number
  readonly frontU: number
  readonly frontV: number
}

/** The wall a point is on: its centre line across the wall (the axis of the point's front) and half its finished thickness, render included. */
export interface WallBehind {
  readonly line: number
  readonly halfThickness: number
}

/** The box cut into the masonry behind a point: its rectangle in the plan, its height above the storey floor, and where its face stands. */
export interface WallBoxExtent {
  readonly u0: number
  readonly u1: number
  readonly v0: number
  readonly v1: number
  readonly y0: number
  readonly y1: number
  /** Distance from the box's face to the rendered wall face, into the wall: the render covers the box by this much. */
  readonly renderOverFace: number
}

export interface WallLine {
  readonly floor: number
  readonly axis: 'u' | 'v'
  readonly u0: number
  readonly v0: number
  readonly u1: number
  readonly v1: number
  readonly thickness: number
}

const HALF_WALL = 0.075

/** The wall whose room face a point is on: on the line closest to the point, along which the point stands. Falls back to a standard wall. */
export function wallBehindOf(walls: readonly WallLine[], point: WallBoxPoint & { readonly floor: number }): WallBehind {
  const alongU = Math.abs(point.frontV) >= Math.abs(point.frontU)
  const across = alongU ? point.v : point.u
  const along = alongU ? point.u : point.v
  let best: WallBehind | undefined
  let bestGap = Infinity
  for (const wall of walls) {
    if (wall.floor !== point.floor || wall.axis !== (alongU ? 'u' : 'v')) continue
    const line = alongU ? wall.v0 : wall.u0
    const [from, to] = alongU ? [Math.min(wall.u0, wall.u1), Math.max(wall.u0, wall.u1)] : [Math.min(wall.v0, wall.v1), Math.max(wall.v0, wall.v1)]
    const gap = Math.abs(across - line)
    if (along < from - 1e-6 || along > to + 1e-6 || gap > wall.thickness || gap >= bestGap) continue
    best = { line, halfThickness: wall.thickness / 2 }
    bestGap = gap
  }
  return best ?? { line: across - Math.sign(alongU ? point.frontV : point.frontU) * (HALF_WALL + 0.012), halfThickness: HALF_WALL }
}

export function wallBoxExtent(point: WallBoxPoint, wall: WallBehind): WallBoxExtent {
  const alongU = Math.abs(point.frontV) >= Math.abs(point.frontU)
  const intoRoom = Math.sign(alongU ? point.frontV : point.frontU)
  const face = wall.line + intoRoom * (wall.halfThickness - PLASTER_PER_FACE + WALL_BOX_PROUD)
  const back = face - intoRoom * WALL_BOX.deep
  const [low, high] = face < back ? [face, back] : [back, face]
  const half = WALL_BOX.along / 2
  return {
    u0: alongU ? point.u - half : low,
    u1: alongU ? point.u + half : high,
    v0: alongU ? low : point.v - half,
    v1: alongU ? high : point.v + half,
    y0: point.y - WALL_BOX.high / 2,
    y1: point.y + WALL_BOX.high / 2,
    renderOverFace: PLASTER_PER_FACE - WALL_BOX_PROUD,
  }
}
