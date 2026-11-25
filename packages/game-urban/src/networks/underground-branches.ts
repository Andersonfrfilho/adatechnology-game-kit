import type { BuriedContext } from './buried'
import type { ChainNode } from './chain'
import { frameOf, worldOf } from './frame'
import type { PoleHeights } from './aerial'
import type { StreetRun } from './runs'
import type { NetworkEdge, NetworkNode } from './types'
import type { UndergroundCircuit, UndergroundLight, UndergroundLot } from './underground-circuits'

/** Depths under the ground of the bank: its top, and the bottom of each layer of ducts. */
export type Bank = { readonly top: number; readonly lv: number; readonly telecom: number; readonly mv: number }

export type BranchesParams = {
  readonly context: BuriedContext
  readonly bank: Bank
  readonly circuits: readonly UndergroundCircuit[]
  readonly lights: readonly UndergroundLight[]
  readonly joints: ReadonlyMap<string, string>
  readonly where: ReadonlyMap<string, ChainNode>
  readonly column: { readonly id: string; readonly heights: PoleHeights }
}

type Ends = { readonly context: BuriedContext; readonly box: ChainNode; readonly end: readonly [number, number] }
const groundsOf = ({ context, box, end }: Ends): readonly [number, number] => [context.groundAt(box.x, box.z), context.groundAt(end[0], end[1])]

/** The invert of a branch where it leaves the bank, and where it ends: level with the bank on its own side, risen to its least cover across the street. */
function branchInverts({ ends, start, diameter, cover, level }: { readonly ends: Ends; readonly start: number; readonly diameter: number; readonly cover: number; readonly level: boolean }): readonly [number, number] {
  const [boxGround, endGround] = groundsOf(ends)
  const margin = ends.context.rules.layout.coverMargin
  return [boxGround - start, level ? endGround - start : endGround - cover - margin - diameter]
}

/** Whether a point lies on the bank's side of its street. */
function onBankSide({ context, run, at }: { readonly context: BuriedContext; readonly run: StreetRun; readonly at: readonly [number, number] }): boolean {
  const [, v] = frameOf({ frame: run, x: at[0], z: at[1] })
  return Math.sign(v) === -(context.sides.get(run.id) ?? -1)
}

/** A lot's power lateral and telecom lateral from its box to its meter and its telecom box. */
function lotBranches({ params, circuit, lot }: { readonly params: BranchesParams; readonly circuit: UndergroundCircuit; readonly lot: UndergroundLot }): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const { context, bank, joints, where } = params
  const { underground } = context.rules.layout
  const box = where.get(joints.get(lot.key) ?? '')
  const nodes: NetworkNode[] = []
  const edges: NetworkEdge[] = []
  if (box === undefined) return { nodes, edges }
  const id = lot.served.lot.id
  for (const [connection, network] of [[lot.power, 'power'], [lot.telecom, 'telecom']] as const) {
    if (connection === undefined) continue
    const end: readonly [number, number] = [connection.at[0], connection.at[2]]
    const level = onBankSide({ context, run: circuit.run, at: end })
    const isPower = network === 'power'
    const diameter = isPower ? underground.lateralDiameter : underground.telecomLateralDiameter
    const start = isPower ? bank.top + diameter : bank.telecom
    const inverts = branchInverts({ ends: { context, box, end }, start, diameter, cover: context.rules.cover[isPower ? 'service_lateral' : 'telecom_lateral'].min, level })
    const node = `lot:${id}:${network}`
    nodes.push({ id: node, kind: 'connection', at: connection.at, carries: [isPower ? 'power_lv' : 'telecom'], lot: id })
    edges.push({ id: `${isPower ? 'service' : 'telecom_service'}:${id}`, kind: isPower ? 'service_lateral' : 'telecom_lateral', from: box.id, to: node, diameter, inverts })
  }
  return { nodes, edges }
}

/** A circuit's pad-mounted transformer on the sidewalk in front of its box: the medium voltage down to it, its low voltage back up to the box. */
function padOf({ params, circuit }: { readonly params: BranchesParams; readonly circuit: UndergroundCircuit }): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const { context, bank, joints, where } = params
  const { underground } = context.rules.layout
  const box = where.get(joints.get(circuit.padKey) ?? '')
  if (box === undefined) return { nodes: [], edges: [] }
  const { run } = circuit
  const [u] = frameOf({ frame: run, x: box.x, z: box.z })
  const at = worldOf({ frame: run, u, v: -(context.sides.get(run.id) ?? -1) * (run.width / 2 + underground.padFromKerb) })
  const id = `pad:${box.id}`
  const [boxGround, padGround] = groundsOf({ context, box, end: at })
  const node: NetworkNode = { id, kind: 'transformer', mount: 'pad', at: [at[0], padGround, at[1]], carries: ['power_mv', 'power_lv'], spec: circuit.rating.id }
  // the conduits from the bank into the pad's plinth: round, inside the bank's layer where they leave it
  const duct = (layer: 'mv' | 'lv'): Pick<NetworkEdge, 'diameter' | 'inverts'> => ({ diameter: underground.lateralDiameter, inverts: [boxGround - bank[layer] + 0.04, padGround - bank[layer] + 0.04] })
  const lv = duct('lv')
  return {
    nodes: [node],
    edges: [
      { id: `duct:mv:${box.id}>${id}`, kind: 'mv_duct', from: box.id, to: id, ...duct('mv') },
      { id: `duct:lv:${id}>${box.id}`, kind: 'lv_duct', from: id, to: box.id, diameter: lv.diameter, inverts: [(lv.inverts as readonly [number, number])[1], (lv.inverts as readonly [number, number])[0]] },
    ],
  }
}

/** A light column across the street with its lamp, and the cable from its box under the street to its foot. */
function lightOf({ params, light }: { readonly params: BranchesParams; readonly light: UndergroundLight }): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const { context, bank, joints, where, column } = params
  const box = where.get(joints.get(light.key) ?? '')
  if (box === undefined) return { nodes: [], edges: [] }
  const diameter = context.rules.layout.underground.lightCableDiameter
  const pole = `column:${light.key.slice('light:'.length)}`
  const ground = context.groundAt(light.at[0], light.at[1])
  const inverts = branchInverts({ ends: { context, box, end: light.at }, start: bank.top + diameter, diameter, cover: context.rules.cover.light_cable.min, level: false })
  return {
    nodes: [
      { id: pole, kind: 'pole', at: [light.at[0], ground, light.at[1]], carries: ['lighting'], spec: column.id },
      { id: `light:${pole}`, kind: 'light', at: [light.lamp[0], ground + column.heights.lamp, light.lamp[1]], carries: ['lighting'], spec: 'street_light' },
    ],
    edges: [
      { id: `light_cable:${pole}`, kind: 'light_cable', from: box.id, to: pole, diameter, inverts },
      { id: `light_feed:${pole}`, kind: 'light_feed', from: pole, to: `light:${pole}`, sag: 0, heights: [column.heights.lamp + 0.2, column.heights.lamp] },
    ],
  }
}

/** The pads, the lots' laterals and the light columns with their cables: their nodes go to the sink, their edges are returned. */
export function layBranches(params: BranchesParams): NetworkEdge[] {
  const parts = [
    ...params.circuits.map((circuit) => padOf({ params, circuit })),
    ...params.circuits.flatMap((circuit) => circuit.lots.map((lot) => lotBranches({ params, circuit, lot }))),
    ...params.lights.map((light) => lightOf({ params, light })),
  ]
  params.context.sink.nodes.push(...parts.flatMap((part) => part.nodes))
  return parts.flatMap((part) => part.edges)
}
