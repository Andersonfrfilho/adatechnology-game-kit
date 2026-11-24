import type { PlanLine } from '../cities/types'
import type { NetworkSink } from './aerial'
import type { ChainNode } from './chain'
import type { GroundAt } from './connections'
import type { GravityPipe, LaidPipe } from './inverts'
import type { NetworkRules } from './rules'
import type { ServedLot, StreetRun } from './runs'
import type { NetworkEdge } from './types'

/** What every buried network reads: the runs and their pole sides, the lots, the rules, the ground and the rivers. */
export type BuriedContext = {
  readonly runs: readonly StreetRun[]
  readonly sides: ReadonlyMap<string, 1 | -1>
  readonly served: ReadonlyMap<string, ServedLot>
  readonly rules: NetworkRules
  readonly groundAt: GroundAt
  readonly rivers: readonly PlanLine[]
  readonly sink: NetworkSink
}

const sideOf = (context: BuriedContext, run: StreetRun): 1 | -1 => context.sides.get(run.id) ?? -1

/** The storm gallery runs beside the axis on the side of the poles; the water main under the sidewalk on the other side (they never cross a lateral together). */
export const galleryOffset = (context: BuriedContext, run: StreetRun): number => sideOf(context, run) * context.rules.layout.storm.galleryOffset
export function waterOffset(context: BuriedContext, run: StreetRun): number {
  const { sidewalk, water } = context.rules.layout
  return -sideOf(context, run) * (run.width / 2 + sidewalk * water.sidewalkShare)
}

/** A line reaches a cross line this far past its own run (a street ending at another). */
export const reachOf = (context: BuriedContext): number => Math.max(0, ...context.runs.map((run) => run.width / 2)) + context.rules.layout.sidewalk

/** The highest invert a pipe of `diameter` may have at a point under its least cover (plus the margin). */
export function topOf(context: BuriedContext, x: number, z: number, cover: number, diameter: number): number {
  return context.groundAt(x, z) - cover - context.rules.layout.coverMargin - diameter
}

/** The mains of a set of chains, consecutive nodes in the direction of the flow. */
export function pipesOf(chains: readonly ChainNode[][], diameter: number, slope: number): GravityPipe[] {
  return chains.flatMap((chain) => chain.slice(1).map((node, index) => {
    const from = chain[index] as ChainNode
    return { from: from.id, to: node.id, a: [from.x, from.z] as const, b: [node.x, node.z] as const, diameter, slope }
  }))
}

/** Laid pipes of a set of edges (for a main that must pass under them), by the inverts of their nodes or their own. */
export function laidOf(edges: readonly NetworkEdge[], sink: NetworkSink): LaidPipe[] {
  const nodes = new Map(sink.nodes.map((node) => [node.id, node]))
  return edges.flatMap((edge) => {
    const [from, to] = [nodes.get(edge.from), nodes.get(edge.to)]
    const inverts = edge.inverts ?? (from?.invert !== undefined && to?.invert !== undefined ? ([from.invert, to.invert] as const) : undefined)
    return from === undefined || to === undefined || inverts === undefined ? [] : [{ a: [from.at[0], from.at[2]] as const, b: [to.at[0], to.at[2]] as const, inverts }]
  })
}

/** Unique nodes of chains: a vertex shared by two segments is one node. */
export function chainNodes(chains: readonly ChainNode[][]): ChainNode[] {
  return [...new Map(chains.flat().map((node) => [node.id, node])).values()]
}
