import type { UtilityConnection } from '@adatechnology/game-contracts'

import { chainNodes, laidOf, pipesOf, reachOf, topOf, waterOffset } from './buried'
import type { BuriedContext } from './buried'
import { chainsOf } from './chain'
import type { ChainNode, ChainStop } from './chain'
import { frameOf, worldOf } from './frame'
import { interceptorsOf } from './interceptor'
import { solveDrainInverts } from './inverts'
import type { GravityPipe } from './inverts'
import { lineNetworkOf } from './line-network'
import type { NetworkEdge, NetworkNode } from './types'

type Lateral = { readonly connection: UtilityConnection; readonly drop: NetworkNode; readonly key: string }

/**
 * The drop of a lot's lateral: a cleanout `dropOffset` from the axis on the lot's side. The lateral falls to it at its least slope, and
 * deeper where it must pass under the water main (on the side opposite the poles); on the side of the poles it stays shallow over the gallery.
 */
function lateralOf(context: BuriedContext, connection: UtilityConnection): Lateral | undefined {
  const served = context.served.get(connection.lot)
  if (served === undefined || connection.invert === undefined) return undefined
  const { run, side } = served
  const { sewer, slopeMargin, water } = context.rules.layout
  const [u, v] = frameOf(run.along, run.axis, connection.at[0], connection.at[2])
  const length = Math.abs(v) - sewer.dropOffset
  let fall = (context.rules.minSlope.sewer_lateral + slopeMargin) * length
  const main = waterOffset(context, run)
  if (Math.sign(main) === side && Math.abs(main) < Math.abs(v) && Math.abs(main) > sewer.dropOffset) {
    const share = (Math.abs(v) - Math.abs(main)) / length
    const [wx, wz] = worldOf(run.along, run.axis, u, main)
    const waterBottom = topOf(context, wx, wz, context.rules.cover.water_main.min, water.mainDiameter)
    const need = waterBottom - context.rules.crossing.separation - sewer.lateralDiameter - context.rules.layout.coverMargin
    fall = Math.max(fall, (connection.invert - need) / share)
  }
  const [x, z] = worldOf(run.along, run.axis, u, side * sewer.dropOffset)
  const id = `sewer:drop:${connection.lot}`
  return { connection, key: `saddle:${connection.lot}`, drop: { id, kind: 'cleanout', at: [x, context.groundAt(x, z), z], invert: connection.invert - fall, carries: ['sewer'], spec: 'drop' } }
}

function kindOf(node: ChainNode, roots: ReadonlySet<string>, heads: ReadonlySet<string>): Pick<NetworkNode, 'kind' | 'spec'> {
  if (node.role === 'stop') return { kind: 'splice', spec: 'saddle' }
  if (heads.has(node.id) && !roots.has(node.id)) return { kind: 'cleanout', spec: 'terminal' }
  return { kind: 'manhole', spec: 'pv_600' }
}

/**
 * The sewer: a DN 150 main under the axis of every street, falling to the river bank (a cleanout at each dry head, a manhole at every
 * crossing and at most 80 m apart), an interceptor along each bank to a treatment node where the river leaves the map, and every lot's
 * lateral from its inspection box over the gallery (or under the water main) down to a saddle on the main. The mains pass under `above`.
 */
export function laySewer(context: BuriedContext, connections: readonly UtilityConnection[], above: readonly NetworkEdge[]): void {
  const { rules, sink } = context
  const { sewer, slopeMargin } = rules.layout
  const line = lineNetworkOf({ prefix: 'sewer', runs: context.runs, offset: () => 0, riverInset: sewer.interceptorOffset, reach: reachOf(context), flow: 'drain' })
  const laterals = connections.flatMap((connection) => lateralOf(context, connection) ?? [])
  const stops: ChainStop[] = laterals.flatMap((lateral) => {
    const served = context.served.get(lateral.connection.lot)
    return served === undefined ? [] : [{ key: lateral.key, run: served.run, u: frameOf(served.run.along, served.run.axis, lateral.connection.at[0], lateral.connection.at[2])[0] }]
  })
  const { chains, joints } = chainsOf({ line, prefix: 'sewer', offset: () => 0, stops, spacing: rules.sewer.manholeSpacing })
  const outlets = line.roots.flatMap((id) => (line.vertices.get(id)?.end === 'river' ? [line.vertices.get(id) as NonNullable<ReturnType<typeof line.vertices.get>>] : []))
  const interceptor = interceptorsOf(outlets, context.rivers, rules.sewer.manholeSpacing)
  const slope = rules.minSlope.sewer_main + slopeMargin
  const nodes = [...chainNodes(chains), ...interceptor.nodes.map((node) => ({ id: node.id, x: node.x, z: node.z, role: 'vertex' as const }))]
  const where = new Map(nodes.map((node) => [node.id, node]))
  const pipes: GravityPipe[] = [
    ...pipesOf(chains, sewer.mainDiameter, slope),
    ...interceptor.links.map((link) => {
      const [a, b] = [where.get(link.from), where.get(link.to)]
      return { from: link.from, to: link.to, a: [a?.x ?? 0, a?.z ?? 0] as const, b: [b?.x ?? 0, b?.z ?? 0] as const, diameter: sewer.mainDiameter, slope }
    }),
  ]
  const top = new Map(nodes.map((node) => [node.id, topOf(context, node.x, node.z, rules.sewer.coverUnderGallery, sewer.mainDiameter)]))
  for (const lateral of laterals) {
    const joint = joints.get(lateral.key) as string
    const target = where.get(joint)
    const length = target === undefined ? 0 : Math.hypot(target.x - lateral.drop.at[0], target.z - lateral.drop.at[2])
    const highest = (lateral.drop.invert ?? 0) - (rules.minSlope.sewer_lateral + slopeMargin) * length - sewer.mainDiameter
    top.set(joint, Math.min(top.get(joint) ?? Number.POSITIVE_INFINITY, highest))
  }
  const invert = solveDrainInverts({ pipes, top, above: laidOf(above, sink), separation: rules.crossing.separation + rules.layout.coverMargin })
  const heads = new Set(pipes.filter((pipe) => !pipes.some((other) => other.to === pipe.from)).map((pipe) => pipe.from))
  const roots = new Set(line.roots)
  const kinds = new Map(interceptor.nodes.map((node) => [node.id, node.kind]))
  for (const node of nodes) {
    const ground = context.groundAt(node.x, node.z)
    const kind = kinds.get(node.id) === 'treatment' ? ({ kind: 'treatment', spec: 'treatment_plant' } as const) : kindOf(node, roots, heads)
    sink.nodes.push({ id: node.id, ...kind, at: [node.x, ground, node.z], invert: invert.get(node.id) ?? ground, carries: ['sewer'] })
  }
  for (const pipe of pipes) sink.edges.push({ id: `${pipe.from}>${pipe.to}`, kind: 'sewer_main', from: pipe.from, to: pipe.to, diameter: sewer.mainDiameter })
  for (const lateral of laterals) {
    const { connection, drop } = lateral
    const joint = joints.get(lateral.key) as string
    const lot = `lot:${connection.lot}:sewer`
    sink.nodes.push({ id: lot, kind: 'connection', at: connection.at, invert: connection.invert, carries: ['sewer'], lot: connection.lot }, drop)
    sink.edges.push({ id: `sewer:lateral:${connection.lot}`, kind: 'sewer_lateral', from: lot, to: drop.id, diameter: sewer.lateralDiameter })
    sink.edges.push({ id: `${drop.id}>${joint}`, kind: 'sewer_lateral', from: drop.id, to: joint, diameter: sewer.lateralDiameter, inverts: [drop.invert ?? 0, (invert.get(joint) ?? 0) + sewer.mainDiameter] })
  }
}
