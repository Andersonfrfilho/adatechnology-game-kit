import type { PlanRect } from '../cities/types'
import { worldOf } from './frame'
import type { NetworkLayoutRules } from './layout-rules'
import type { RunEnd, ServedLot, StreetRun } from './runs'

/** Where a pole stands: its run, its station along it, the world point and whether it is a corner, an end of line or in line. */
export type PoleStation = {
  readonly run: StreetRun
  readonly side: 1 | -1
  readonly u: number
  readonly x: number
  readonly z: number
  readonly role: 'corner' | 'end' | 'line'
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
}

const inside = (x: number, z: number, rect: PlanRect): boolean => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3]

/** The stations of one stretch: a corner or end pole at each end, and in-line poles every 30 to 40 m on lot boundaries, clear of gates. */
function piecePoles(piece: Piece, params: PoleLayoutParams, boundaries: readonly number[]): Array<Omit<PoleStation, 'run' | 'side' | 'x' | 'z'>> {
  const { poles } = params.rules
  const lateral = params.side * (params.run.width / 2 + poles.curbSetback)
  const isFree = (u: number): boolean => {
    const [x, z] = worldOf(params.run.along, params.run.axis, u, lateral)
    return !params.avoid.some((rect) => inside(x, z, rect))
  }
  const endAt = (end: PieceEnd, at: number, inward: 1 | -1): { u: number; role: 'corner' | 'end' } =>
    end === 'crossing' ? { u: at + inward * poles.curbSetback, role: 'corner' } : { u: at + inward * poles.endInset, role: 'end' }
  const first = endAt(piece.ends[0], piece.from, 1)
  const last = endAt(piece.ends[1], piece.to, -1)
  if (last.u - first.u < poles.spacing[0] / 4) return [{ u: (first.u + last.u) / 2, role: first.role }]
  const low = piece.ends[0] === 'crossing' ? piece.from + poles.crossingClearance : first.u
  const high = piece.ends[1] === 'crossing' ? piece.to - poles.crossingClearance : last.u
  const out: Array<Omit<PoleStation, 'run' | 'side' | 'x' | 'z'>> = [first]
  let at = first.u
  while (last.u - at > poles.spacing[1]) {
    const target = at + (last.u - at) / Math.ceil((last.u - at) / poles.spacing[1])
    const reach = Math.min(at + poles.spacing[1], high)
    const near = boundaries.filter((u) => u >= Math.max(target - poles.snap, low, at + 1) && u <= Math.min(target + poles.snap, reach))
    const snapped = [...near].sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)[0] ?? Math.min(Math.max(target, low), high)
    const next = slideClear(snapped, isFree, low, high, poles)
    if (next <= at + 1) break
    out.push({ u: next, role: 'line' })
    at = next
  }
  out.push(last)
  return out
}

/** The nearest station to `u` (0, then ±step, ±2 steps...) on free ground within `[low, high]`, up to the slide; `u` itself when none is free. */
function slideClear(u: number, isFree: (u: number) => boolean, low: number, high: number, poles: NetworkLayoutRules['poles']): number {
  for (let step = 0; step <= poles.slide / poles.slideStep; step++) {
    for (const offset of step === 0 ? [0] : [step * poles.slideStep, -step * poles.slideStep]) {
      const candidate = u + offset
      if (candidate >= low && candidate <= high && isFree(candidate)) return candidate
    }
  }
  return u
}

/** Every pole station of a run, in order along it: corners at the cross streets, ends at the river and the line ends, in-line poles between. */
export function poleStationsOf(params: PoleLayoutParams): PoleStation[] {
  const { run, side, rules } = params
  const boundaries = [...new Set(params.served.filter((entry) => entry.run.id === run.id).flatMap((entry) => [entry.span[0], entry.span[1]]))].sort((a, b) => a - b)
  const lateral = side * (run.width / 2 + rules.poles.curbSetback)
  return piecesOf(run).flatMap((piece) =>
    piecePoles(piece, params, boundaries).map((station) => {
      const [x, z] = worldOf(run.along, run.axis, station.u, lateral)
      return { ...station, run, side, x, z }
    }),
  )
}
