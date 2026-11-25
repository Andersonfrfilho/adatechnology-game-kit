import type { UtilityConnection } from '@adatechnology/game-contracts'

import { chainNodes, laidOf, pipesOf, reachOf, topOf, waterOffset } from './buried'
import type { BuriedContext, DuctBank } from './buried'
import { chainsOf } from './chain'
import type { ChainNode, ChainStop } from './chain'
import { frameOf, worldOf } from './frame'
import { interceptorsOf } from './interceptor'
import { solveDrainInverts } from './inverts'
import type { GravityPipe } from './inverts'
import { lineNetworkOf } from './line-network'
import type { LineVertex } from './line-network'
import type { StreetRun } from './runs'
import type { NetworkEdge, NetworkNode } from './types'

type Lateral = { readonly connection: UtilityConnection; readonly drop: NetworkNode; readonly key: string; readonly u: number; readonly fall?: NetworkNode }
type OnLot = { readonly context: BuriedContext; readonly connection: UtilityConnection }

/**
 * The drop of a lot's lateral: a cleanout `dropOffset` from the axis on the lot's side. The lateral falls to it at its least slope, and
 * deeper where it must pass under the water main (on the side opposite the poles); on the side of the poles it stays shallow over the gallery.
 * Under a street with a duct bank on the lot's side it falls first in a box with a drop (`fall`) between the lot and the bank, deep enough to
 * pass under the bank and the water main, then runs on to the drop at its least slope.
 */
function lateralOf({ context, connection }: OnLot): Lateral | undefined {
  const served = context.served.get(connection.lot)
  if (served === undefined || connection.invert === undefined) return undefined
  const { run, side } = served
  const { sewer, slopeMargin, water, coverMargin } = context.rules.layout
  const [u, v] = frameOf({ frame: run, x: connection.at[0], z: connection.at[2] })
  const length = Math.abs(v) - sewer.dropOffset
  let fall = (context.rules.minSlope.sewer_lateral + slopeMargin) * length
  const main = waterOffset({ context, run })
  const crossesMain = Math.sign(main) === side && Math.abs(main) < Math.abs(v) && Math.abs(main) > sewer.dropOffset
  const underMain = (at: number): number => {
    const [x, z] = worldOf({ frame: run, u, v: at })
    return topOf({ context, x, z, cover: context.rules.cover.water_main.min, diameter: water.mainDiameter }) - context.rules.crossing.separation - sewer.lateralDiameter - coverMargin
  }
  const bank = context.banks?.get(run.id)
  if (bank !== undefined && Math.sign(bank.v) === side && Math.abs(bank.v) < Math.abs(v)) return fallingLateral({ context, connection, served, u, v, bank, underMain: crossesMain ? underMain(main) : Number.POSITIVE_INFINITY, main: crossesMain ? Math.abs(main) : 0 })
  if (crossesMain) {
    const share = (Math.abs(v) - Math.abs(main)) / length
    fall = Math.max(fall, (connection.invert - underMain(main)) / share)
  }
  const [x, z] = worldOf({ frame: run, u, v: side * sewer.dropOffset })
  const id = `sewer:drop:${connection.lot}`
  return { connection, u, key: `saddle:${connection.lot}`, drop: { id, kind: 'cleanout', at: [x, context.groundAt(x, z), z], invert: connection.invert - fall, carries: ['sewer'], spec: 'drop' } }
}

type FallingParams = OnLot & { readonly served: { readonly run: StreetRun; readonly side: 1 | -1 }; readonly u: number; readonly v: number; readonly bank: DuctBank; readonly underMain: number; readonly main: number }

/** The lateral of a lot on the side of a duct bank: a box with a drop halfway between the lot's box and the bank (and the water main), under both, then on to the drop. */
function fallingLateral({ context, connection, served, u, v, bank, underMain, main }: FallingParams): Lateral {
  const { run, side } = served
  const { sewer, slopeMargin, coverMargin } = context.rules.layout
  const slope = context.rules.minSlope.sewer_lateral + slopeMargin
  const outer = Math.max(Math.abs(bank.v) + bank.half, main + sewer.lateralDiameter)
  const at = (Math.abs(v) + outer) / 2
  const [fx, fz] = worldOf({ frame: run, u, v: side * at })
  const ground = context.groundAt(fx, fz)
  const underBank = ground - bank.bottom - context.rules.crossing.separation - sewer.lateralDiameter - coverMargin
  const fallInvert = Math.min((connection.invert ?? ground) - slope * (Math.abs(v) - at), underBank, underMain)
  const [x, z] = worldOf({ frame: run, u, v: side * sewer.dropOffset })
  const fall: NetworkNode = { id: `sewer:fall:${connection.lot}`, kind: 'cleanout', at: [fx, ground, fz], invert: fallInvert, carries: ['sewer'], spec: 'fall' }
  const drop: NetworkNode = { id: `sewer:drop:${connection.lot}`, kind: 'cleanout', at: [x, context.groundAt(x, z), z], invert: fallInvert - slope * (at - sewer.dropOffset), carries: ['sewer'], spec: 'drop' }
  return { connection, u, key: `saddle:${connection.lot}`, drop, fall }
}

type Kinds = { readonly roots: ReadonlySet<string>; readonly heads: ReadonlySet<string>; readonly lifts: ReadonlyMap<string, number>; readonly treatments: ReadonlySet<string> }

function kindOf({ node, kinds }: { readonly node: ChainNode; readonly kinds: Kinds }): Pick<NetworkNode, 'kind' | 'spec'> {
  if (kinds.treatments.has(node.id)) return { kind: 'treatment', spec: 'treatment_plant' }
  if (kinds.lifts.has(node.id)) return { kind: 'pumping_station', spec: 'lift' }
  if (node.role === 'stop') return { kind: 'splice', spec: 'saddle' }
  if (kinds.heads.has(node.id) && !kinds.roots.has(node.id)) return { kind: 'cleanout', spec: 'terminal' }
  return { kind: 'manhole', spec: 'pv_600' }
}

/** The mains of the streets and the interceptors, with each node's place. */
function mainsOf({ context, laterals }: { readonly context: BuriedContext; readonly laterals: readonly Lateral[] }) {
  const { rules } = context
  const { sewer, slopeMargin } = rules.layout
  const line = lineNetworkOf({ prefix: 'sewer', runs: context.runs, offset: () => 0, riverInset: sewer.interceptorOffset, reach: reachOf(context), flow: 'drain' })
  const stops: ChainStop[] = laterals.flatMap((lateral) => {
    const served = context.served.get(lateral.connection.lot)
    return served === undefined ? [] : [{ key: lateral.key, run: served.run, u: lateral.u }]
  })
  const { chains, joints } = chainsOf({ line, prefix: 'sewer', offset: () => 0, stops, spacing: rules.sewer.manholeSpacing })
  const outlets = line.roots.flatMap((id) => [line.vertices.get(id)].filter((vertex): vertex is LineVertex => vertex !== undefined))
  const interceptor = interceptorsOf({ outlets, rivers: context.rivers, spacing: rules.sewer.manholeSpacing, border: context.border })
  const slope = rules.minSlope.sewer_main + slopeMargin
  const nodes: ChainNode[] = [...chainNodes(chains), ...interceptor.nodes.map((node) => ({ id: node.id, x: node.x, z: node.z, role: 'vertex' as const }))]
  const where = new Map(nodes.map((node) => [node.id, node]))
  const pipes: GravityPipe[] = [
    ...pipesOf({ chains, diameter: sewer.mainDiameter, slope }),
    ...interceptor.links.map((link) => {
      const [a, b] = [where.get(link.from), where.get(link.to)]
      return { from: link.from, to: link.to, a: [a?.x ?? 0, a?.z ?? 0] as const, b: [b?.x ?? 0, b?.z ?? 0] as const, diameter: sewer.mainDiameter, slope }
    }),
  ]
  const treatments = new Set(interceptor.nodes.filter((node) => node.kind === 'treatment').map((node) => node.id))
  return { line, nodes, where, pipes, joints, treatments }
}

/**
 * The sewer: a DN 150 main under the axis of every street, falling to the river bank (a cleanout at each dry head, a manhole at every
 * crossing and at most 80 m apart), an interceptor along each bank to a treatment node where the river leaves the map (with no river, from
 * the line's end to the border); a pumping station where a main would go deeper than the rules allow; every lot's lateral from its
 * inspection box over the gallery (or under the water main) down to a saddle on the main. The mains pass under `above`.
 */
export function laySewer({ context, connections, above }: { readonly context: BuriedContext; readonly connections: readonly UtilityConnection[]; readonly above: readonly NetworkEdge[] }): void {
  const { rules, sink } = context
  const { sewer, slopeMargin, coverMargin } = rules.layout
  const laterals = connections.flatMap((connection) => lateralOf({ context, connection }) ?? [])
  const { line, nodes, where, pipes, joints, treatments } = mainsOf({ context, laterals })
  const top = new Map(nodes.map((node) => [node.id, topOf({ context, x: node.x, z: node.z, cover: rules.sewer.coverUnderGallery, diameter: sewer.mainDiameter })]))
  const floor = new Map(nodes.map((node) => [node.id, context.groundAt(node.x, node.z) - rules.sewer.maxDepth + coverMargin]))
  for (const lateral of laterals) {
    const joint = joints.get(lateral.key) as string
    const target = where.get(joint)
    const length = target === undefined ? 0 : Math.hypot(target.x - lateral.drop.at[0], target.z - lateral.drop.at[2])
    const highest = (lateral.drop.invert ?? 0) - (rules.minSlope.sewer_lateral + slopeMargin) * length - sewer.mainDiameter
    top.set(joint, Math.min(top.get(joint) ?? Number.POSITIVE_INFINITY, highest))
  }
  const { inverts, lifts } = solveDrainInverts({ pipes, top, floor, above: laidOf({ edges: above, sink }), separation: rules.crossing.separation + coverMargin })
  const fed = new Set(pipes.map((pipe) => pipe.to))
  const heads = new Set(pipes.filter((pipe) => !fed.has(pipe.from)).map((pipe) => pipe.from))
  const kinds: Kinds = { roots: new Set(line.roots), heads, lifts, treatments }
  for (const node of nodes) {
    const ground = context.groundAt(node.x, node.z)
    sink.nodes.push({ id: node.id, ...kindOf({ node, kinds }), at: [node.x, ground, node.z], invert: inverts.get(node.id) ?? ground, carries: ['sewer'] })
  }
  for (const pipe of pipes) {
    const lift = lifts.get(pipe.from)
    sink.edges.push({ id: `${pipe.from}>${pipe.to}`, kind: 'sewer_main', from: pipe.from, to: pipe.to, diameter: sewer.mainDiameter, ...(lift === undefined ? {} : { inverts: [lift, inverts.get(pipe.to) ?? 0] as const }) })
  }
  for (const lateral of laterals) {
    const { connection, drop } = lateral
    const joint = joints.get(lateral.key) as string
    const lot = `lot:${connection.lot}:sewer`
    sink.nodes.push({ id: lot, kind: 'connection', at: connection.at, invert: connection.invert, carries: ['sewer'], lot: connection.lot }, drop)
    if (lateral.fall === undefined) sink.edges.push({ id: `sewer:lateral:${connection.lot}`, kind: 'sewer_lateral', from: lot, to: drop.id, diameter: sewer.lateralDiameter })
    else {
      sink.nodes.push(lateral.fall)
      sink.edges.push({ id: `sewer:lateral:${connection.lot}`, kind: 'sewer_lateral', from: lot, to: lateral.fall.id, diameter: sewer.lateralDiameter })
      sink.edges.push({ id: `${lateral.fall.id}>${drop.id}`, kind: 'sewer_lateral', from: lateral.fall.id, to: drop.id, diameter: sewer.lateralDiameter })
    }
    sink.edges.push({ id: `${drop.id}>${joint}`, kind: 'sewer_lateral', from: drop.id, to: joint, diameter: sewer.lateralDiameter, inverts: [drop.invert ?? 0, (inverts.get(joint) ?? 0) + sewer.mainDiameter] })
  }
}
