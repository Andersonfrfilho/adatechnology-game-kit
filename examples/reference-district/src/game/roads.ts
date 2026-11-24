import type { CityPlanInput, PlanLine, PlanRect } from '@adatechnology/game-urban'

import { lineRects, rectsOverlap, stretchesOf, subtractIntervals } from './geometry'
import type { Stretch } from './geometry'

const isStreet = (line: PlanLine): boolean => line.kind === 'street' || line.kind === 'avenue'

/** A street light stands on the sidewalk this far back from the curb (metres), the way a Brazilian utility sets its poles: in the service strip by the kerb, clear of the walkway. */
export const STREET_LIGHT_CURB_SETBACK = 0.5

/** One straight stretch of road, with the width of the street it belongs to. */
export type RoadStretch = Stretch & { readonly line: string; readonly width: number }

/** Where a pole stands, on which side of its street (`side` points from the road's axis to the pole), the street it lights and the turn `ry` that reaches its arm over the road. */
export type PolePoint = { readonly x: number; readonly z: number; readonly side: 1 | -1; readonly line: string; readonly ry: number }

/** Metres between two street poles along a street (a Brazilian low-voltage span runs 30 to 40 m). */
export const POLE_SPACING = 32
/** No two poles stand closer than this (metres): at a corner the second street's pole gives way. */
export const POLE_MIN_GAP = 3
/** How far a pole may slide along its street (metres) to clear a door or a gate before it is left out. */
const POLE_MAX_SLIDE = 6
const SLIDE_STEP = 0.25
/** The side of every street the poles stand on: one side per street, the +z side of a street along x and the +x side of one along z (no pattern alternates them yet). */
const POLE_SIDE = 1

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

/** The turn that points a pole's arm (its +x) from the sidewalk on `side` toward the axis of a street running `along`. */
export const armTurnOf = (along: 'x' | 'z', side: 1 | -1): number => (along === 'x' ? side * (Math.PI / 2) : side > 0 ? Math.PI : 0)

export type PolePointsParams = {
  readonly plan: CityPlanInput
  readonly spacing: number
  readonly setback: number
  /** Ground no pole may stand on: the strip in front of every door and gate, from the lot to the curb. */
  readonly avoid?: readonly PlanRect[]
}

/**
 * Where the street poles stand: on one side of each street (`POLE_SIDE`), `setback` metres back from the curb (the road's edge, half the street's width from its axis), every `spacing`
 * metres counted from the start of the street, so the spans stay even across the crossings; a station on a road or in a river is left out, one in front of a door or a gate slides along
 * the street to the nearest clear ground (or is left out), and none stands within `POLE_MIN_GAP` of another.
 */
export function polePointsOf({ plan, spacing, setback, avoid = [] }: PolePointsParams): PolePoint[] {
  const lines = plan.lines ?? []
  const blocked = [...lines.filter((line) => line.kind === 'river').flatMap((line) => lineRects(line)), ...lines.filter(isStreet).flatMap((line) => lineRects(line))]
  const isFree = (x: number, z: number): boolean => !blocked.some((rect) => isInside(x, z, rect)) && !avoid.some((rect) => isInside(x, z, rect))
  const points: PolePoint[] = []
  for (const line of lines.filter(isStreet)) {
    let travelled = 0
    for (const stretch of stretchesOf(line)) {
      const offset = line.width / 2 + setback
      const start = (stretch.along === 'x' ? stretch.x : stretch.z) - stretch.length / 2
      const first = spacing / 2 + Math.ceil((travelled - spacing / 2) / spacing) * spacing - travelled
      for (let at = first; at < stretch.length; at += spacing) {
        const place = (along: number): readonly [number, number] => (stretch.along === 'x' ? [start + along, stretch.z + POLE_SIDE * offset] : [stretch.x + POLE_SIDE * offset, start + along])
        const slide = slideOf((along) => isFree(...place(along)), at)
        if (slide === undefined) continue
        const [x, z] = place(at + slide)
        if (points.some((point) => Math.hypot(point.x - x, point.z - z) < POLE_MIN_GAP)) continue
        points.push({ x, z, side: POLE_SIDE, line: line.id, ry: armTurnOf(stretch.along, POLE_SIDE) })
      }
      travelled += stretch.length
    }
  }
  return points
}

/** The smallest slide along the street (0, then ±`SLIDE_STEP`, ±2 steps...) that puts the pole on free ground, up to `POLE_MAX_SLIDE`; `undefined` when there is none. */
function slideOf(isFreeAt: (along: number) => boolean, at: number): number | undefined {
  for (let step = 0; step <= POLE_MAX_SLIDE / SLIDE_STEP; step++) {
    for (const slide of step === 0 ? [0] : [step * SLIDE_STEP, -step * SLIDE_STEP]) if (isFreeAt(at + slide)) return slide
  }
  return undefined
}
