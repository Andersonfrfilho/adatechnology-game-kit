import type { DistributionSpec } from '@adatechnology/game-urban'
import { distributionHardwareOf } from '@adatechnology/game-urban/networks'
import type { NetworkEdge, NetworkNode, PoleHardware, PolePoint, UtilityNetworks } from '@adatechnology/game-urban/networks'

import type { Vec3 } from './catenary'

/** A drawn pole: where it stands, how it is turned (`road` its +x toward the road, `line` its +z), its spec and its hardware. */
export type PoleFrame = {
  readonly id: string
  readonly specId: string
  readonly spec: DistributionSpec
  readonly x: number
  /** The ground at its foot. */
  readonly y: number
  readonly z: number
  /** As three.js turns an object about y: the frame's +x goes to `road`. */
  readonly ry: number
  readonly road: readonly [number, number]
  readonly line: readonly [number, number]
  readonly hardware: PoleHardware
  readonly guyed: boolean
}

/** The edges of the conductors that run pole to pole: their directions turn a pole and pull its guys. */
export const LINE_EDGES: ReadonlySet<NetworkEdge['kind']> = new Set(['mv_span', 'lv_span', 'telecom_span'])

/** A point of a frame (`local`, metres in the pole's frame) in the world. */
export function worldOf(frame: Pick<PoleFrame, 'x' | 'y' | 'z' | 'road' | 'line'>, local: PolePoint): Vec3 {
  return [frame.x + local[0] * frame.road[0] + local[2] * frame.line[0], frame.y + local[1], frame.z + local[0] * frame.road[1] + local[2] * frame.line[1]]
}

const unit = (x: number, z: number): [number, number] => {
  const length = Math.hypot(x, z)
  return length < 1e-9 ? [1, 0] : [x / length, z / length]
}

/** The nodes an edge links to a node, by edge kind. */
export type NetworkIndex = {
  readonly nodes: ReadonlyMap<string, NetworkNode>
  /** The edges at each node (as `from` or `to`). */
  readonly at: ReadonlyMap<string, readonly NetworkEdge[]>
}

export function indexOf(networks: UtilityNetworks): NetworkIndex {
  const at = new Map<string, NetworkEdge[]>()
  for (const edge of networks.edges) {
    for (const end of [edge.from, edge.to]) at.set(end, [...(at.get(end) ?? []), edge])
  }
  return { nodes: new Map(networks.nodes.map((node) => [node.id, node])), at }
}

/** The directions (unit, plan) from a pole to the other ends of its line spans, a splice standing for the pole beyond it. */
export function lineDirectionsOf(index: NetworkIndex, pole: NetworkNode): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = []
  for (const edge of index.at.get(pole.id) ?? []) {
    if (!LINE_EDGES.has(edge.kind)) continue
    const other = index.nodes.get(edge.from === pole.id ? edge.to : edge.from)
    if (!other || other.kind === 'transformer') continue
    const far = other.kind === 'splice' ? farEndOf(index, other, pole.id) : other
    const direction = unit(far.at[0] - pole.at[0], far.at[2] - pole.at[2])
    if (!out.some((seen) => seen[0] * direction[0] + seen[1] * direction[1] > 0.94)) out.push(direction)
  }
  return out
}

/** The node past a splice, seen from `from`. */
function farEndOf(index: NetworkIndex, splice: NetworkNode, from: string): NetworkNode {
  const next = (index.at.get(splice.id) ?? []).map((edge) => (edge.from === splice.id ? edge.to : edge.from)).find((id) => id !== from)
  return (next && index.nodes.get(next)) || splice
}

/** Toward the road: to its lamp; a pole with no lamp turns across its line, away from the lots it feeds. */
function roadOf(index: NetworkIndex, pole: NetworkNode): [number, number] {
  const lamp = index.nodes.get(`light:${pole.id}`)
  if (lamp) return unit(lamp.at[0] - pole.at[0], lamp.at[2] - pole.at[2])
  const along = lineDirectionsOf(index, pole)[0] ?? [1, 0]
  const across: [number, number] = [-along[1], along[0]]
  const lot = (index.at.get(pole.id) ?? []).filter((edge) => edge.kind === 'service_drop' && edge.from === pole.id).map((edge) => index.nodes.get(edge.to))[0]
  if (!lot) return across
  const toward = (lot.at[0] - pole.at[0]) * across[0] + (lot.at[2] - pole.at[2]) * across[1]
  return toward > 0 ? [-across[0], -across[1]] : across
}

/** How many telecom cables reach a pole: the most any of its telecom spans carries. */
function cablesAt(index: NetworkIndex, pole: NetworkNode): number {
  return Math.max(0, ...(index.at.get(pole.id) ?? []).filter((edge) => edge.kind === 'telecom_span').map((edge) => edge.conductors ?? 1))
}

export type PoleSpecOf = (id: string) => DistributionSpec

/** The frame and the hardware of every pole of the networks. */
export function poleFramesOf({ networks, index, specOf }: { readonly networks: UtilityNetworks; readonly index: NetworkIndex; readonly specOf: PoleSpecOf }): PoleFrame[] {
  return networks.nodes
    .filter((node) => node.kind === 'pole')
    .map((node): PoleFrame => {
      const specId = node.spec ?? 'concrete_distribution'
      const spec = specOf(specId)
      const road = roadOf(index, node)
      const hardware = distributionHardwareOf(spec, {
        mv: node.carries.includes('power_mv'),
        transformer: index.nodes.has(`transformer:${node.id}`),
        lamp: index.nodes.has(`light:${node.id}`),
        cables: cablesAt(index, node),
        cableGap: networks.rules.layout.telecom.cableGap,
      })
      return { id: node.id, specId, spec, x: node.at[0], y: node.at[1], z: node.at[2], ry: Math.atan2(-road[1], road[0]), road, line: [-road[1], road[0]], hardware, guyed: node.guyed === true }
    })
}
