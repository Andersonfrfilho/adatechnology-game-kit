import type { CityPlanInput, PlanLine } from '@adatechnology/game-urban'

import { lineRects, rectsOverlap, stretchesOf, subtractIntervals } from './geometry'
import type { Stretch } from './geometry'

const isStreet = (line: PlanLine): boolean => line.kind === 'street' || line.kind === 'avenue'

/** One straight stretch of road, with the width of the street it belongs to. */
export type RoadStretch = Stretch & { readonly line: string; readonly width: number }

/** No pole of the network stands closer than this (metres) to a house's entrance post. */
export const POLE_MIN_GAP = 3

/**
 * The stretches of road to draw for a plan: every straight stretch of every street, cut where another street crosses it (the crossing is bare ground, so two road planes never share a
 * plane) and where the river runs (the bridge is a missing piece until its task puts it there).
 */
export function roadStretchesOf(plan: CityPlanInput): RoadStretch[] {
  const lines = plan.lines ?? []
  return lines.filter(isStreet).flatMap((line) =>
    stretchesOf(line).flatMap((stretch) => {
      const half = line.width / 2
      const band = stretch.along === 'x' ? ([stretch.x - stretch.length / 2, stretch.z - half, stretch.x + stretch.length / 2, stretch.z + half] as const) : ([stretch.x - half, stretch.z - stretch.length / 2, stretch.x + half, stretch.z + stretch.length / 2] as const)
      const crossing = lines.filter((other) => other.id !== line.id && (isStreet(other) || other.kind === 'river')).flatMap((other) => lineRects(other))
      const cuts = crossing.filter((rect) => rectsOverlap(band, rect)).map((rect): readonly [number, number] => (stretch.along === 'x' ? [rect[0], rect[2]] : [rect[1], rect[3]]))
      const start = stretch.along === 'x' ? band[0] : band[1]
      const end = stretch.along === 'x' ? band[2] : band[3]
      return subtractIntervals(start, end, cuts).map(([from, to]): RoadStretch => (stretch.along === 'x' ? { x: (from + to) / 2, z: stretch.z, length: to - from, along: 'x', line: line.id, width: line.width } : { x: stretch.x, z: (from + to) / 2, length: to - from, along: 'z', line: line.id, width: line.width }))
    }),
  )
}
