import type { LoadSharing, SupportEdge, SupportGraph, SupportSolution } from './types'

/**
 * Whether a support carries its share of a part's load: a support closer to the ground always does; with `all`, one the structure lays the part on does at
 * any distance (an undirected touch only down towards the ground: each end would otherwise carry the other).
 */
export const carriesShare = (sharing: LoadSharing, edge: Pick<SupportEdge, 'directed'>, supportDistance: number, partDistance: number): boolean =>
  supportDistance >= 0 && (supportDistance < partDistance || (sharing === 'all' && edge.directed))

/** Steps from the ground of every active part through what carries (a partition passes nothing on), and the order they are reached. */
function reach(graph: SupportGraph): { distance: Int32Array; reached: number[] } {
  const distance = new Int32Array(graph.size).fill(-1)
  const resting: number[][] = Array.from({ length: graph.size }, () => [])
  for (let part = 0; part < graph.size; part++) {
    if (!graph.active(part)) continue
    for (const edge of graph.supportsOf(part)) if (graph.active(edge.on)) resting[edge.on]!.push(part)
  }
  const reached: number[] = []
  for (let part = 0; part < graph.size; part++) {
    if (!graph.active(part) || !graph.anchored(part)) continue
    distance[part] = 0
    reached.push(part)
  }
  for (let head = 0; head < reached.length; head++) {
    const support = reached[head]!
    if (graph.partition(support)) continue
    for (const part of resting[support]!) {
      if (distance[part]! >= 0) continue
      distance[part] = distance[support]! + 1
      reached.push(part)
    }
  }
  return { distance, reached }
}

/** Every part before what it rests on; a support that closes a cycle (two parts laid on each other) is dropped from the part that closes it. */
function loadOrder(size: number, reached: readonly number[], carriers: Map<number, number[]>): number[] {
  const state = new Uint8Array(size)
  const done: number[] = []
  for (const root of reached) {
    if (state[root]) continue
    const stack: Array<{ part: number; next: number }> = [{ part: root, next: 0 }]
    state[root] = 1
    while (stack.length) {
      const top = stack[stack.length - 1]!
      const lower = carriers.get(top.part) ?? []
      if (top.next >= lower.length) {
        state[top.part] = 2
        done.push(top.part)
        stack.pop()
        continue
      }
      const support = lower[top.next++]!
      if (state[support] === 2) continue
      if (state[support] === 1) {
        lower.splice(--top.next, 1)
        continue
      }
      state[support] = 1
      stack.push({ part: support, next: 0 })
    }
  }
  return done.reverse()
}

/** The load path of `graph`: who reaches the ground, what carries each part (by its sharing rule) and the order the load goes down. */
export function solveSupports(graph: SupportGraph): SupportSolution {
  const { distance, reached } = reach(graph)
  const carriers = new Map<number, number[]>()
  for (const part of reached) {
    if (graph.anchored(part)) {
      carriers.set(part, [])
      continue
    }
    const lower: number[] = []
    for (const edge of graph.supportsOf(part)) {
      const support = edge.on
      if (!graph.active(support) || graph.partition(support) || lower.includes(support)) continue
      if (carriesShare(graph.sharing, edge, distance[support]!, distance[part]!)) lower.push(support)
    }
    carriers.set(part, lower)
  }
  return { distance, reached, carriers, order: loadOrder(graph.size, reached, carriers) }
}

/** What a caller does as the load goes down (the destruction world bends its beams and slabs with it). */
export interface LoadVisitor {
  /** `part`'s load is final (its mass and all that rests on it): called before its shares are passed down. */
  settled?(part: number, load: number): void
  /** `load` of `part` goes to `support`. */
  share?(part: number, support: number, load: number): void
}

/** The load each reached part carries: its own mass and what rests on it, shared equally among its carriers, in the order the load goes down. */
export function distributeLoads(solution: SupportSolution, mass: (part: number) => number, visitor: LoadVisitor = {}): Float64Array {
  const loads = new Float64Array(solution.distance.length)
  for (const part of solution.order) {
    const total = mass(part) + loads[part]!
    loads[part] = total
    visitor.settled?.(part, total)
    const lower = solution.carriers.get(part) ?? []
    for (const support of lower) {
      loads[support] = loads[support]! + total / lower.length
      visitor.share?.(part, support, total / lower.length)
    }
  }
  return loads
}
