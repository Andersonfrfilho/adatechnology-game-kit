import type { PlanePoint } from './support-hull'
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
  const order = loadOrder(graph.size, reached, carriers)
  return { distance, reached, carriers, shares: sharesOf(graph, carriers, order), order }
}

/** Supports of a lying part closer than this (m, between the centres of their contacts) bear it at one place: they share by stiffness, not by statics. */
export const SAME_BEARING = 0.3

/** The shares of a lying part on two supports apart, by statics: the lever rule on its centroid projected on the line between them. */
function leverShares(centre: PlanePoint, a: PlanePoint, b: PlanePoint): number[] {
  const along: PlanePoint = [b[0] - a[0], b[1] - a[1]]
  const t = Math.min(1, Math.max(0, ((centre[0] - a[0]) * along[0] + (centre[1] - a[1]) * along[1]) / (along[0] ** 2 + along[1] ** 2)))
  return [1 - t, t]
}

/**
 * Most pillars a lying part is taken as rigid on (a tank slab or a cap on its three or four pillars): a part on more (a whole slab on every wall and pillar
 * under it), or on beams (a slab panel on its edges, which bend with it), is left to the stiffness of each carrier.
 */
export const MAX_RIGID_CARRIERS = 4

/** Whether points spread over the plane (not all on one line): the second moments about their mean have a determinant. */
function spreadsInPlane(at: readonly PlanePoint[]): boolean {
  const mid = [at.reduce((t, p) => t + p[0], 0) / at.length, at.reduce((t, p) => t + p[1], 0) / at.length] as const
  const [xx, xy, yy] = [at.reduce((t, p) => t + (p[0] - mid[0]) ** 2, 0), at.reduce((t, p) => t + (p[0] - mid[0]) * (p[1] - mid[1]), 0), at.reduce((t, p) => t + (p[1] - mid[1]) ** 2, 0)]
  return xx * yy - xy * xy > 1e-6 * Math.max(xx + yy, 1e-12) ** 2
}

/**
 * The shares of a rigid lying part on springs (a slab panel, a tank slab, a cap: three carriers and more spread over the plane): each carrier takes its
 * stiffness `k` times the drop of the part at its contact, the part sinking and tilting so that the reactions balance its load and its moment about the
 * centroid (`centre`). A carrier the tilt would pull up carries nothing and the rest share again (on one line, about that line). A beam over a row of
 * carriers is no rigid body (it bends between them): it is left to the stiffness of each.
 */
function rigidShares(centre: PlanePoint, at: readonly PlanePoint[], stiffness: readonly number[]): number[] {
  const kept = at.map(() => true)
  for (;;) {
    const k = stiffness.map((value, i) => (kept[i] ? value : 0))
    const sum = k.reduce((total, value) => total + value, 0)
    const mid: PlanePoint = [k.reduce((t, v, i) => t + v * at[i]![0], 0) / sum, k.reduce((t, v, i) => t + v * at[i]![1], 0) / sum]
    const d = at.map((p): PlanePoint => [p[0] - mid[0], p[1] - mid[1]])
    const [xx, xy, yy] = [k.reduce((t, v, i) => t + v * d[i]![0] ** 2, 0), k.reduce((t, v, i) => t + v * d[i]![0] * d[i]![1], 0), k.reduce((t, v, i) => t + v * d[i]![1] ** 2, 0)]
    const e: PlanePoint = [centre[0] - mid[0], centre[1] - mid[1]]
    const det = xx * yy - xy * xy
    // the tilt that balances the moment: both ways, or about the line the carriers stand on (none when they stand at one point)
    const scale = Math.max(xx + yy, 1e-12)
    const [tx, ty] = det > 1e-9 * scale * scale ? [(e[0] * yy - e[1] * xy) / det, (e[1] * xx - e[0] * xy) / det] : xx + yy > 1e-12 ? [(e[0] * (xx / scale) + e[1] * (xy / scale)) / scale, (e[0] * (xy / scale) + e[1] * (yy / scale)) / scale] : [0, 0]
    const shares = k.map((v, i) => v * (1 / sum + tx * d[i]![0] + ty * d[i]![1]))
    const worst = shares.reduce((w, v, i) => (kept[i] && v < shares[w]! ? i : w), kept.indexOf(true))
    if (shares[worst]! >= -1e-9 || kept.filter(Boolean).length <= 1) return shares.map((v) => Math.max(0, v))
    kept[worst] = false
  }
}

/**
 * The share of each part's load each carrier takes. A lying part on two supports apart is statically determinate: the lever rule on its centroid
 * (`SupportGraph.centre`, `SupportEdge.at`). On three or four upright carriers (pillars) spread over the plane it is a rigid part on springs (`rigidShares`): statics first,
 * the stiffness of each carrier (its contact over the compliance of its path) only where statics leaves the shares open. At one bearing, along a row of
 * carriers (a beam over many), on lying carriers or on more than `MAX_RIGID_CARRIERS`, each carrier takes its contact
 * (`SupportEdge.weight`, equal without) over the compliance of its path to the ground, where every carrier's is known and none is the ground; else the
 * contact alone. The
 * compliance (m/GPa) is worked out from the ground up: the ground none, an upright part its `height / E` over what carries it (in series), a lying one
 * that of its carriers in parallel.
 */
function sharesOf(graph: SupportGraph, carriers: ReadonlyMap<number, readonly number[]>, order: readonly number[]): Map<number, number[]> {
  const compliance = new Map<number, number | undefined>()
  const shares = new Map<number, number[]>()
  for (let k = order.length - 1; k >= 0; k--) {
    const part = order[k]!
    if (graph.anchored(part)) {
      compliance.set(part, 0)
      shares.set(part, [])
      continue
    }
    const lower = carriers.get(part) ?? []
    const edges = lower.map((support) => graph.supportsOf(part).find((edge) => edge.on === support))
    const contact = edges.map((edge) => Math.max(1e-9, edge?.weight ?? 1))
    const paths = lower.map((support) => compliance.get(support))
    const known = paths.every((value) => value !== undefined)
    const upright = graph.upright?.(part) ?? false
    const [a, b] = edges.map((edge) => edge?.at)
    const centre = graph.centre?.(part)
    const points = edges.map((edge) => edge?.at)
    const apart = points.every((p) => p !== undefined) && points.some((p) => points.some((q) => Math.hypot(p![0] - q![0], p![1] - q![1]) > SAME_BEARING)) && spreadsInPlane(points as PlanePoint[])
    const stiff = known && paths.every((value) => value! > 0)
    const weights = contact.map((weight, i) => (stiff ? weight / paths[i]! : weight))
    if (!upright && lower.length === 2 && a && b && centre && Math.hypot(b[0] - a[0], b[1] - a[1]) > SAME_BEARING) shares.set(part, leverShares(centre, a, b))
    else if (!upright && lower.length > 2 && lower.length <= MAX_RIGID_CARRIERS && lower.every((k) => graph.upright?.(k) === true) && centre && apart) shares.set(part, rigidShares(centre, points as PlanePoint[], weights))
    else {
      const total = weights.reduce((sum, weight) => sum + weight, 0)
      shares.set(part, weights.map((weight) => weight / total))
    }
    // what carries it, in parallel (the ground does not shorten)
    const below = !lower.length ? 0 : !known ? undefined : paths.some((value) => value === 0) ? 0
      : contact.reduce((sum, weight) => sum + weight, 0) / contact.reduce((sum, weight, i) => sum + weight / paths[i]!, 0)
    const modulus = graph.stiffness?.(part)
    compliance.set(part, below === undefined ? undefined : !upright ? below : modulus ? (graph.height?.(part) ?? 1) / modulus + below : undefined)
  }
  return shares
}

/** What a caller does as the load goes down (the destruction world bends its beams and slabs with it). */
export interface LoadVisitor {
  /** `part`'s load is final (its mass and all that rests on it): called before its shares are passed down. */
  settled?(part: number, load: number): void
  /** `load` of `part` goes to `support`. */
  share?(part: number, support: number, load: number): void
}

/** The load each reached part carries: its own mass and what rests on it, shared among its carriers by their contact, in the order the load goes down. */
export function distributeLoads(solution: SupportSolution, mass: (part: number) => number, visitor: LoadVisitor = {}): Float64Array {
  const loads = new Float64Array(solution.distance.length)
  for (const part of solution.order) {
    const total = mass(part) + loads[part]!
    loads[part] = total
    visitor.settled?.(part, total)
    const lower = solution.carriers.get(part) ?? []
    const shares = solution.shares.get(part) ?? []
    lower.forEach((support, k) => {
      const share = total * (shares[k] ?? 1 / lower.length)
      loads[support] = loads[support]! + share
      visitor.share?.(part, support, share)
    })
  }
  return loads
}
