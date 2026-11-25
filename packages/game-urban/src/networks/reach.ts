import type { UtilityConnection } from '@adatechnology/game-contracts'

import { frameOf, ordinal } from './frame'
import { dropMisfitOf, lotUnderDrop } from './drop-rules'
import type { LotFrontage } from './drop-rules'
import type { NetworkLayoutRules } from './layout-rules'
import type { PowerRules } from './rules'
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
  /** The lots' fronts and the drop rules: a power anchor is fed from a pole in front of it or straight across, never over another lot. */
  readonly frontages: ReadonlyMap<string, LotFrontage>
  readonly power: Pick<PowerRules, 'dropMaxSkew' | 'dropFrontageSlack' | 'dropsPerPole'>
}

export type Reached = {
  /** The stations of each run with the poles added to reach the lots, renumbered in order. */
  readonly runs: PoleStation[][]
  /** Service poles into a lot set back from its street: each chain starts at the street pole it hangs from. */
  readonly chains: PoleStation[][]
  /** The pole (where it stands) each lot's drop of each network leaves from, by `feedKey`. */
  readonly feeds: ReadonlyMap<string, { readonly x: number; readonly z: number }>
}

/** The key of a lot's drop of one network in `Reached.feeds`. */
export const feedKey = (anchor: Pick<UtilityConnection, 'lot' | 'network'>): string => `${anchor.lot}:${anchor.network}`

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

/** Whether a pole may feed the anchor: in reach, in front of the lot or straight across, over no other lot. */
export function feedsAnchor({ station, anchor, params }: { readonly station: { readonly x: number; readonly z: number }; readonly anchor: UtilityConnection; readonly params: Pick<ReachParams, 'reach' | 'frontages' | 'power'> }): boolean {
  if (Math.hypot(station.x - anchor.at[0], station.z - anchor.at[2]) > params.reach - 1e-6) return false
  const frontage = params.frontages.get(anchor.lot)
  if (!frontage) return true
  if (dropMisfitOf({ frontage, pole: station, anchor: anchor.at, rules: params.power }) !== undefined) return false
  return lotUnderDrop({ from: [station.x, station.z], to: [anchor.at[0], anchor.at[2]], lot: anchor.lot, frontages: [...params.frontages.values()] }) === undefined
}

/**
 * Poles added where a lot's anchor has no pole to feed it (design §4): the nearest pole in front of the lot or straight across the street with
 * room for one more drop (`dropsPerPole`); with none, an in-line pole on its street at the lot's station, and when the lot stands farther back
 * than a drop, service poles into it from that pole.
 */
export function reachLots(params: ReachParams): Reached {
  const runs = params.runs.map((stations) => [...stations])
  const chains: PoleStation[][] = []
  const feeds = new Map<string, PoleStation>()
  const load = new Map<PoleStation, number>()
  const all = (): PoleStation[] => [...runs.flat(), ...chains.flat()]
  const take = (anchor: UtilityConnection, station: PoleStation): void => {
    feeds.set(feedKey(anchor), station)
    if (anchor.network === 'power') load.set(station, (load.get(station) ?? 0) + 1)
  }
  const free = (station: PoleStation): boolean => (load.get(station) ?? 0) < params.power.dropsPerPole
  // power first, so a telecom drop can leave the pole its lot's power drop leaves
  const anchors = [...params.anchors].sort((a, b) => (a.network === 'power' ? 0 : 1) - (b.network === 'power' ? 0 : 1))
  for (const anchor of anchors) {
    const isPower = anchor.network === 'power'
    const fits = (station: PoleStation): boolean => feedsAnchor({ station, anchor, params }) && (!isPower || free(station))
    const power = feeds.get(`${anchor.lot}:power`)
    const nearest = power !== undefined && !isPower && fits(power) ? power : all().filter(fits).sort((a, b) => distance(a, anchor) - distance(b, anchor))[0]
    if (nearest) {
      take(anchor, nearest)
      continue
    }
    const served = params.served.get(anchor.lot)
    const stations = runs.find((entry) => entry[0]?.run.id === served?.run.id)
    if (served === undefined || stations === undefined) continue
    const added = inLine({ run: served.run, stations, anchor, params })
    if (added !== undefined) stations.push(added)
    stations.sort((a, b) => a.u - b.u)
    const from = added ?? [...stations].sort((a, b) => distance(a, anchor) - distance(b, anchor))[0]
    if (from === undefined) continue
    if (distance(from, anchor) <= params.reach - 1e-6) {
      if (!fits(from)) params.warn({ code: 'drop_off_practice', id: anchor.lot, detail: 'no pole in front of the lot or straight across the street' })
      take(anchor, from)
      continue
    }
    const chain = chainTo({ from, anchor, params })
    if (chain === undefined) continue
    chains.push([from, ...chain])
    take(anchor, chain[chain.length - 1] ?? from)
  }
  const renumbered = runs.map((stations) => stations.map((station, index) => ({ ...station, id: `pole:${station.run.id}:${ordinal(index)}` })))
  return { runs: renumbered, chains, feeds: new Map([...feeds].map(([lot, station]) => [lot, { x: station.x, z: station.z }])) }
}
