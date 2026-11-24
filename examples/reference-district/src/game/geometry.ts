import type { PlanLine, PlanPoint, PlanRect } from '@adatechnology/game-urban'

export const rectsOverlap = (a: PlanRect, b: PlanRect): boolean => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

export const rectCentre = (rect: PlanRect): PlanPoint => [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2]

/** The rectangle of each straight stretch of a line, `width` wide (plus `margin` on each side); the stretches of a plan line run along x or along z. */
export function lineRects(line: PlanLine, margin = 0): PlanRect[] {
  const half = line.width / 2 + margin
  const rects: PlanRect[] = []
  for (let index = 1; index < line.points.length; index++) {
    const from = line.points[index - 1] as PlanPoint
    const to = line.points[index] as PlanPoint
    rects.push([Math.min(from[0], to[0]) - half, Math.min(from[1], to[1]) - half, Math.max(from[0], to[0]) + half, Math.max(from[1], to[1]) + half])
  }
  return rects
}

/** Length, centre and direction of one stretch of a line, for the functions of `game-urban` that draw a road or a walk centred on a point. */
export type Stretch = { readonly x: number; readonly z: number; readonly length: number; readonly along: 'x' | 'z' }

export function stretchesOf(line: PlanLine): Stretch[] {
  const stretches: Stretch[] = []
  for (let index = 1; index < line.points.length; index++) {
    const from = line.points[index - 1] as PlanPoint
    const to = line.points[index] as PlanPoint
    const along = Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1]) ? 'x' : 'z'
    stretches.push({ x: (from[0] + to[0]) / 2, z: (from[1] + to[1]) / 2, length: along === 'x' ? Math.abs(to[0] - from[0]) : Math.abs(to[1] - from[1]), along })
  }
  return stretches
}

/** The rectangle that holds every rectangle given. */
export function boundsOf(rects: readonly PlanRect[]): PlanRect {
  return [Math.min(...rects.map((r) => r[0])), Math.min(...rects.map((r) => r[1])), Math.max(...rects.map((r) => r[2])), Math.max(...rects.map((r) => r[3]))]
}

/** The parts of the interval `[from, to]` that no cut covers, in order (a road stretch minus the streets that cross it). */
export function subtractIntervals(from: number, to: number, cuts: ReadonlyArray<readonly [number, number]>): Array<[number, number]> {
  const parts: Array<[number, number]> = []
  let start = from
  for (const [cutFrom, cutTo] of [...cuts].sort((a, b) => a[0] - b[0])) {
    if (cutTo <= start || cutFrom >= to) continue
    if (cutFrom > start) parts.push([start, cutFrom])
    start = Math.max(start, cutTo)
  }
  if (start < to) parts.push([start, to])
  return parts
}
