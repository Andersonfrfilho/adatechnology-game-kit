import type { UtilityConnection } from '@adatechnology/game-contracts'

import { chainNodes, pipesOf, reachOf, topOf, waterOffset } from './buried'
import type { BuriedContext } from './buried'
import { chainsOf } from './chain'
import type { ChainNode, ChainStop } from './chain'
import { frameOf } from './frame'
import { lineNetworkOf } from './line-network'
import type { LineVertex } from './line-network'
import type { StreetRun } from './runs'
import type { NetworkNode } from './types'

/** Kind and spec of a node of the main: the reservoir at the border, a valve at every crossing and dead end, a tee where a service leaves. */
function kindOf({ node, vertex, roots }: { readonly node: ChainNode; readonly vertex: LineVertex | undefined; readonly roots: ReadonlySet<string> }): Pick<NetworkNode, 'kind' | 'spec'> {
  if (roots.has(node.id)) return { kind: 'reservoir', spec: 'reservoir' }
  if (node.role === 'stop') return { kind: 'splice', spec: 'tee' }
  return { kind: 'valve', spec: vertex?.role === 'crossing' ? 'gate_valve' : 'end_valve' }
}

/**
 * The water: a main under the sidewalk opposite the poles on every street, from a reservoir where the line enters the map (one per side of
 * a river), a valve and a hydrant at every crossing, and a service from a tee on the main to every lot's meter stand.
 */
export function layWater({ context, connections }: { readonly context: BuriedContext; readonly connections: readonly UtilityConnection[] }): void {
  const { rules, sink } = context
  const { water } = rules.layout
  const offset = (run: StreetRun): number => waterOffset({ context, run })
  const line = lineNetworkOf({ prefix: 'water', runs: context.runs, offset, riverInset: 0, reach: reachOf(context), flow: 'supply' })
  const stops: ChainStop[] = connections.flatMap((connection) => {
    const served = context.served.get(connection.lot)
    if (served === undefined) return []
    return [{ key: `tee:${connection.lot}`, run: served.run, u: frameOf({ frame: served.run, x: connection.at[0], z: connection.at[2] })[0] }]
  })
  const { chains, joints } = chainsOf({ line, prefix: 'water', offset, stops })
  const roots = new Set(line.roots)
  for (const node of chainNodes(chains)) {
    const ground = context.groundAt(node.x, node.z)
    sink.nodes.push({ id: node.id, ...kindOf({ node, vertex: line.vertices.get(node.id), roots }), at: [node.x, ground, node.z], invert: topOf({ context, x: node.x, z: node.z, cover: rules.cover.water_main.min, diameter: water.mainDiameter }), carries: ['water'] })
  }
  for (const pipe of pipesOf({ chains, diameter: water.mainDiameter, slope: 0 })) sink.edges.push({ id: `${pipe.from}>${pipe.to}`, kind: 'water_main', from: pipe.from, to: pipe.to, diameter: water.mainDiameter })
  for (const vertex of line.vertices.values()) if (vertex.role === 'crossing') layHydrant({ context, vertex })
  for (const connection of connections) {
    const tee = joints.get(`tee:${connection.lot}`)
    if (tee === undefined) continue
    const node = `lot:${connection.lot}:water`
    const invert = topOf({ context, x: connection.at[0], z: connection.at[2], cover: rules.cover.water_service.min, diameter: water.serviceDiameter })
    sink.nodes.push({ id: node, kind: 'connection', at: connection.at, invert, carries: ['water'], lot: connection.lot })
    sink.edges.push({ id: `water:service:${connection.lot}`, kind: 'water_service', from: tee, to: node, diameter: water.serviceDiameter })
  }
}

/** A pillar hydrant beside the valve of a crossing, on the sidewalk away from the cross street's roadway. */
function layHydrant({ context, vertex }: { readonly context: BuriedContext; readonly vertex: LineVertex }): void {
  const { water } = context.rules.layout
  const run = context.runs.find((candidate) => {
    const [, v] = frameOf({ frame: candidate, x: vertex.x, z: vertex.z })
    return Math.abs(v - waterOffset({ context, run: candidate })) < 1e-6
  })
  if (run === undefined) return
  const cross = context.runs.find((candidate) => candidate.along !== run.along && Math.abs((run.along === 'x' ? vertex.x : vertex.z) - candidate.axis - waterOffset({ context, run: candidate })) < 1e-6)
  const away = cross === undefined ? 1 : Math.sign(waterOffset({ context, run: cross })) || 1
  const [x, z] = run.along === 'x' ? [vertex.x + away * water.hydrantOffset, vertex.z] : [vertex.x, vertex.z + away * water.hydrantOffset]
  const id = `water:hydrant:${vertex.id.slice('water:'.length)}`
  const ground = context.groundAt(x, z)
  context.sink.nodes.push({ id, kind: 'hydrant', at: [x, ground, z], invert: topOf({ context, x, z, cover: context.rules.cover.water_main.min, diameter: water.mainDiameter }), carries: ['water'], spec: 'pillar_hydrant' })
  context.sink.edges.push({ id: `${vertex.id}>${id}`, kind: 'water_main', from: vertex.id, to: id, diameter: water.mainDiameter })
}
