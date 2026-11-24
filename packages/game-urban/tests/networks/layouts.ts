import type { CityPlanInput, PlanLine } from '../../src'
import type { NetworkLot } from '../../src/networks'
import { LOTS, PLAN } from './district'

type Row = { readonly prefix: string; readonly along: 'x' | 'z'; readonly axis: number; readonly side: 1 | -1; readonly from: number; readonly to: number; readonly front?: number; readonly width?: number; readonly depth?: number }

/** Lots side by side along a street, their fronts `front` metres from its axis (7.5 = right behind a 2.5 m sidewalk of a 10 m street). */
export function lotsAlong({ prefix, along, axis, side, from, to, front = 7.5, width = 12, depth = 25 }: Row): NetworkLot[] {
  const count = Math.floor((to - from) / width)
  return Array.from({ length: count }, (_, index): NetworkLot => {
    const [u0, u1] = [from + index * width, from + (index + 1) * width]
    const [v0, v1] = side > 0 ? [axis + front, axis + front + depth] : [axis - front - depth, axis - front]
    return { id: `${prefix}_${index + 1}`, rect: along === 'x' ? [u0, v0, u1, v1] : [v0, u0, v1, u1] }
  })
}

const street = (id: string, points: PlanLine['points'], width = 10, kind = 'street'): PlanLine => ({ id, kind, width, points })

/** A main street with a side street ending at it from the north (a T junction), no river. */
export const T_JUNCTION: { plan: CityPlanInput; lots: NetworkLot[] } = {
  plan: { id: 't_junction', scale: 'town', size: [400, 250], districts: [], lines: [street('main', [[-200, 0], [200, 0]]), street('side', [[0, -120], [0, 0]])] },
  lots: [...lotsAlong({ prefix: 'south', along: 'x', axis: 0, side: 1, from: -150, to: 150 }), ...lotsAlong({ prefix: 'west', along: 'z', axis: 0, side: -1, from: -110, to: -10 })],
}

/** A 20 m avenue crossed by a street, lots on opposite sides of each (the poles stand on different sides), no river. */
export const AVENUE: { plan: CityPlanInput; lots: NetworkLot[] } = {
  plan: { id: 'avenue', scale: 'town', size: [500, 300], districts: [{ id: 'all', kind: 'residential_popular', rect: [-250, -150, 250, 150] }], lines: [street('avenue', [[-250, 0], [250, 0]], 20, 'avenue'), street('cross', [[40, -150], [40, 150]])] },
  lots: [...lotsAlong({ prefix: 'north', along: 'x', axis: 0, side: -1, from: -200, to: 20, front: 12.5 }), ...lotsAlong({ prefix: 'east', along: 'z', axis: 40, side: 1, from: 20, to: 140 })],
}

const scale = (value: number): number => value * 2

/** The reference cut at twice its size: longer runs, longer circuits, a lot set back from its street. */
export const DOUBLE: { plan: CityPlanInput; lots: NetworkLot[] } = {
  plan: {
    ...PLAN,
    id: 'double',
    size: [scale(445), scale(270)],
    districts: (PLAN.districts ?? []).map((district) => ({ ...district, rect: [scale(district.rect[0]), scale(district.rect[1]), scale(district.rect[2]), scale(district.rect[3])] as const })),
    lines: (PLAN.lines ?? []).map((line) => ({ ...line, points: line.points.map(([x, z]) => [scale(x), scale(z)] as const) })),
  },
  // the lots keep their depth and widen with x: the church, 40 m from its street, takes its drop from service poles
  lots: LOTS.map((lot) => ({ id: lot.id, rect: [scale(lot.rect[0]), lot.rect[1], scale(lot.rect[2]), lot.rect[3]] as const })),
}

/** The reference cut with a river three times as long: the interceptor runs 400 m to the treatment node. */
export const LONG_RIVER: { plan: CityPlanInput; lots: NetworkLot[] } = {
  plan: { ...PLAN, id: 'long_river', size: [445, 820], lines: (PLAN.lines ?? []).map((line) => (line.kind === 'river' ? { ...line, points: [[-20, -410], [-20, 410]] as const } : line)) },
  lots: [...LOTS],
}
