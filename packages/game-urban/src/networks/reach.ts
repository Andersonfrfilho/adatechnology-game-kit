import type { UtilityConnection } from '@adatechnology/game-contracts'

import { frameOf, ordinal } from './frame'
import type { NetworkLayoutRules } from './layout-rules'
import { piecesOf } from './pole-layout'
import type { PoleStation } from './pole-layout'
import type { ServedLot, StreetRun } from './runs'

export type ReachParams = {
  /** The stations of each run, in order along it. */
  readonly runs: ReadonlyArray<readonly PoleStation[]>
  /** The points the drops must reach (power and telecom anchors). */
  readonly anchors: readonly UtilityConnection[]
  readonly served: ReadonlyMap<string, ServedLot>
  /** Longest drop, metres. */
  readonly reach: number
  readonly rules: NetworkLayoutRules
  readonly isFree: (x: number, z: number) => boolean
}

export type Reached = {
  /** The stations of each run with the poles added to reach the lots, renumbered in order. */
  readonly runs: PoleStation[][]
  /** Service poles into a lot set back from its street: each chain starts at the street pole it hangs from. */
  readonly chains: PoleStation[][]
}

const distance = (station: PoleStation, anchor: UtilityConnection): number => Math.hypot(station.x - anchor.at[0], station.z - anchor.at[2])

/** An in-line station on the run's pole line at the lot's own station, inside a stretch and on free ground, or none. */
function inLine({ run, stations, anchor, params }: { readonly run: StreetRun; readonly stations: readonly PoleStation[]; readonly anchor: UtilityConnection; readonly params: ReachParams }): PoleStation | undefined {
  const { poles } = params.rules
  const [u] = frameOf({ frame: run, x: anchor.at[0], z: anchor.at[2] })
  const side = stations[0]?.side ?? -1
  const lateral = side * (run.width / 2 + poles.curbSetback)
  for (const piece of piecesOf(run)) {
    const [low, high] = [piece.from + poles.crossingClearance, piece.to - poles.crossingClearance]
    if (u < piece.from || u > piece.to || high < low) continue
    for (let step = 0; step <= poles.slide / poles.slideStep; step++) {
      for (const offset of step === 0 ? [0] : [step * poles.slideStep, -step * poles.slideStep]) {
        const at = Math.min(Math.max(u + offset, low), high)
        const [x, z] = run.along === 'x' ? [at, run.axis + lateral] : [run.axis + lateral, at]
        if (params.isFree(x, z)) return { id: '', run, side, u: at, x, z, role: 'line' }
      }
    }
  }
  return undefined
}

/** Service poles from `from` toward the anchor, at most a span apart, until the anchor is within a drop. */
function chainTo({ from, anchor, params }: { readonly from: PoleStation; readonly anchor: UtilityConnection; readonly params: ReachParams }): PoleStation[] {
  const gap = distance(from, anchor)
  const count = Math.ceil((gap - (params.reach - 1)) / params.rules.poles.spacing[1])
  return Array.from({ length: Math.max(0, count) }, (_, index): PoleStation => {
    const share = (params.rules.poles.spacing[1] * (index + 1)) / gap
    const [x, z] = [from.x + (anchor.at[0] - from.x) * share, from.z + (anchor.at[2] - from.z) * share]
    return { ...from, id: `pole:${from.run.id}:lot:${anchor.lot}:${ordinal(index)}`, x, z, role: 'service' }
  })
}

/**
 * Poles added where a lot's anchor is out of a drop's reach (design §4): first an in-line pole on its street at the lot's station; when the
 * lot stands farther back than a drop, service poles into it, a span apart, from that pole.
 */
export function reachLots(params: ReachParams): Reached {
  const runs = params.runs.map((stations) => [...stations])
  const chains: PoleStation[][] = []
  const all = (): PoleStation[] => [...runs.flat(), ...chains.flat()]
  for (const anchor of params.anchors) {
    if (all().some((station) => distance(station, anchor) <= params.reach - 1e-6)) continue
    const served = params.served.get(anchor.lot)
    const index = runs.findIndex((stations) => stations[0]?.run.id === served?.run.id)
    const stations = runs[index]
    if (served === undefined || stations === undefined) continue
    const added = inLine({ run: served.run, stations, anchor, params })
    if (added !== undefined) stations.push(added)
    stations.sort((a, b) => a.u - b.u)
    const from = added ?? [...stations].sort((a, b) => distance(a, anchor) - distance(b, anchor))[0]
    if (from !== undefined && distance(from, anchor) > params.reach - 1e-6) chains.push([from, ...chainTo({ from, anchor, params })])
  }
  return { runs: runs.map((stations) => stations.map((station, index) => ({ ...station, id: `pole:${station.run.id}:${ordinal(index)}` }))), chains }
}
