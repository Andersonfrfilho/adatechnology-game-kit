import { worldOf } from './frame'
import type { PoleStation } from './pole-layout'
import type { StreetRun } from './runs'

/** A pole of the networks: its stable id and where it stands. A corner shared by two streets is one pole. */
export type NetworkPole = { readonly id: string; readonly station: PoleStation }

/**
 * The poles one feed reaches through the spans, as a tree from the pole nearest the feed: `parent`, `children` and the length of line
 * from the root to each pole. Spans that would close a loop are left out, so every network laid on it is radial.
 */
export type PoleSystem = {
  readonly root: string
  /** Where the line enters the map (a run end at the border), on the line of the poles. */
  readonly feed: readonly [number, number]
  /** In order of distance from the root. */
  readonly poles: readonly string[]
  readonly parent: ReadonlyMap<string, string>
  readonly children: ReadonlyMap<string, readonly string[]>
  readonly distance: ReadonlyMap<string, number>
  readonly depth: ReadonlyMap<string, number>
}

export type PoleTree = { readonly poles: ReadonlyMap<string, NetworkPole>; readonly systems: readonly PoleSystem[] }

export type PoleTreeParams = {
  /** Stations of each run in order, and service chains from their street pole: consecutive stations are spans. */
  readonly chains: ReadonlyArray<readonly PoleStation[]>
  readonly sides: ReadonlyMap<string, 1 | -1>
  readonly setback: number
}

const planDistance = (a: PoleStation, b: PoleStation): number => Math.hypot(a.x - b.x, a.z - b.z)
const spotOf = (station: PoleStation): string => `${Math.round(station.x * 20)},${Math.round(station.z * 20)}`

/** Poles by id (a station two runs share at the same spot kept once) and the spans between consecutive stations of each chain. */
function polesAndSpans(chains: ReadonlyArray<readonly PoleStation[]>): { poles: Map<string, NetworkPole>; spans: Map<string, Set<string>> } {
  const poles = new Map<string, NetworkPole>()
  const bySpot = new Map<string, string>()
  const spans = new Map<string, Set<string>>()
  const link = (a: string, b: string): void => {
    if (a === b) return
    spans.set(a, (spans.get(a) ?? new Set()).add(b))
    spans.set(b, (spans.get(b) ?? new Set()).add(a))
  }
  for (const chain of chains) {
    let previous: string | undefined
    for (const station of chain) {
      const id = bySpot.get(spotOf(station)) ?? station.id
      if (!poles.has(id)) {
        poles.set(id, { id, station })
        bySpot.set(spotOf(station), id)
      }
      if (previous !== undefined) link(previous, id)
      previous = id
    }
  }
  linkCorners(poles, link)
  return { poles, spans }
}

/** At every crossing, the corner poles of the two streets that do not share a spot are joined by a span across the corner (the nearest pair). */
function linkCorners(poles: ReadonlyMap<string, NetworkPole>, link: (a: string, b: string) => void): void {
  const corners = [...poles.values()].filter((pole) => pole.station.role === 'corner')
  const runs = new Map(corners.map((pole) => [pole.station.run.id, pole.station.run]))
  for (const run of runs.values()) {
    for (const crossing of run.crossings) {
      const near = (pole: NetworkPole, of: StreetRun, at: number, half: number): boolean => pole.station.run.id === of.id && Math.abs(pole.station.u - at) <= half + 2
      const other = runs.get(crossing.run)
      if (other === undefined || other.id < run.id) continue
      const mine = corners.filter((pole) => near(pole, run, crossing.at, crossing.half))
      const theirs = corners.filter((pole) => near(pole, other, run.axis, run.width / 2))
      const pairs = mine.flatMap((a) => theirs.map((b) => [a, b] as const)).sort((p, q) => planDistance(p[0].station, p[1].station) - planDistance(q[0].station, q[1].station) || (p[0].id + p[1].id < q[0].id + q[1].id ? -1 : 1))
      const best = pairs[0]
      if (best !== undefined) link(best[0].id, best[1].id)
    }
  }
}

function feedOf({ runs, sides, setback, fallback }: { readonly runs: readonly StreetRun[]; readonly sides: ReadonlyMap<string, 1 | -1>; readonly setback: number; readonly fallback: NetworkPole }): readonly [number, number] {
  for (const run of runs) {
    const v = (sides.get(run.id) ?? -1) * (run.width / 2 + setback)
    if (run.ends[0] === 'edge') return worldOf({ frame: run, u: run.from, v })
    if (run.ends[1] === 'edge') return worldOf({ frame: run, u: run.to, v })
  }
  return [fallback.station.x, fallback.station.z]
}

/** Shortest-line tree from the root over the spans (ties by id), so the same poles always give the same tree. Plain O(n²) Dijkstra: a system has tens of poles. */
function treeFrom({ root, poles, spans }: { readonly root: string; readonly poles: ReadonlyMap<string, NetworkPole>; readonly spans: ReadonlyMap<string, ReadonlySet<string>> }): Omit<PoleSystem, 'feed'> {
  const distance = new Map([[root, 0]])
  const parent = new Map<string, string>()
  const done = new Set<string>()
  const order: string[] = []
  for (;;) {
    const open = [...distance.entries()].filter(([id]) => !done.has(id)).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))[0]
    if (open === undefined) break
    const [id, base] = open
    done.add(id)
    order.push(id)
    for (const next of [...(spans.get(id) ?? [])].sort()) {
      const length = base + planDistance((poles.get(id) as NetworkPole).station, (poles.get(next) as NetworkPole).station)
      if (done.has(next) || length >= (distance.get(next) ?? Number.POSITIVE_INFINITY)) continue
      distance.set(next, length)
      parent.set(next, id)
    }
  }
  const children = new Map<string, string[]>()
  const depth = new Map<string, number>()
  for (const id of order) {
    const up = parent.get(id)
    depth.set(id, up === undefined ? 0 : (depth.get(up) ?? 0) + 1)
    if (up !== undefined) children.set(up, [...(children.get(up) ?? []), id])
  }
  return { root, poles: order, parent, children, distance, depth }
}

/** The poles of every run and the systems they make: each fed from the border where one of its runs leaves the map (one per side of a river). */
export function poleTreeOf({ chains, sides, setback }: PoleTreeParams): PoleTree {
  const { poles, spans } = polesAndSpans(chains)
  const systems: PoleSystem[] = []
  const seen = new Set<string>()
  for (const pole of poles.values()) {
    if (seen.has(pole.id)) continue
    const members = treeFrom({ root: pole.id, poles, spans }).poles
    for (const id of members) seen.add(id)
    const runs = [...new Map(members.map((id) => (poles.get(id) as NetworkPole).station.run).map((run) => [run.id, run])).values()]
    const feed = feedOf({ runs, sides, setback, fallback: pole })
    const along = (id: string): number => Math.hypot((poles.get(id) as NetworkPole).station.x - feed[0], (poles.get(id) as NetworkPole).station.z - feed[1])
    const root = [...members].filter((id) => (poles.get(id) as NetworkPole).station.role !== 'service').sort((a, b) => along(a) - along(b))[0] ?? pole.id
    systems.push({ ...treeFrom({ root, poles, spans }), feed })
  }
  return { poles, systems }
}

/** Length of the span between two poles, metres in plan. */
export const spanLength = ({ tree, from, to }: { readonly tree: PoleTree; readonly from: string; readonly to: string }): number =>
  planDistance((tree.poles.get(from) as NetworkPole).station, (tree.poles.get(to) as NetworkPole).station)
