import type { UtilityConnection } from '@adatechnology/game-contracts'

import { chainNodes, pipesOf, reachOf } from './buried'
import type { BuriedContext, DuctBank } from './buried'
import { chainsOf } from './chain'
import type { ChainNode, ChainStop } from './chain'
import { frameOf } from './frame'
import { lineNetworkOf } from './line-network'
import type { PoleHeights } from './aerial'
import type { StreetRun } from './runs'
import type { NetworkEdge, NetworkKind } from './types'
import { EDGE_NETWORK } from './classes'
import { circuitsOfRun, lightsOfRun } from './underground-circuits'
import type { UndergroundCircuit } from './underground-circuits'
import { layBranches } from './underground-branches'
import type { Bank } from './underground-branches'

export type UndergroundParams = {
  readonly context: BuriedContext
  /** The streets whose power runs underground. */
  readonly runs: readonly StreetRun[]
  /** The points of the lots on those streets: their power and telecom are laid, their water and sewer kept clear of. */
  readonly connections: readonly UtilityConnection[]
  /** The distribution pole of the registry the light columns are drawn as (only its lamp and arm), and its lamp's height and reach. */
  readonly column: { readonly id: string; readonly lampReach: number; readonly heights: PoleHeights }
  /** Ground a light column may stand on: the sidewalk, clear of gates and doors. */
  readonly canStand: (x: number, z: number) => boolean
  /** Stations of the pipes that already cross each street (water services, sewer boxes, inlets), which a light's cable keeps clear of. */
  readonly crossings: ReadonlyMap<string, readonly number[]>
}

export type UndergroundResult = {
  /** Every duct laid: the storm galleries and the sewer mains pass under them. */
  readonly edges: readonly NetworkEdge[]
  /** The bank of each street, for the sewer laterals of the lots on its side. */
  readonly banks: ReadonlyMap<string, DuctBank>
}

/** The bank's centre from the axis: under the sidewalk on the water's side (opposite the light columns), between the kerb and the water main. */
export const bankOffset = (context: BuriedContext, run: StreetRun): number => -(context.sides.get(run.id) ?? -1) * (run.width / 2 + context.rules.layout.underground.bankFromKerb)

/** Depths under the ground of the bank's layers: low voltage on top just under the water's crossings, telecom, medium voltage at the bottom. */
export function bankOf(context: BuriedContext): Bank {
  const { rules } = context
  const { coverMargin, water, underground } = rules.layout
  const top = Math.max(rules.cover.water_main.min + coverMargin + water.mainDiameter + rules.crossing.separation + coverMargin, rules.cover.lv_duct.min + coverMargin)
  const { lv, telecom, mv } = underground.layers
  const lvBottom = top + lv
  const telecomBottom = lvBottom + underground.layerGap + telecom
  const mvBottom = telecomBottom + underground.layerGap + mv
  return { top, lv: lvBottom, telecom: telecomBottom, mv: mvBottom }
}

/** Ducts of the bank between two boxes: one per layer, the inverts at each box's ground. */
function bankEdges({ context, bank, from, to, layers }: { readonly context: BuriedContext; readonly bank: Bank; readonly from: ChainNode; readonly to: ChainNode; readonly layers: readonly ('mv' | 'lv' | 'telecom')[] }): NetworkEdge[] {
  const { underground } = context.rules.layout
  const [groundA, groundB] = [context.groundAt(from.x, from.z), context.groundAt(to.x, to.z)]
  return layers.map((layer) => ({
    id: `duct:${layer}:${from.id}>${to.id}`,
    kind: `${layer}_duct` as const,
    from: from.id,
    to: to.id,
    diameter: underground.layers[layer],
    width: underground.bankWidth,
    inverts: [groundA - bank[layer], groundB - bank[layer]] as const,
  }))
}

/**
 * Underground power and telecom (NBR 14039, NBR 5410, the utilities' duct standards): a concrete-encased duct bank under the sidewalk on the
 * water's side of every underground street, from a feed where the line leaves the map, with a box (caixa de passagem) at every crossing, at
 * each lot and at most `boxSpacing` apart. Medium voltage and telecom run its whole length; each circuit's low voltage runs out from its
 * pad-mounted transformer on the sidewalk; a lateral from the box to each lot's meter and telecom box; a cable across the street to each light column.
 */
export function layUnderground(params: UndergroundParams): UndergroundResult {
  const { context, runs } = params
  const { rules, sink } = context
  const banks = new Map(runs.map((run): [string, DuctBank] => [run.id, { v: bankOffset(context, run), half: rules.layout.underground.bankWidth / 2, bottom: bankOf(context).mv }]))
  if (runs.length === 0) return { edges: [], banks }
  const bank = bankOf(context)
  const offset = (run: StreetRun): number => bankOffset(context, run)
  const line = lineNetworkOf({ prefix: 'duct', runs, offset, riverInset: 0, reach: reachOf(context), flow: 'supply' })
  if (line.roots.length === 0) {
    sink.warnings.push({ code: 'lot_out_of_reach', id: `duct:${runs[0]?.id ?? ''}`, detail: 'underground power with no feed at the map border' })
    return { edges: [], banks }
  }
  const columns = runs.flatMap((run) => lightsOfRun({ context, run, canStand: params.canStand, crossings: params.crossings.get(run.id) ?? [], lampReach: params.column.lampReach }))
  const circuits = runs.flatMap((run) => circuitsOfRun({ context, run, connections: params.connections, lights: columns.filter((light) => light.run.id === run.id), crossings: params.crossings.get(run.id) ?? [] }))
  // a light column on a stretch with no lot (no circuit to feed it) is left out
  const fed = new Set(circuits.flatMap((circuit) => circuit.members))
  const lights = columns.filter((light) => fed.has(light.key))
  const stops: ChainStop[] = [...circuits.flatMap((circuit) => circuit.stops), ...lights.map((light) => ({ key: light.key, run: light.run, u: light.u }))]
  const { chains, joints } = chainsOf({ line, prefix: 'duct', offset, stops, spacing: rules.layout.underground.boxSpacing })
  const edges: NetworkEdge[] = []
  const roots = new Set(line.roots)
  const nodes = chainNodes(chains)
  const where = new Map(nodes.map((node) => [node.id, node]))
  for (const pipe of pipesOf({ chains, diameter: 0, slope: 0 })) edges.push(...bankEdges({ context, bank, from: where.get(pipe.from) as ChainNode, to: where.get(pipe.to) as ChainNode, layers: ['mv', 'telecom'] }))
  for (const circuit of circuits) edges.push(...lowVoltageOf({ context, bank, circuit, joints, where, nodes }))
  edges.push(...layBranches({ context, bank, circuits, lights, joints, where, column: params.column }))
  const carried = new Map<string, Set<NetworkKind>>()
  for (const edge of edges) for (const end of [edge.from, edge.to]) carried.set(end, (carried.get(end) ?? new Set<NetworkKind>()).add(EDGE_NETWORK[edge.kind]))
  for (const node of nodes) {
    const ground = context.groundAt(node.x, node.z)
    const carries = [...(carried.get(node.id) ?? [])].sort()
    sink.nodes.push({ id: node.id, kind: roots.has(node.id) ? 'feed' : 'box', at: [node.x, ground, node.z], invert: ground - bank.mv, carries, spec: roots.has(node.id) ? 'underground_feed' : 'power_box' })
  }
  sink.edges.push(...edges)
  return { edges, banks }
}

/** A circuit's low voltage along the bank, out from its transformer's box both ways to the farthest box it serves. */
function lowVoltageOf({ context, bank, circuit, joints, where, nodes }: { readonly context: BuriedContext; readonly bank: Bank; readonly circuit: UndergroundCircuit; readonly joints: ReadonlyMap<string, string>; readonly where: ReadonlyMap<string, ChainNode>; readonly nodes: readonly ChainNode[] }): NetworkEdge[] {
  const { run } = circuit
  const v = bankOffset(context, run)
  const uOf = (node: ChainNode): number => frameOf({ frame: run, x: node.x, z: node.z })[0]
  const onRun = nodes.filter((node) => Math.abs(frameOf({ frame: run, x: node.x, z: node.z })[1] - v) < 1e-6).sort((a, b) => uOf(a) - uOf(b))
  const members = circuit.members.flatMap((key) => [where.get(joints.get(key) ?? '')].filter((node): node is ChainNode => node !== undefined))
  const pad = where.get(joints.get(circuit.padKey) ?? '')
  if (pad === undefined || members.length === 0) return []
  const [low, high] = [Math.min(uOf(pad), ...members.map(uOf)), Math.max(uOf(pad), ...members.map(uOf))]
  const start = onRun.findIndex((node) => node.id === pad.id)
  const out: NetworkEdge[] = []
  for (const step of [1, -1]) {
    for (let index = start; ; index += step) {
      const [from, to] = [onRun[index], onRun[index + step]]
      if (from === undefined || to === undefined || uOf(to) < low - 1e-6 || uOf(to) > high + 1e-6) break
      out.push(...bankEdges({ context, bank, from, to, layers: ['lv'] }))
    }
  }
  return out
}
