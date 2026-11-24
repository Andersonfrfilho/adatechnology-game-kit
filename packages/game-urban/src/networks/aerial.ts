import type { UtilityConnection } from '@adatechnology/game-contracts'

import type { PoleSlots } from '../pole-specs'
import { circuitsOf, distancesWithin } from './circuits'
import type { Circuit } from './circuits'
import { worldOf } from './frame'
import { spanLength } from './pole-tree'
import type { NetworkPole, PoleSystem, PoleTree } from './pole-tree'
import type { NetworkRules } from './rules'
import type { NetworkEdge, NetworkKind, NetworkNode } from './types'

/** What the layers of the generator add to. */
export type NetworkSink = { readonly nodes: NetworkNode[]; readonly edges: NetworkEdge[] }

/** The fixing heights over the ground, read from the pole's bands. */
export type PoleHeights = { readonly mv: number; readonly transformer: number; readonly transformerBottom: number; readonly lv: number; readonly lamp: number; readonly telecom: number }

export function poleHeightsOf(slots: PoleSlots): PoleHeights {
  const { mv, transformer, lv, lighting, telecom } = slots.bands
  return { mv: mv[1], transformer: (transformer[0] + transformer[1]) / 2, transformerBottom: transformer[0], lv: lv[1] - 0.1, lamp: lighting[0] + 0.1, telecom: telecom[1] }
}

export type AerialParams = {
  readonly tree: PoleTree
  readonly connections: readonly UtilityConnection[]
  readonly rules: NetworkRules
  readonly heights: PoleHeights
  readonly poleSpec: string
  /** Lots with a drop and no meter (illegal hookups): linked as any other, counted in the load. */
  readonly unmetered: ReadonlySet<string>
  readonly sink: NetworkSink
}

/** The nearest pole to a point in plan. */
export function nearestPole(tree: PoleTree, x: number, z: number): NetworkPole | undefined {
  let best: NetworkPole | undefined
  for (const pole of tree.poles.values()) if (best === undefined || Math.hypot(pole.station.x - x, pole.station.z - z) < Math.hypot(best.station.x - x, best.station.z - z) - 1e-9) best = pole
  return best
}

/** The lamp of a pole: on its arm over the road, `lampReach` from the axis toward the street. */
export function lampOf(pole: NetworkPole, rules: NetworkRules): readonly [number, number] {
  const { run, side, u } = pole.station
  return worldOf(run.along, run.axis, u, side * (run.width / 2 + rules.layout.poles.curbSetback - rules.layout.lampReach))
}

/** The circuits of every system, with the poles the medium voltage must reach (the path from the feed to each transformer). */
export function powerPlanOf(params: AerialParams, drops: ReadonlyMap<string, readonly UtilityConnection[]>): Array<{ system: PoleSystem; circuits: Circuit[]; medium: Set<string> }> {
  const span = (a: string, b: string): number => spanLength(params.tree, a, b)
  return params.tree.systems.map((system) => {
    const consumers = new Map(system.poles.map((pole) => [pole, (drops.get(pole) ?? []).map((connection) => connection.installedKva ?? 0)]))
    const circuits = circuitsOf({ system, consumers, span, rules: params.rules })
    const medium = new Set<string>()
    for (const circuit of circuits) {
      for (let pole: string | undefined = circuit.transformer; pole !== undefined && !medium.has(pole); pole = system.parent.get(pole)) medium.add(pole)
    }
    return { system, circuits, medium }
  })
}

/** Medium voltage from each feed to the transformers, each circuit's low voltage from its transformer, a lamp on every pole and a drop to every lot. */
export function layPower(params: AerialParams): void {
  const { tree, heights, rules, sink } = params
  const sag = rules.layout.sag
  const drops = new Map<string, UtilityConnection[]>()
  for (const connection of params.connections) {
    const pole = nearestPole(tree, connection.at[0], connection.at[2])
    if (pole !== undefined) drops.set(pole.id, [...(drops.get(pole.id) ?? []), connection])
  }
  for (const { system, circuits, medium } of powerPlanOf(params, drops)) {
    const feed = `feed:${system.root}`
    sink.nodes.push({ id: feed, kind: 'feed', at: [system.feed[0], heights.mv, system.feed[1]], carries: ['power_mv'] })
    for (const id of system.poles) {
      const pole = tree.poles.get(id) as NetworkPole
      const carries: NetworkKind[] = [...(medium.has(id) ? (['power_mv'] as const) : []), 'power_lv', 'lighting', 'telecom']
      sink.nodes.push({ id, kind: 'pole', at: [pole.station.x, 0, pole.station.z], carries, spec: params.poleSpec, ...(pole.station.role === 'line' ? {} : { guyed: true }) })
      const up = system.parent.get(id)
      if (medium.has(id)) sink.edges.push({ id: `mv:${id}`, kind: 'mv_span', from: up ?? feed, to: id, sag: sag.mv, heights: [heights.mv, heights.mv], conductors: 3 })
      const lamp = lampOf(pole, rules)
      sink.nodes.push({ id: `light:${id}`, kind: 'light', at: [lamp[0], heights.lamp, lamp[1]], carries: ['lighting'], spec: 'street_light' })
      sink.edges.push({ id: `light_feed:${id}`, kind: 'light_feed', from: id, to: `light:${id}`, sag: 0, heights: [heights.lv, heights.lamp] })
    }
    for (const circuit of circuits) layCircuit(params, system, circuit)
  }
  for (const [poleId, connections] of drops) {
    for (const connection of connections) {
      const node = `lot:${connection.lot}:power`
      sink.nodes.push({ id: node, kind: 'connection', at: connection.at, carries: ['power_lv'], lot: connection.lot, ...(params.unmetered.has(connection.lot) ? { spec: 'unmetered' } : {}) })
      sink.edges.push({ id: `drop:${connection.lot}`, kind: 'service_drop', from: poleId, to: node, sag: sag.drop, heights: [heights.lv, connection.at[1]], conductors: 2 })
    }
  }
}

/** The transformer on its pole, fed by the medium voltage, and the low voltage spans out from it over the circuit's poles. */
function layCircuit(params: AerialParams, system: PoleSystem, circuit: Circuit): void {
  const { tree, heights, sink } = params
  const pole = tree.poles.get(circuit.transformer) as NetworkPole
  const id = `transformer:${circuit.transformer}`
  sink.nodes.push({ id, kind: 'transformer', at: [pole.station.x, heights.transformer, pole.station.z], carries: ['power_mv', 'power_lv'], spec: circuit.rating })
  sink.edges.push({ id: `mv:${id}`, kind: 'mv_span', from: circuit.transformer, to: id, sag: 0, heights: [heights.mv, heights.transformer] })
  sink.edges.push({ id: `lv:${circuit.transformer}`, kind: 'lv_span', from: id, to: circuit.transformer, sag: 0, heights: [heights.transformerBottom, heights.lv] })
  const order = [...distancesWithin(circuit.poles, circuit.transformer, system, (a, b) => spanLength(tree, a, b)).entries()].sort((a, b) => a[1] - b[1])
  const members = new Set(circuit.poles)
  const reached = new Set([circuit.transformer])
  for (const [from] of order) {
    const up = system.parent.get(from)
    const near = [...(system.children.get(from) ?? []), ...(up === undefined ? [] : [up])].filter((next) => members.has(next) && !reached.has(next))
    for (const next of near) {
      reached.add(next)
      sink.edges.push({ id: `lv:${next}`, kind: 'lv_span', from, to: next, sag: params.rules.layout.sag.lv, heights: [heights.lv, heights.lv], conductors: 4 })
    }
  }
}
