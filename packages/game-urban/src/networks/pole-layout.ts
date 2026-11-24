import type { PlanRect } from '../cities/types'
import { ordinal, worldOf } from './frame'
import type { NetworkLayoutRules } from './layout-rules'
import type { RunEnd, ServedLot, StreetRun } from './runs'
import type { NetworkWarning } from './warnings'

/** Where a pole stands: its id, its run, its station along it, the world point and its role (corner, end of line, in line, or a service pole inside a lot). */
export type PoleStation = {
  readonly id: string
  readonly run: StreetRun
  readonly side: 1 | -1
  readonly u: number
  readonly x: number
  readonly z: number
  readonly role: 'corner' | 'end' | 'line' | 'service'
}

type PieceEnd = RunEnd | 'crossing'
type Piece = { readonly from: number; readonly to: number; readonly ends: readonly [PieceEnd, PieceEnd] }

/** The sidewalk stretches of a run between the cross streets' roadways. */
export function piecesOf(run: StreetRun): Piece[] {
  const out: Piece[] = []
  let start = run.from
  let startEnd: PieceEnd = run.ends[0]
  for (const crossing of run.crossings) {
    out.push({ from: start, to: crossing.at - crossing.half, ends: [startEnd, 'crossing'] })
    start = crossing.at + crossing.half
    startEnd = 'crossing'
  }
  out.push({ from: start, to: run.to, ends: [startEnd, run.ends[1]] })
  return out.filter((piece) => piece.to - piece.from > 1)
}

export type PoleLayoutParams = {
  readonly run: StreetRun
  readonly side: 1 | -1
  readonly served: readonly ServedLot[]
  readonly avoid: readonly PlanRect[]
  readonly rules: NetworkLayoutRules
  /** Where something must stand clear of a gate that no free ground could clear is told here. */
  readonly warn: (warning: NetworkWarning) => void
}

type Placed = { readonly u: number; readonly role: PoleStation['role'] }
type Bounds = { readonly low: number; readonly high: number }

const inside = (x: number, z: number, rect: PlanRect): boolean => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3]

/** The pole line of a run: `u` to the world, and whether a station is clear of every `avoid` rectangle. */
function lineOf(params: PoleLayoutParams): { place: (u: number) => readonly [number, number]; isFree: (u: number) => boolean } {
  const lateral = params.side * (params.run.width / 2 + params.rules.poles.curbSetback)
  const place = (u: number): readonly [number, number] => worldOf({ frame: params.run, u, v: lateral })
  return { place, isFree: (u) => !params.avoid.some((rect) => inside(...place(u), rect)) }
}

/** The nearest free station to `u` within `bounds` (0, then ±step, ±2 steps... up to the slide), or none. */
function slideClear({ u, bounds, isFree, poles }: { readonly u: number; readonly bounds: Bounds; readonly isFree: (u: number) => boolean; readonly poles: NetworkLayoutRules['poles'] }): number | undefined {
  for (let step = 0; step <= poles.slide / poles.slideStep; step++) {
    for (const offset of step === 0 ? [0] : [step * poles.slideStep, -step * poles.slideStep]) {
      const candidate = u + offset
      if (candidate >= bounds.low && candidate <= bounds.high && isFree(candidate)) return candidate
    }
  }
  return undefined
}

/**
 * The next in-line station after `at`, toward `last`: the lot boundary nearest the even target, slid clear of gates, never beyond the
 * longest span. With no free ground near the target it tries the other boundaries in reach, then any free station in reach; with none, it
 * stands at the target and warns.
 */
function nextStation({ at, last, bounds, boundaries, params }: { readonly at: number; readonly last: number; readonly bounds: Bounds; readonly boundaries: readonly number[]; readonly params: PoleLayoutParams }): number {
  const { poles } = params.rules
  const { isFree } = lineOf(params)
  const target = at + (last - at) / Math.ceil((last - at) / poles.spacing[1])
  const reach: Bounds = { low: Math.max(bounds.low, at + 1), high: Math.min(bounds.high, at + poles.spacing[1]) }
  const inReach = boundaries.filter((u) => u >= reach.low && u <= reach.high).sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)
  const first = inReach[0] !== undefined && Math.abs(inReach[0] - target) <= poles.snap ? inReach[0] : Math.min(Math.max(target, reach.low), reach.high)
  for (const candidate of [first, ...inReach]) {
    const slid = slideClear({ u: candidate, bounds: reach, isFree, poles })
    if (slid !== undefined) return slid
  }
  for (let u = reach.high; u >= reach.low; u -= poles.slideStep) if (isFree(u)) return u
  params.warn({ code: 'pole_on_avoid', id: `${params.run.id}@${first.toFixed(2)}` })
  return first
}

/** The stations of one stretch: a corner or end pole at each end, and in-line poles every 30 to 40 m on lot boundaries, clear of gates. */
function piecePoles({ piece, params, boundaries }: { readonly piece: Piece; readonly params: PoleLayoutParams; readonly boundaries: readonly number[] }): Placed[] {
  const { poles } = params.rules
  const { isFree } = lineOf(params)
  // a corner or end pole slides inward off a gate (up to the slide), and warns when it finds no free ground
  const endAt = (end: PieceEnd, at: number, inward: 1 | -1): Placed => {
    const u = at + inward * (end === 'crossing' ? poles.curbSetback : poles.endInset)
    const role = end === 'crossing' ? 'corner' : 'end'
    for (let step = 0; step <= poles.slide / poles.slideStep; step++) {
      const candidate = u + inward * step * poles.slideStep
      if (isFree(candidate)) return { u: candidate, role }
    }
    params.warn({ code: 'pole_on_avoid', id: `${params.run.id}@${u.toFixed(2)}` })
    return { u, role }
  }
  const first = endAt(piece.ends[0], piece.from, 1)
  const last = endAt(piece.ends[1], piece.to, -1)
  if (last.u - first.u < poles.spacing[0] / 4) return [{ u: (first.u + last.u) / 2, role: first.role }]
  const bounds: Bounds = {
    low: piece.ends[0] === 'crossing' ? piece.from + poles.crossingClearance : first.u,
    high: piece.ends[1] === 'crossing' ? piece.to - poles.crossingClearance : last.u,
  }
  const out: Placed[] = [first]
  let at = first.u
  while (last.u - at > poles.spacing[1]) {
    const next = nextStation({ at, last: last.u, bounds, boundaries, params })
    if (next <= at + 1) break
    out.push({ u: next, role: 'line' })
    at = next
  }
  out.push(last)
  return out
}

/** Every pole station of a run, in order along it: corners at the cross streets, ends at the river and the line ends, in-line poles between. */
export function poleStationsOf(params: PoleLayoutParams): PoleStation[] {
  const { run, side } = params
  const boundaries = [...new Set(params.served.filter((entry) => entry.run.id === run.id).flatMap((entry) => [entry.span[0], entry.span[1]]))].sort((a, b) => a - b)
  const { place } = lineOf(params)
  return piecesOf(run)
    .flatMap((piece) => piecePoles({ piece, params, boundaries }))
    .map((station, index) => {
      const [x, z] = place(station.u)
      return { ...station, id: `pole:${run.id}:${ordinal(index)}`, run, side, x, z }
    })
}
