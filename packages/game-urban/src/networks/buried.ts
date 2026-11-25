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
  /** Half the map's width and depth: where a line without a river leaves the map. */
  readonly border: readonly [number, number]
  readonly sink: NetworkSink
  /** The duct bank of each street whose power runs underground: its offset from the axis and the depth of its bottom under the ground (the laterals of the lots on its side pass under it). */
  readonly banks?: ReadonlyMap<string, DuctBank>
}

/** A street's duct bank as the other networks see it: centre offset from the axis (signed as `v`), half its width, its bottom this deep under the ground. */
export type DuctBank = { readonly v: number; readonly half: number; readonly bottom: number }

export type OnRun = { readonly context: BuriedContext; readonly run: StreetRun }

const sideOf = ({ context, run }: OnRun): 1 | -1 => context.sides.get(run.id) ?? -1

/** The storm gallery runs beside the axis on the side of the poles; the water main under the sidewalk on the other side (they never cross a lateral together). */
export const galleryOffset = (on: OnRun): number => sideOf(on) * on.context.rules.layout.storm.galleryOffset
export function waterOffset(on: OnRun): number {
  const { sidewalk, water } = on.context.rules.layout
  return -sideOf(on) * (on.run.width / 2 + sidewalk * water.sidewalkShare)
}

/** A line reaches a cross line this far past its own run (a street ending at another). */
export const reachOf = (context: BuriedContext): number => Math.max(0, ...context.runs.map((run) => run.width / 2)) + context.rules.layout.sidewalk

export type TopParams = { readonly context: BuriedContext; readonly x: number; readonly z: number; readonly cover: number; readonly diameter: number }

/** The highest invert a pipe of `diameter` may have at a point under its least cover (plus the margin). */
export function topOf({ context, x, z, cover, diameter }: TopParams): number {
  return context.groundAt(x, z) - cover - context.rules.layout.coverMargin - diameter
}

/** The mains of a set of chains, consecutive nodes in the direction of the flow. */
export function pipesOf({ chains, diameter, slope }: { readonly chains: readonly ChainNode[][]; readonly diameter: number; readonly slope: number }): GravityPipe[] {
  return chains.flatMap((chain) =>
    chain.slice(1).map((node, index) => {
      const from = chain[index] as ChainNode
      return { from: from.id, to: node.id, a: [from.x, from.z] as const, b: [node.x, node.z] as const, diameter, slope }
    }),
  )
}

/** Laid pipes of a set of edges (for a main that must pass under them), by the inverts of their nodes or their own. */
export function laidOf({ edges, sink }: { readonly edges: readonly NetworkEdge[]; readonly sink: NetworkSink }): LaidPipe[] {
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
