import type { NetworkEdge, NetworkNode, NetworkSurface, PolePoint } from '@adatechnology/game-urban/networks'

import { catenaryPoints } from './catenary'
import type { Vec3 } from './catenary'
import { lineDirectionsOf, worldOf } from './pole-frames'
import type { NetworkIndex, PoleFrame } from './pole-frames'

/** The merged mesh a conductor goes into (design-redes §7, R13: one mesh per conductor class). */
export type WireClass = 'mv' | 'lv' | 'telecom' | 'drops' | 'guys'
export const WIRE_CLASSES: readonly WireClass[] = ['mv', 'lv', 'telecom', 'drops', 'guys']

/** The conductors of one edge (or one guy wire), each a polyline of the catenary, in one class. */
export type WireRun = { readonly id: string; readonly wireClass: WireClass; readonly conductors: readonly (readonly Vec3[])[] }

/** Shorter conductors than this (metres) are not drawn. */
const MIN_LENGTH = 0.05

const CLASS_OF: Partial<Record<NetworkEdge['kind'], WireClass>> = { mv_span: 'mv', lv_span: 'lv', telecom_span: 'telecom', service_drop: 'drops', telecom_drop: 'drops' }

type Ends = { readonly frames: ReadonlyMap<string, PoleFrame>; readonly index: NetworkIndex }

/** The fixing points of a class on a pole, in its frame. */
function pointsOn(frame: PoleFrame, kind: NetworkEdge['kind'], conductors: number): readonly PolePoint[] {
  const { attachments } = frame.hardware
  if (kind === 'mv_span') return attachments.mv
  if (kind === 'telecom_span') return attachments.telecom.slice(0, conductors)
  if (kind === 'telecom_drop') return attachments.telecom.slice(0, 1)
  return [attachments.lv]
}

/** The pole a node that is not one borrows its frame from (a feed, a splice): the pole at the other end of the edge, or the splice's neighbour. */
function frameNear({ frames, index }: Ends, node: NetworkNode, other: string): PoleFrame | undefined {
  const own = frames.get(other)
  if (own) return own
  const near = (index.at.get(node.id) ?? []).map((edge) => (edge.from === node.id ? edge.to : edge.from)).find((id) => frames.has(id))
  return near === undefined ? undefined : frames.get(near)
}

/** Where the conductors of `edge` are fixed at one end: on a pole, on its transformer, at a lot's anchor, or a feed and a splice placed as the next pole's hardware. */
function endOf(ends: Ends, edge: NetworkEdge, id: string, other: string): Vec3[] {
  const node = ends.index.nodes.get(id)
  if (!node) return []
  const conductors = edge.kind === 'telecom_span' ? edge.conductors ?? 1 : edge.kind === 'mv_span' ? 3 : 1
  const pole = ends.frames.get(id)
  if (pole) return pointsOn(pole, edge.kind, conductors).map((point) => worldOf(pole, point))
  if (node.kind === 'transformer') {
    const host = ends.frames.get(id.slice('transformer:'.length))
    const points = host?.hardware.attachments.transformer
    if (!host || !points) return []
    return (edge.kind === 'mv_span' ? points.mv : [points.lv]).map((point) => worldOf(host, point))
  }
  if (node.kind === 'connection') return [node.at]
  const near = frameNear(ends, node, other)
  if (!near) return [node.at]
  const placed = { ...near, x: node.at[0], z: node.at[2], y: 0 }
  return pointsOn(near, edge.kind, conductors).map((point) => worldOf(placed, point))
}

/** The conductors of every aerial edge the drawing shows (the light feed is inside the pole's arm), each hung with the edge's own sag. */
export function wireRunsOf(ends: Ends, edges: readonly NetworkEdge[]): WireRun[] {
  const runs: WireRun[] = []
  for (const edge of edges) {
    const wireClass = CLASS_OF[edge.kind]
    if (!wireClass) continue
    const from = endOf(ends, edge, edge.from, edge.to)
    const to = endOf(ends, edge, edge.to, edge.from)
    const count = Math.min(from.length, to.length)
    if (count === 0) continue
    const conductors = Array.from({ length: count }, (_, k) => catenaryPoints({ from: from[k]!, to: to[k]!, sag: edge.sag ?? 0 }))
    // a feed standing at its first pole links them with no length to draw
    if (Math.hypot(from[0]![0] - to[0]![0], from[0]![1] - to[0]![1], from[0]![2] - to[0]![2]) < MIN_LENGTH) continue
    runs.push({ id: edge.id, wireClass, conductors })
  }
  return runs
}

/** Shorter guys a pole tries when the full reach would anchor off the sidewalk. */
const GUY_SHARES = [1, 0.75, 0.5, 0.35] as const

export type GuyAnchor = { readonly id: string; readonly pole: string; readonly at: Vec3; readonly from: Vec3 }

/**
 * A guy wire against each pull of a corner or end pole: from its eye under the crossarm back along the line, anchored on the ground `guy.reach`
 * away, shortened until the anchor lies on the sidewalk (`surfaceAt`); a pull with no sidewalk behind it gets none.
 */
export function guysOf({ index, frames, surfaceAt }: Ends & { readonly surfaceAt?: (x: number, z: number) => NetworkSurface }): GuyAnchor[] {
  const out: GuyAnchor[] = []
  for (const frame of frames.values()) {
    const node = index.nodes.get(frame.id)
    if (!frame.guyed || !node) continue
    lineDirectionsOf(index, node).forEach((pull, k) => {
      const share = GUY_SHARES.find((s) => {
        const [x, z] = [frame.x - pull[0] * frame.spec.guy.reach * s, frame.z - pull[1] * frame.spec.guy.reach * s]
        return surfaceAt === undefined || surfaceAt(x, z) === 'sidewalk'
      })
      if (share === undefined) return
      const reach = frame.spec.guy.reach * share
      out.push({ id: `guy:${frame.id}:${k}`, pole: frame.id, from: worldOf(frame, frame.hardware.attachments.guy), at: [frame.x - pull[0] * reach, frame.y, frame.z - pull[1] * reach] })
    })
  }
  return out
}
