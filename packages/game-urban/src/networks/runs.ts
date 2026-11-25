import type { CityPlanInput, PlanLine, PlanRect } from '../cities/types'
import { frameOf } from './frame'
import type { RunAxis } from './frame'

/** How a run of street ends: at the map border (the line leaves the map), at a river bank, or where the line itself ends. */
export type RunEnd = 'edge' | 'river' | 'line_end'

/** Another run crossing this one: `at` is its axis along this run, `half` the half width of its roadway. */
export type RunCrossing = { readonly run: string; readonly at: number; readonly half: number }

/** A straight stretch of street between two river banks or line ends, in its own frame (`u` along, `v` across). */
export type StreetRun = {
  readonly id: string
  readonly line: string
  readonly along: RunAxis
  /** z of a street along x, x of one along z. */
  readonly axis: number
  readonly width: number
  readonly from: number
  readonly to: number
  readonly ends: readonly [RunEnd, RunEnd]
  readonly crossings: readonly RunCrossing[]
}

/** A lot of the site: its id and its rectangle on the plan. */
export type NetworkLot = { readonly id: string; readonly rect: PlanRect }

/** A lot and the run it faces: the side of the street, its span along the run and the distance from the axis to its front. */
export type ServedLot = { readonly lot: NetworkLot; readonly run: StreetRun; readonly side: 1 | -1; readonly span: readonly [number, number]; readonly front: number }

const isStreet = (line: PlanLine): boolean => line.kind === 'street' || line.kind === 'avenue'

type Segment = { readonly line: PlanLine; readonly along: RunAxis; readonly axis: number; readonly from: number; readonly to: number }

function segmentsOf(line: PlanLine): Segment[] {
  const out: Segment[] = []
  for (let index = 1; index < line.points.length; index++) {
    const [a, b] = [line.points[index - 1], line.points[index]]
    if (a === undefined || b === undefined) continue
    if (Math.abs(a[1] - b[1]) < 1e-9) out.push({ line, along: 'x', axis: a[1], from: Math.min(a[0], b[0]), to: Math.max(a[0], b[0]) })
    else if (Math.abs(a[0] - b[0]) < 1e-9) out.push({ line, along: 'z', axis: a[0], from: Math.min(a[1], b[1]), to: Math.max(a[1], b[1]) })
    else throw new Error(`networks: the line "${line.id}" has a stretch that is not along x or z; the generator lays straight streets only`)
  }
  return out
}

/** The river bands a road band of `segment` meets, as intervals along it. */
function riverCuts({ segment, rivers }: { readonly segment: Segment; readonly rivers: readonly Segment[] }): Array<readonly [number, number]> {
  const half = segment.line.width / 2
  return rivers.flatMap((river) => {
    const riverHalf = river.line.width / 2
    if (river.along === segment.along) return []
    const across = river.axis
    const reaches = segment.axis + half > river.from && segment.axis - half < river.to
    return reaches && across + riverHalf > segment.from && across - riverHalf < segment.to ? [[across - riverHalf, across + riverHalf] as const] : []
  })
}

/**
 * The runs of every street of the plan, cut at the rivers, with their crossings. Ids are the line's, with `_<n>` when a line makes more
 * than one. A run end within `edgeReach` of the map border is where the line leaves the map.
 */
export function streetRunsOf({ plan, edgeReach }: { readonly plan: CityPlanInput; readonly edgeReach: number }): StreetRun[] {
  const lines = plan.lines ?? []
  const [width, depth] = plan.size ?? [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const rivers = lines.filter((line) => line.kind === 'river').flatMap(segmentsOf)
  const isEdge = (along: RunAxis, at: number): boolean => Math.abs(at) >= (along === 'x' ? width : depth) / 2 - edgeReach
  const bare = lines.filter(isStreet).flatMap((line) => {
    const pieces = segmentsOf(line).flatMap((segment) => {
      const cuts = riverCuts({ segment, rivers }).sort((a, b) => a[0] - b[0])
      const out: Array<Omit<StreetRun, 'id' | 'crossings'>> = []
      let start = segment.from
      let startEnd: RunEnd = isEdge(segment.along, segment.from) ? 'edge' : 'line_end'
      for (const [cutFrom, cutTo] of cuts) {
        if (cutFrom > start) out.push({ line: line.id, along: segment.along, axis: segment.axis, width: line.width, from: start, to: cutFrom, ends: [startEnd, 'river'] })
        start = Math.max(start, cutTo)
        startEnd = 'river'
      }
      if (segment.to > start) out.push({ line: line.id, along: segment.along, axis: segment.axis, width: line.width, from: start, to: segment.to, ends: [startEnd, isEdge(segment.along, segment.to) ? 'edge' : 'line_end'] })
      return out
    })
    return pieces.map((piece, index) => ({ ...piece, id: pieces.length > 1 ? `${line.id}_${index}` : line.id }))
  })
  return bare.map((run) => ({ ...run, crossings: crossingsOf({ run, runs: bare }) }))
}

/**
 * The runs whose roadway this run meets: a street that crosses it, and a street it ends at or that ends at it (a T junction), so no pole
 * stands inside another street's roadway and the end at a T is a corner.
 */
function crossingsOf({ run, runs }: { readonly run: Omit<StreetRun, 'crossings'>; readonly runs: ReadonlyArray<Omit<StreetRun, 'crossings'>> }): RunCrossing[] {
  return runs
    .filter((other) => other.along !== run.along && other.axis + other.width / 2 > run.from && other.axis - other.width / 2 < run.to)
    .filter((other) => other.from <= run.axis + run.width / 2 && other.to >= run.axis - run.width / 2)
    .map((other) => ({ run: other.id, at: other.axis, half: other.width / 2 }))
    .sort((a, b) => a.at - b.at)
}

/** Distance from a lot's rectangle to a run's axis segment, and the lot in the run's frame. */
function servedBy({ lot, run }: { readonly lot: NetworkLot; readonly run: StreetRun }): ServedLot & { readonly distance: number } {
  const [x0, z0, x1, z1] = lot.rect
  const [ua, va] = frameOf({ frame: run, x: x0, z: z0 })
  const [ub, vb] = frameOf({ frame: run, x: x1, z: z1 })
  const [u0, u1, v0, v1] = [Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb)]
  const side: 1 | -1 = v0 + v1 >= 0 ? 1 : -1
  const front = side > 0 ? Math.max(0, v0) : Math.max(0, -v1)
  const du = Math.max(0, run.from - u1, u0 - run.to)
  return { lot, run, side, span: [u0, u1], front, distance: Math.hypot(du, front) }
}

/** Each lot and the run it faces: the nearest (the first of the plan on a tie). */
export function servedLotsOf({ lots, runs }: { readonly lots: readonly NetworkLot[]; readonly runs: readonly StreetRun[] }): ServedLot[] {
  return lots.flatMap((lot) => {
    let best: (ServedLot & { readonly distance: number }) | undefined
    for (const run of runs) {
      const candidate = servedBy({ lot, run })
      if (best === undefined || candidate.distance < best.distance - 1e-9) best = candidate
    }
    if (best === undefined) return []
    const { distance: _distance, ...served } = best
    return [served]
  })
}

/** The side of each run its poles stand on: the one with more lots; on a tie the north (−z) or west (−x) side. */
export function poleSidesOf({ runs, served }: { readonly runs: readonly StreetRun[]; readonly served: readonly ServedLot[] }): ReadonlyMap<string, 1 | -1> {
  return new Map(
    runs.map((run) => {
      const own = served.filter((entry) => entry.run.id === run.id)
      const plus = own.filter((entry) => entry.side > 0).length
      return [run.id, plus > own.length - plus ? 1 : -1] as const
    }),
  )
}
