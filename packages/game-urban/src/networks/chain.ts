import { ordinal, worldOf } from './frame'
import type { LineNetwork, LineSegment } from './line-network'
import type { StreetRun } from './runs'

/** A point a branch joins a main at (a lateral's saddle, a service's tee): its run, its station along it and a key to find it again. */
export type ChainStop = { readonly key: string; readonly run: StreetRun; readonly u: number }

/** A node of a main along a segment: a vertex of the line, a joint where a stop branches off, or a manhole that keeps the spacing. */
export type ChainNode = { readonly id: string; readonly x: number; readonly z: number; readonly role: 'vertex' | 'stop' | 'spaced' }

export type ChainParams = {
  readonly line: LineNetwork
  readonly prefix: string
  readonly offset: (run: StreetRun) => number
  readonly stops: readonly ChainStop[]
  /** Longest gap between two nodes that are not stops (manholes); none = no spacing. */
  readonly spacing?: number
}

/**
 * Every segment of a line as a chain of nodes in the direction of the flow, with the stops of its run inserted at their stations and
 * spaced nodes so no two non-stop nodes are farther apart than `spacing`. `joints` tells which node each stop landed on.
 */
export function chainsOf(params: ChainParams): { chains: ChainNode[][]; joints: Map<string, string> } {
  const joints = new Map<string, string>()
  const chains = params.line.segments.map((segment, index) => chainOf({ segment, index, params, joints }))
  return { chains, joints }
}

function chainOf({ segment, index, params, joints }: { readonly segment: LineSegment; readonly index: number; readonly params: ChainParams; readonly joints: Map<string, string> }): ChainNode[] {
  const { run, ua, ub } = segment
  const [low, high] = [Math.min(ua, ub), Math.max(ua, ub)]
  const place = (u: number): readonly [number, number] => worldOf({ frame: run, u, v: params.offset(run) })
  const vertex = (id: string): ChainNode => {
    const found = params.line.vertices.get(id)
    return { id, x: found?.x ?? 0, z: found?.z ?? 0, role: 'vertex' }
  }
  const points: Array<{ u: number; node: ChainNode }> = []
  for (const stop of params.stops) {
    if (stop.run.id !== run.id || stop.u < low - 1e-6 || stop.u > high + 1e-6 || joints.has(stop.key)) continue
    if (Math.abs(stop.u - ua) < 0.05) joints.set(stop.key, segment.from)
    else if (Math.abs(stop.u - ub) < 0.05) joints.set(stop.key, segment.to)
    else {
      const [x, z] = place(stop.u)
      const id = `${params.prefix}:${stop.key}`
      points.push({ u: stop.u, node: { id, x, z, role: 'stop' } })
      joints.set(stop.key, id)
    }
  }
  if (params.spacing !== undefined) {
    const parts = Math.ceil((high - low) / params.spacing - 1e-9)
    for (let part = 1; part < parts; part++) {
      const u = low + ((high - low) * part) / parts
      const [x, z] = place(u)
      points.push({ u, node: { id: `${params.prefix}:${run.id}:${ordinal(index)}:${ordinal(part - 1)}`, x, z, role: 'spaced' } })
    }
  }
  const direction = ub >= ua ? 1 : -1
  points.sort((a, b) => (a.u - b.u) * direction)
  return [vertex(segment.from), ...points.map((point) => point.node), vertex(segment.to)]
}
