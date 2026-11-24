import type { UtilityConnection } from '@adatechnology/game-contracts'

import { chainNodes, galleryOffset, pipesOf, reachOf, topOf } from './buried'
import type { BuriedContext } from './buried'
import { chainsOf } from './chain'
import type { ChainStop } from './chain'
import { frameOf, ordinal, worldOf } from './frame'
import { solveDrainInverts } from './inverts'
import { lineNetworkOf } from './line-network'
import { piecesOf } from './pole-layout'
import type { NetworkEdge, NetworkNode } from './types'

type Inlet = { readonly id: string; readonly run: string; readonly curb: 1 | -1; readonly u: number; readonly node: NetworkNode }

/** Inlets on both kerbs of every stretch: one at each corner (or end) and at most `inletSpacing` apart between. */
function inletsOf(context: BuriedContext): Inlet[] {
  const { storm, coverMargin } = context.rules.layout
  const depth = context.rules.cover.storm_lateral.min + coverMargin + storm.lateralDiameter
  return context.runs.flatMap((run) =>
    piecesOf(run).flatMap((piece, pieceIndex) =>
      ([-1, 1] as const).flatMap((curb) => {
        const [from, to] = [piece.from + storm.inletFromCorner, piece.to - storm.inletFromCorner]
        const gaps = Math.max(1, Math.ceil((to - from) / storm.inletSpacing - 1e-9))
        return Array.from({ length: gaps + 1 }, (_, index): Inlet => {
          const u = from + ((to - from) * index) / gaps
          const [x, z] = worldOf(run.along, run.axis, u, curb * (run.width / 2 - storm.inletSetback))
          const id = `storm:inlet:${run.id}:${curb > 0 ? 'plus' : 'minus'}:${ordinal(pieceIndex)}:${ordinal(index)}`
          const ground = context.groundAt(x, z)
          return { id, run: run.id, curb, u, node: { id, kind: 'inlet', at: [x, ground, z], invert: ground - depth, carries: ['storm'], spec: 'grated_inlet' } }
        })
      }),
    ),
  )
}

/**
 * The drainage: a gallery beside the axis of every street on the side of the poles, to a headwall on the river bank (else the border);
 * inlets on both kerbs with a lateral each to the gallery, and every lot's downspout outlet down the gutter to the nearest inlet of its kerb.
 * Returns the edges laid, for the sewer that passes under them.
 */
export function layStorm(context: BuriedContext, connections: readonly UtilityConnection[]): NetworkEdge[] {
  const { rules, sink } = context
  const { storm, slopeMargin } = rules.layout
  const offset = (run: Parameters<typeof galleryOffset>[1]): number => galleryOffset(context, run)
  const line = lineNetworkOf({ prefix: 'storm', runs: context.runs, offset, riverInset: 0, reach: reachOf(context), flow: 'drain' })
  const inlets = inletsOf(context)
  const runs = new Map(context.runs.map((run) => [run.id, run]))
  const stops: ChainStop[] = inlets.map((inlet) => ({ key: inlet.id.slice('storm:'.length), run: runs.get(inlet.run) as (typeof context.runs)[number], u: inlet.u }))
  const { chains, joints } = chainsOf({ line, prefix: 'storm:gallery', offset, stops, spacing: rules.sewer.manholeSpacing })
  const nodes = chainNodes(chains)
  const top = new Map(nodes.map((node) => [node.id, topOf(context, node.x, node.z, rules.cover.storm_gallery.min, storm.galleryDiameter)]))
  const laterals = inlets.map((inlet) => {
    const joint = joints.get(inlet.id.slice('storm:'.length)) as string
    const target = nodes.find((node) => node.id === joint)
    const length = target === undefined ? 0 : Math.hypot(target.x - inlet.node.at[0], target.z - inlet.node.at[2])
    const end = (inlet.node.invert ?? 0) - (rules.minSlope.storm_lateral + slopeMargin) * length
    top.set(joint, Math.min(top.get(joint) ?? Number.POSITIVE_INFINITY, end))
    return { inlet, joint, end }
  })
  const invert = solveDrainInverts({ pipes: pipesOf(chains, storm.galleryDiameter, rules.minSlope.storm_gallery + slopeMargin), top })
  const roots = new Set(line.roots)
  for (const node of nodes) {
    const ground = context.groundAt(node.x, node.z)
    const isOutfall = roots.has(node.id)
    sink.nodes.push({ id: node.id, kind: isOutfall ? 'outfall' : 'manhole', at: [node.x, ground, node.z], invert: invert.get(node.id) ?? ground, carries: ['storm'], spec: isOutfall ? 'headwall' : 'gallery_box' })
  }
  const edges: NetworkEdge[] = pipesOf(chains, storm.galleryDiameter, 0).map((pipe) => ({ id: `${pipe.from}>${pipe.to}`, kind: 'storm_gallery', from: pipe.from, to: pipe.to, diameter: storm.galleryDiameter }))
  for (const { inlet, joint, end } of laterals) {
    sink.nodes.push(inlet.node)
    edges.push({ id: `storm:lateral:${inlet.id}`, kind: 'storm_lateral', from: inlet.id, to: joint, diameter: storm.lateralDiameter, inverts: [inlet.node.invert ?? 0, end] })
  }
  edges.push(...gutters(context, connections, inlets))
  sink.edges.push(...edges)
  return edges
}

/** Each lot's downspout outlet at the kerb, down the gutter to the nearest inlet of the same kerb of its street. */
function gutters(context: BuriedContext, connections: readonly UtilityConnection[], inlets: readonly Inlet[]): NetworkEdge[] {
  const slope = context.rules.minSlope.storm_gutter + context.rules.layout.slopeMargin
  return connections.flatMap((connection) => {
    const served = context.served.get(connection.lot)
    if (served === undefined) return []
    const [u] = frameOf(served.run.along, served.run.axis, connection.at[0], connection.at[2])
    const own = inlets.filter((inlet) => inlet.run === served.run.id && inlet.curb === served.side)
    const inlet = [...own].sort((a, b) => Math.abs(a.u - u) - Math.abs(b.u - u))[0]
    if (inlet === undefined) return []
    const node = `lot:${connection.lot}:storm`
    context.sink.nodes.push({ id: node, kind: 'connection', at: connection.at, carries: ['storm'], lot: connection.lot })
    const length = Math.hypot(inlet.node.at[0] - connection.at[0], inlet.node.at[2] - connection.at[2])
    return [{ id: `storm:gutter:${connection.lot}`, kind: 'storm_gutter', from: node, to: inlet.id, diameter: 0, inverts: [connection.at[1], inlet.node.at[1] - slope * length] } satisfies NetworkEdge]
  })
}
