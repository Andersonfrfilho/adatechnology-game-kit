import type { CityPlanInput, PlanLine } from '@adatechnology/game-urban'

import { lineRects, rectsOverlap, stretchesOf, subtractIntervals } from './geometry'
import type { Stretch } from './geometry'

const isStreet = (line: PlanLine): boolean => line.kind === 'street' || line.kind === 'avenue'

/**
 * The stretches of road to draw for a plan: every straight stretch of every street, cut where another street crosses it (the crossing is bare ground, so two road planes never share a
 * plane) and where the river runs (the bridge is a missing piece until its task puts it there).
 */
export function roadStretchesOf(plan: CityPlanInput): Stretch[] {
  const lines = plan.lines ?? []
  return lines.filter(isStreet).flatMap((line) =>
    stretchesOf(line).flatMap((stretch) => {
      const half = line.width / 2
      const band = stretch.along === 'x' ? ([stretch.x - stretch.length / 2, stretch.z - half, stretch.x + stretch.length / 2, stretch.z + half] as const) : ([stretch.x - half, stretch.z - stretch.length / 2, stretch.x + half, stretch.z + stretch.length / 2] as const)
      const crossing = lines.filter((other) => other.id !== line.id && (isStreet(other) || other.kind === 'river')).flatMap((other) => lineRects(other))
      const cuts = crossing.filter((rect) => rectsOverlap(band, rect)).map((rect): readonly [number, number] => (stretch.along === 'x' ? [rect[0], rect[2]] : [rect[1], rect[3]]))
      const start = stretch.along === 'x' ? band[0] : band[1]
      const end = stretch.along === 'x' ? band[2] : band[3]
      return subtractIntervals(start, end, cuts).map(([from, to]): Stretch => (stretch.along === 'x' ? { x: (from + to) / 2, z: stretch.z, length: to - from, along: 'x' } : { x: stretch.x, z: (from + to) / 2, length: to - from, along: 'z' }))
    }),
  )
}

/** Where a pole stands: every `spacing` metres along each road stretch, on the sidewalk of alternate sides; none inside a river. */
export function polePointsOf({ plan, spacing, offset }: { readonly plan: CityPlanInput; readonly spacing: number; readonly offset: number }): Array<{ readonly x: number; readonly z: number; readonly side: 1 | -1 }> {
  const rivers = (plan.lines ?? []).filter((line) => line.kind === 'river').flatMap((line) => lineRects(line))
  const points: Array<{ x: number; z: number; side: 1 | -1 }> = []
  for (const stretch of roadStretchesOf(plan)) {
    const half = stretch.length / 2
    for (let at = -half + spacing / 2, index = 0; at < half; at += spacing, index++) {
      const side: 1 | -1 = index % 2 === 0 ? 1 : -1
      const x = stretch.along === 'x' ? stretch.x + at : stretch.x + side * offset
      const z = stretch.along === 'x' ? stretch.z + side * offset : stretch.z + at
      if (!rivers.some((rect) => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3])) points.push({ x, z, side })
    }
  }
  return points
}
