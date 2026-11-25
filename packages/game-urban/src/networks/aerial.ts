import type { UtilityConnection } from '@adatechnology/game-contracts'

import type { PoleSlots } from '../pole-specs'
import { circuitsOf, distancesWithin } from './circuits'
import type { Circuit, SpanOf } from './circuits'
import { planBins, worldOf } from './frame'
import { spanLength } from './pole-tree'
import type { NetworkPole, PoleSystem, PoleTree } from './pole-tree'
import type { NetworkRules } from './rules'
import type { NetworkEdge, NetworkKind, NetworkNode } from './types'
import type { NetworkWarning } from './warnings'

/** What the layers of the generator add to. */
export type NetworkSink = { readonly nodes: NetworkNode[]; readonly edges: NetworkEdge[]; readonly warnings: NetworkWarning[] }

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
  /** The distribution pole of the registry: its id and how far its arm hangs the lamp from the mast. */
  readonly pole: { readonly id: string; readonly lampReach: number }
  /** Lots with a drop and no meter (illegal hookups): linked as any other, counted in the load. */
  readonly unmetered: ReadonlySet<string>
  /** The pole each lot's drop leaves from (`reachLots`): in front of the lot or straight across, at most `dropsPerPole` a pole. */
  readonly feeds: ReadonlyMap<string, { readonly x: number; readonly z: number }>
  readonly sink: NetworkSink
}

/** The poles of a tree in cells, to find the nearest ones to a point. */
export function poleFinder(tree: PoleTree): (point: { readonly x: number; readonly z: number; readonly radius: number }) => NetworkPole[] {
  const bins = planBins<NetworkPole>(40)
  for (const pole of tree.poles.values()) bins.add(pole.station.x, pole.station.z, pole)
  const all = [...tree.poles.values()]
  return ({ x, z, radius }) => {
    const near = bins.near(x, z, radius)
    const pool = near.length > 0 ? near : all
    return pool.sort((a, b) => Math.hypot(a.station.x - x, a.station.z - z) - Math.hypot(b.station.x - x, b.station.z - z) || (a.id < b.id ? -1 : 1))
  }
}

/** The lamp of a pole: on its arm over the road, `lampReach` from the mast toward the street. A service pole inside a lot has none. */
export function lampOf({ pole, rules, lampReach }: { readonly pole: NetworkPole; readonly rules: NetworkRules; readonly lampReach: number }): readonly [number, number] | undefined {
  const { run, side, u, role } = pole.station
  if (role === 'service') return undefined
  return worldOf({ frame: run, u, v: side * (run.width / 2 + rules.layout.poles.curbSetback - lampReach) })
}

/** The pole that stands at a point, or none. */
export function poleAt(tree: PoleTree, at: { readonly x: number; readonly z: number } | undefined): NetworkPole | undefined {
  if (at === undefined) return undefined
  return [...tree.poles.values()].find((pole) => Math.hypot(pole.station.x - at.x, pole.station.z - at.z) < 1e-6)
}

/** Each lot's drop from the pole `reachLots` chose for it (the nearest one in reach when it chose none). */
function dropsOf(params: AerialParams): Map<string, UtilityConnection[]> {
  const find = poleFinder(params.tree)
  const out = new Map<string, UtilityConnection[]>()
  for (const connection of params.connections) {
    const pole = poleAt(params.tree, params.feeds.get(`${connection.lot}:power`)) ?? find({ x: connection.at[0], z: connection.at[2], radius: params.rules.power.dropMaxLength })[0]
    if (pole !== undefined) out.set(pole.id, [...(out.get(pole.id) ?? []), connection])
  }
  return out
}

/** The circuits of every system, with the poles the medium voltage must reach (the path from the feed to each transformer). */
export function powerPlanOf({ params, drops }: { readonly params: AerialParams; readonly drops: ReadonlyMap<string, readonly UtilityConnection[]> }): Array<{ system: PoleSystem; circuits: Circuit[]; medium: Set<string> }> {
  const span: SpanOf = ({ from, to }) => spanLength({ tree: params.tree, from, to })
  const isService = (pole: string): boolean => params.tree.poles.get(pole)?.station.role === 'service'
  return params.tree.systems.map((system) => {
    const consumers = new Map(system.poles.map((pole) => [pole, (drops.get(pole) ?? []).map((connection) => connection.installedKva ?? 0)]))
    const circuits = circuitsOf({ system, consumers, span, rules: params.rules, isService })
    // the medium voltage runs along every street pole of the feeder (a street with poles and no medium voltage reads wrong), and to each transformer
    const medium = new Set(system.poles.filter((pole) => !isService(pole)))
    for (const circuit of circuits) {
      for (let pole: string | undefined = circuit.transformer; pole !== undefined && !medium.has(pole); pole = system.parent.get(pole)) medium.add(pole)
    }
    return { system, circuits, medium }
  })
}

/** Medium voltage from each feed to the transformers, each circuit's low voltage from its transformer, a lamp on every street pole and a drop to every lot. */
export function layPower(params: AerialParams): void {
  const { tree, heights, rules, sink } = params
  const sag = rules.layout.sag
  const drops = dropsOf(params)
  for (const { system, circuits, medium } of powerPlanOf({ params, drops })) {
    const feed = `feed:${system.root}`
    sink.nodes.push({ id: feed, kind: 'feed', at: [system.feed[0], heights.mv, system.feed[1]], carries: ['power_mv'] })
    for (const id of system.poles) {
      const pole = tree.poles.get(id) as NetworkPole
      const lamp = lampOf({ pole, rules, lampReach: params.pole.lampReach })
      const carries: NetworkKind[] = [...(medium.has(id) ? (['power_mv'] as const) : []), 'power_lv', ...(lamp === undefined ? [] : (['lighting'] as const)), 'telecom']
      sink.nodes.push({ id, kind: 'pole', at: [pole.station.x, 0, pole.station.z], carries, spec: params.pole.id, ...(pole.station.role === 'line' || pole.station.role === 'service' ? {} : { guyed: true }) })
      if (medium.has(id)) sink.edges.push({ id: `mv:${id}`, kind: 'mv_span', from: system.parent.get(id) ?? feed, to: id, sag: sag.mv, heights: [heights.mv, heights.mv], conductors: 3 })
      if (lamp === undefined) continue
      sink.nodes.push({ id: `light:${id}`, kind: 'light', at: [lamp[0], heights.lamp, lamp[1]], carries: ['lighting'], spec: 'street_light' })
      sink.edges.push({ id: `light_feed:${id}`, kind: 'light_feed', from: id, to: `light:${id}`, sag: 0, heights: [heights.lv, heights.lamp] })
    }
    for (const circuit of circuits) {
      if (circuit.over) sink.warnings.push({ code: 'transformer_over_capacity', id: `transformer:${circuit.transformer}`, detail: `${circuit.demand.toFixed(1)} kVA` })
      layCircuit({ params, system, circuit })
    }
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
function layCircuit({ params, system, circuit }: { readonly params: AerialParams; readonly system: PoleSystem; readonly circuit: Circuit }): void {
  const { tree, heights, sink } = params
  const pole = tree.poles.get(circuit.transformer) as NetworkPole
  const id = `transformer:${circuit.transformer}`
  sink.nodes.push({ id, kind: 'transformer', at: [pole.station.x, heights.transformer, pole.station.z], carries: ['power_mv', 'power_lv'], spec: circuit.rating })
  sink.edges.push({ id: `mv:${id}`, kind: 'mv_span', from: circuit.transformer, to: id, sag: 0, heights: [heights.mv, heights.transformer] })
  sink.edges.push({ id: `lv:${circuit.transformer}`, kind: 'lv_span', from: id, to: circuit.transformer, sag: 0, heights: [heights.transformerBottom, heights.lv] })
  const span: SpanOf = ({ from, to }) => spanLength({ tree, from, to })
  const order = [...distancesWithin({ poles: circuit.poles, from: circuit.transformer, system, span }).entries()].sort((a, b) => a[1] - b[1])
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
