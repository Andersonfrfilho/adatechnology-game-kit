import type { UtilityConnection } from '@adatechnology/game-contracts'

import { nearestPole } from './aerial'
import type { NetworkSink, PoleHeights } from './aerial'
import { countOf } from './frame'
import type { NetworkPole, PoleTree } from './pole-tree'
import type { NetworkRules } from './rules'

export type TelecomParams = {
  readonly tree: PoleTree
  readonly connections: readonly UtilityConnection[]
  readonly rules: NetworkRules
  readonly heights: PoleHeights
  readonly seed: number
  /** The periphery (a bundle of 3 to 5 cables) or a clean district (1 or 2), at a point. */
  readonly isPeriphery: (x: number, z: number) => boolean
  readonly sink: NetworkSink
}

/** Cables of the bundle that reaches a pole: one draw per run, by the hash of the seed and the run (the same street keeps its bundle). */
export function cablesAt(pole: NetworkPole, params: Pick<TelecomParams, 'rules' | 'seed' | 'isPeriphery'>): number {
  const { cables } = params.rules.layout.telecom
  return countOf(params.seed, `telecom:${pole.station.run.id}`, params.isPeriphery(pole.station.x, pole.station.z) ? cables.periphery : cables.clean)
}

/**
 * The telecom bundle over every system's poles from its feed, on the top cable of the telecom band, with a splice box and reserve coil
 * every few spans (on the span into the pole, near it), and a drop from the nearest pole to every lot.
 */
export function layTelecom(params: TelecomParams): void {
  const { tree, heights, rules, sink } = params
  const { sag, telecom } = rules.layout
  for (const system of tree.systems) {
    const feed = `feed:telecom:${system.root}`
    sink.nodes.push({ id: feed, kind: 'feed', at: [system.feed[0], heights.telecom, system.feed[1]], carries: ['telecom'] })
    for (const id of system.poles) {
      const pole = tree.poles.get(id) as NetworkPole
      const up = system.parent.get(id)
      const conductors = cablesAt(pole, params)
      const depth = system.depth.get(id) ?? 0
      if (up === undefined || depth % telecom.spliceEvery !== 0) {
        sink.edges.push({ id: `telecom:${id}`, kind: 'telecom_span', from: up ?? feed, to: id, sag: sag.telecom, heights: [heights.telecom, heights.telecom], conductors })
        continue
      }
      const parent = tree.poles.get(up) as NetworkPole
      const length = Math.hypot(parent.station.x - pole.station.x, parent.station.z - pole.station.z)
      const share = Math.min(0.5, 0.6 / Math.max(length, 1e-9))
      const splice = `splice:${id}`
      const at: readonly [number, number, number] = [pole.station.x + (parent.station.x - pole.station.x) * share, heights.telecom, pole.station.z + (parent.station.z - pole.station.z) * share]
      sink.nodes.push({ id: splice, kind: 'splice', at, carries: ['telecom'], spec: 'splice_reserve' })
      sink.edges.push({ id: `telecom:${splice}`, kind: 'telecom_span', from: up, to: splice, sag: sag.telecom, heights: [heights.telecom, heights.telecom], conductors })
      sink.edges.push({ id: `telecom:${id}`, kind: 'telecom_span', from: splice, to: id, sag: 0, heights: [heights.telecom, heights.telecom], conductors })
    }
  }
  for (const connection of params.connections) {
    const pole = nearestPole(tree, connection.at[0], connection.at[2])
    if (pole === undefined) continue
    const node = `lot:${connection.lot}:telecom`
    sink.nodes.push({ id: node, kind: 'connection', at: connection.at, carries: ['telecom'], lot: connection.lot })
    sink.edges.push({ id: `telecom_drop:${connection.lot}`, kind: 'telecom_drop', from: pole.id, to: node, sag: sag.telecomDrop, heights: [heights.telecom, connection.at[1]], conductors: 1 })
  }
}
