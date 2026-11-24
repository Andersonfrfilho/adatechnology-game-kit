import type { UtilityConnection } from '@adatechnology/game-contracts'

import { frameOf, ordinal } from './frame'
import type { NetworkLayoutRules } from './layout-rules'
import { piecesOf } from './pole-layout'
import type { PoleStation } from './pole-layout'
import type { ServedLot, StreetRun } from './runs'
import type { NetworkWarning } from './warnings'

export type ReachParams = {
  /** The stations of each run, in order along it. */
  readonly runs: ReadonlyArray<readonly PoleStation[]>
  /** The points the drops must reach (power and telecom anchors). */
  readonly anchors: readonly UtilityConnection[]
  readonly served: ReadonlyMap<string, ServedLot>
  /** Longest drop, metres. */
  readonly reach: number
  readonly rules: NetworkLayoutRules
  /** Clear of every gate, door and meter post. */
  readonly isFree: (x: number, z: number) => boolean
  /** Where a service pole of a lot may stand: off the roadway and out of every other lot. */
  readonly canServe: (point: { readonly x: number; readonly z: number; readonly lot: string }) => boolean
  readonly warn: (warning: NetworkWarning) => void
}

export type Reached = {
  /** The stations of each run with the poles added to reach the lots, renumbered in order. */
  readonly runs: PoleStation[][]
  /** Service poles into a lot set back from its street: each chain starts at the street pole it hangs from. */
  readonly chains: PoleStation[][]
}

const distance = (station: PoleStation, anchor: UtilityConnection): number => Math.hypot(station.x - anchor.at[0], station.z - anchor.at[2])

type InLineParams = { readonly run: StreetRun; readonly stations: readonly PoleStation[]; readonly anchor: UtilityConnection; readonly params: ReachParams }

/** An in-line station on the run's pole line at the lot's own station, inside a stretch, on free ground and `minGap` from every pole, or none. */
function inLine({ run, stations, anchor, params }: InLineParams): PoleStation | undefined {
  const { poles } = params.rules
  const [u] = frameOf({ frame: run, x: anchor.at[0], z: anchor.at[2] })
  const side = stations[0]?.side ?? -1
  const lateral = side * (run.width / 2 + poles.curbSetback)
  const clear = (at: number): boolean => stations.every((station) => Math.abs(station.u - at) >= poles.minGap)
  for (const piece of piecesOf(run)) {
    const [low, high] = [piece.from + poles.crossingClearance, piece.to - poles.crossingClearance]
    if (u < piece.from || u > piece.to || high < low) continue
    for (let step = 0; step <= poles.slide / poles.slideStep; step++) {
      for (const offset of step === 0 ? [0] : [step * poles.slideStep, -step * poles.slideStep]) {
        const at = Math.min(Math.max(u + offset, low), high)
        const [x, z] = run.along === 'x' ? [at, run.axis + lateral] : [run.axis + lateral, at]
        if (params.isFree(x, z) && clear(at)) return { id: '', run, side, u: at, x, z, role: 'line' }
      }
    }
  }
  return undefined
}

/**
 * Service poles from `from` toward the anchor, evenly spaced (`gap / (count + 1)`, never past the anchor), as few as keep each span within
 * the longest and the last drop within reach. Each stands on ground a pole may take (slid along the line up to the slide); with none, the
 * lot is told out of reach and no chain is laid.
 */
function chainTo({ from, anchor, params }: { readonly from: PoleStation; readonly anchor: UtilityConnection; readonly params: ReachParams }): PoleStation[] | undefined {
  const { poles } = params.rules
  const gap = distance(from, anchor)
  const count = Math.max(0, Math.ceil(gap / poles.spacing[1]) - 1, Math.ceil(gap / (params.reach - 1)) - 1)
  const out: PoleStation[] = []
  for (let index = 0; index < count; index++) {
    const even = ((index + 1) * gap) / (count + 1)
    const offsets = [0, ...Array.from({ length: Math.floor(poles.slide / poles.slideStep) }, (_, step) => [(step + 1) * poles.slideStep, -(step + 1) * poles.slideStep]).flat()]
    const spot = offsets.map((offset) => Math.min(Math.max(even + offset, 1), gap - 1) / gap).map((share) => ({ x: from.x + (anchor.at[0] - from.x) * share, z: from.z + (anchor.at[2] - from.z) * share })).find((point) => params.isFree(point.x, point.z) && params.canServe({ ...point, lot: anchor.lot }))
    if (spot === undefined) {
      params.warn({ code: 'lot_out_of_reach', id: anchor.lot, detail: `${gap.toFixed(1)} m` })
      return undefined
    }
    out.push({ ...from, id: `pole:${from.run.id}:lot:${anchor.lot}:${ordinal(index)}`, x: spot.x, z: spot.z, role: 'service' })
  }
  return out
}

/**
 * Poles added where a lot's anchor is out of a drop's reach (design §4): first an in-line pole on its street at the lot's station; when the
 * lot stands farther back than a drop, service poles into it from that pole.
 */
export function reachLots(params: ReachParams): Reached {
  const runs = params.runs.map((stations) => [...stations])
  const chains: PoleStation[][] = []
  const all = (): PoleStation[] => [...runs.flat(), ...chains.flat()]
  for (const anchor of params.anchors) {
    if (all().some((station) => distance(station, anchor) <= params.reach - 1e-6)) continue
    const served = params.served.get(anchor.lot)
    const stations = runs.find((entry) => entry[0]?.run.id === served?.run.id)
    if (served === undefined || stations === undefined) continue
    const added = inLine({ run: served.run, stations, anchor, params })
    if (added !== undefined) stations.push(added)
    stations.sort((a, b) => a.u - b.u)
    const from = added ?? [...stations].sort((a, b) => distance(a, anchor) - distance(b, anchor))[0]
    if (from === undefined || distance(from, anchor) <= params.reach - 1e-6) continue
    const chain = chainTo({ from, anchor, params })
    if (chain !== undefined) chains.push([from, ...chain])
  }
  return { runs: runs.map((stations) => stations.map((station, index) => ({ ...station, id: `pole:${station.run.id}:${ordinal(index)}` }))), chains }
}
