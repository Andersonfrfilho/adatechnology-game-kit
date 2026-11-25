import type { UtilityConnection } from '@adatechnology/game-contracts'

import { chainNodes, galleryOffset, laidOf, pipesOf, reachOf, topOf } from './buried'
import type { BuriedContext } from './buried'
import { chainsOf } from './chain'
import type { ChainStop } from './chain'
import { frameOf, ordinal, worldOf } from './frame'
import { solveDrainInverts } from './inverts'
import { lineNetworkOf } from './line-network'
import { piecesOf } from './pole-layout'
import type { StreetRun } from './runs'
import type { NetworkEdge, NetworkNode } from './types'

export type Inlet = { readonly id: string; readonly key: string; readonly run: StreetRun; readonly curb: 1 | -1; readonly u: number; readonly node: NetworkNode }

/** Inlets on both kerbs of every stretch: one at each corner (or end) and at most `inletSpacing` apart between. */
export function inletsOf(context: BuriedContext): Inlet[] {
  const { storm, coverMargin } = context.rules.layout
  const depth = context.rules.cover.storm_lateral.min + coverMargin + storm.lateralDiameter
  return context.runs.flatMap((run) =>
    piecesOf(run).flatMap((piece, pieceIndex) =>
      ([-1, 1] as const).flatMap((curb) => {
        const [from, to] = [piece.from + storm.inletFromCorner, piece.to - storm.inletFromCorner]
        const gaps = Math.max(1, Math.ceil((to - from) / storm.inletSpacing - 1e-9))
        return Array.from({ length: gaps + 1 }, (_, index): Inlet => {
          const u = from + ((to - from) * index) / gaps
          const [x, z] = worldOf({ frame: run, u, v: curb * (run.width / 2 - storm.inletSetback) })
          const key = `inlet:${run.id}:${curb > 0 ? 'plus' : 'minus'}:${ordinal(pieceIndex)}:${ordinal(index)}`
          const ground = context.groundAt(x, z)
          return { id: `storm:${key}`, key, run, curb, u, node: { id: `storm:${key}`, kind: 'inlet', at: [x, ground, z], invert: ground - depth, carries: ['storm'], spec: 'grated_inlet' } }
        })
      }),
    ),
  )
}

/**
 * The drainage: a gallery beside the axis of every street on the side of the poles, to a headwall on the river bank (else the border), its
 * bottom above the river (a lift where the gallery would reach under it); inlets on both kerbs with a lateral each to the gallery, and every
 * lot's downspout outlet down the gutter to the nearest inlet of its kerb. Returns the edges laid, for the sewer that passes under them; the galleries pass under `above` (the power ducts).
 */
export function layStorm({ context, connections, above = [] }: { readonly context: BuriedContext; readonly connections: readonly UtilityConnection[]; readonly above?: readonly NetworkEdge[] }): NetworkEdge[] {
  const { rules, sink } = context
  const { storm, slopeMargin, coverMargin } = rules.layout
  const offset = (run: StreetRun): number => galleryOffset({ context, run })
  const line = lineNetworkOf({ prefix: 'storm', runs: context.runs, offset, riverInset: 0, reach: reachOf(context), flow: 'drain' })
  const inlets = inletsOf(context)
  const stops: ChainStop[] = inlets.map((inlet) => ({ key: inlet.key, run: inlet.run, u: inlet.u }))
  const { chains, joints } = chainsOf({ line, prefix: 'storm:gallery', offset, stops, spacing: rules.sewer.manholeSpacing })
  const nodes = chainNodes(chains)
  const where = new Map(nodes.map((node) => [node.id, node]))
  const top = new Map(nodes.map((node) => [node.id, topOf({ context, x: node.x, z: node.z, cover: rules.cover.storm_gallery.min, diameter: storm.galleryDiameter })]))
  const roots = new Set(line.roots)
  // a gallery no deeper than a sewer main can pass under it and still run to its next manhole within the deepest a sewer goes; an outfall above the river
  const sewerRun = (rules.minSlope.sewer_main + slopeMargin) * rules.sewer.manholeSpacing
  const deepest = rules.sewer.maxDepth - rules.layout.sewer.mainDiameter - rules.crossing.separation - 3 * coverMargin - sewerRun
  const floor = new Map(nodes.map((node) => [node.id, Math.max(context.groundAt(node.x, node.z) - deepest, roots.has(node.id) ? storm.riverLevel + coverMargin : Number.NEGATIVE_INFINITY)]))
  const laterals = inlets.map((inlet) => {
    const joint = joints.get(inlet.key) as string
    const target = where.get(joint)
    const length = target === undefined ? 0 : Math.hypot(target.x - inlet.node.at[0], target.z - inlet.node.at[2])
    const end = (inlet.node.invert ?? 0) - (rules.minSlope.storm_lateral + slopeMargin) * length
    top.set(joint, Math.min(top.get(joint) ?? Number.POSITIVE_INFINITY, end))
    return { inlet, joint, end }
  })
  const pipes = pipesOf({ chains, diameter: storm.galleryDiameter, slope: rules.minSlope.storm_gallery + slopeMargin })
  // the galleries pass under the ducts of underground power that cross them
  const { inverts, lifts } = solveDrainInverts({ pipes, top, floor, above: laidOf({ edges: above, sink }), separation: rules.crossing.separation + coverMargin })
  for (const node of nodes) {
    const ground = context.groundAt(node.x, node.z)
    const kind = roots.has(node.id) ? ({ kind: 'outfall', spec: 'headwall' } as const) : lifts.has(node.id) ? ({ kind: 'pumping_station', spec: 'storm_lift' } as const) : ({ kind: 'manhole', spec: 'gallery_box' } as const)
    sink.nodes.push({ id: node.id, ...kind, at: [node.x, ground, node.z], invert: inverts.get(node.id) ?? ground, carries: ['storm'] })
  }
  const edges: NetworkEdge[] = pipes.map((pipe) => {
    const lift = lifts.get(pipe.from)
    return { id: `${pipe.from}>${pipe.to}`, kind: 'storm_gallery', from: pipe.from, to: pipe.to, diameter: storm.galleryDiameter, ...(lift === undefined ? {} : { inverts: [lift, inverts.get(pipe.to) ?? 0] as const }) }
  })
  for (const { inlet, joint, end } of laterals) {
    sink.nodes.push(inlet.node)
    edges.push({ id: `storm:lateral:${inlet.key}`, kind: 'storm_lateral', from: inlet.id, to: joint, diameter: storm.lateralDiameter, inverts: [inlet.node.invert ?? 0, end] })
  }
  edges.push(...gutters({ context, connections, inlets }))
  sink.edges.push(...edges)
  return edges
}

/** Each lot's downspout outlet at the kerb, down the gutter to the nearest inlet of the same kerb of its street. */
function gutters({ context, connections, inlets }: { readonly context: BuriedContext; readonly connections: readonly UtilityConnection[]; readonly inlets: readonly Inlet[] }): NetworkEdge[] {
  const slope = context.rules.minSlope.storm_gutter + context.rules.layout.slopeMargin
  return connections.flatMap((connection) => {
    const served = context.served.get(connection.lot)
    if (served === undefined) return []
    const [u] = frameOf({ frame: served.run, x: connection.at[0], z: connection.at[2] })
    const own = inlets.filter((inlet) => inlet.run.id === served.run.id && inlet.curb === served.side)
    const inlet = [...own].sort((a, b) => Math.abs(a.u - u) - Math.abs(b.u - u))[0]
    if (inlet === undefined) return []
    const node = `lot:${connection.lot}:storm`
    context.sink.nodes.push({ id: node, kind: 'connection', at: connection.at, carries: ['storm'], lot: connection.lot })
    const length = Math.hypot(inlet.node.at[0] - connection.at[0], inlet.node.at[2] - connection.at[2])
    return [{ id: `storm:gutter:${connection.lot}`, kind: 'storm_gutter', from: node, to: inlet.id, diameter: 0, inverts: [connection.at[1], inlet.node.at[1] - slope * length] } satisfies NetworkEdge]
  })
}
