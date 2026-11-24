import type { CityPlanInput, PlanLine } from '@adatechnology/game-urban'

import { lineRects, rectsOverlap, stretchesOf, subtractIntervals } from './geometry'
import type { Stretch } from './geometry'

const isStreet = (line: PlanLine): boolean => line.kind === 'street' || line.kind === 'avenue'

/** A street light stands on the sidewalk this far back from the curb (metres), the way a Brazilian utility sets its poles: in the service strip by the kerb, clear of the walkway. */
export const STREET_LIGHT_CURB_SETBACK = 0.5

/** One straight stretch of road, with the width of the street it belongs to. */
export type RoadStretch = Stretch & { readonly line: string; readonly width: number }

/** Where a pole stands, on which side of its street (`side` points from the road's axis to the pole) and the street it lights. */
export type PolePoint = { readonly x: number; readonly z: number; readonly side: 1 | -1; readonly line: string }

const isInside = (x: number, z: number, rect: readonly number[]): boolean => x > (rect[0] as number) && x < (rect[2] as number) && z > (rect[1] as number) && z < (rect[3] as number)

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

/**
 * Where a street light stands: every `spacing` metres along each road stretch, on the sidewalk of alternate sides, `setback` metres back from the curb of its own street (the road's
 * edge, half the street's width from its axis); none inside a river nor on the road of any street (the end of a stretch beside a crossing).
 */
export function polePointsOf({ plan, spacing, setback }: { readonly plan: CityPlanInput; readonly spacing: number; readonly setback: number }): PolePoint[] {
  const lines = plan.lines ?? []
  const blocked = [...lines.filter((line) => line.kind === 'river').flatMap((line) => lineRects(line)), ...lines.filter(isStreet).flatMap((line) => lineRects(line))]
  const points: PolePoint[] = []
  for (const stretch of roadStretchesOf(plan)) {
    const half = stretch.length / 2
    const offset = stretch.width / 2 + setback
    for (let at = -half + spacing / 2, index = 0; at < half; at += spacing, index++) {
      const side: 1 | -1 = index % 2 === 0 ? 1 : -1
      const x = stretch.along === 'x' ? stretch.x + at : stretch.x + side * offset
      const z = stretch.along === 'x' ? stretch.z + side * offset : stretch.z + at
      if (!blocked.some((rect) => isInside(x, z, rect))) points.push({ x, z, side, line: stretch.line })
    }
  }
  return points
}
