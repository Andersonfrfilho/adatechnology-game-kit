import { ordinal, worldOf } from './frame'
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

const planDistance = (a: NetworkPole, b: NetworkPole): number => Math.hypot(a.station.x - b.station.x, a.station.z - b.station.z)

/** Poles by id (`pole:<run>:NN`), a corner two runs share kept once, and the spans between consecutive poles of each run. */
function polesAndSpans(stations: ReadonlyArray<readonly PoleStation[]>): { poles: Map<string, NetworkPole>; spans: Map<string, Set<string>> } {
  const poles = new Map<string, NetworkPole>()
  const spans = new Map<string, Set<string>>()
  const link = (a: string, b: string): void => {
    if (a === b) return
    spans.set(a, (spans.get(a) ?? new Set()).add(b))
    spans.set(b, (spans.get(b) ?? new Set()).add(a))
  }
  for (const run of stations) {
    let previous: string | undefined
    run.forEach((station, index) => {
      const same = [...poles.values()].find((pole) => Math.hypot(pole.station.x - station.x, pole.station.z - station.z) < 0.05)
      const id = same?.id ?? `pole:${station.run.id}:${ordinal(index)}`
      if (same === undefined) poles.set(id, { id, station })
      if (previous !== undefined) link(previous, id)
      previous = id
    })
  }
  return { poles, spans }
}

function feedOf(runs: readonly StreetRun[], sides: ReadonlyMap<string, 1 | -1>, setback: number, fallback: NetworkPole): readonly [number, number] {
  for (const run of runs) {
    const lateral = (sides.get(run.id) ?? -1) * (run.width / 2 + setback)
    if (run.ends[0] === 'edge') return worldOf(run.along, run.axis, run.from, lateral)
    if (run.ends[1] === 'edge') return worldOf(run.along, run.axis, run.to, lateral)
  }
  return [fallback.station.x, fallback.station.z]
}

/** Shortest-line tree from the root over the spans (ties by id), so the same poles always give the same tree. */
function treeFrom(root: string, poles: ReadonlyMap<string, NetworkPole>, spans: ReadonlyMap<string, ReadonlySet<string>>): Omit<PoleSystem, 'feed'> {
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
      const length = base + planDistance(poles.get(id) as NetworkPole, poles.get(next) as NetworkPole)
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

/** The poles of every run and the systems they make: each fed from the border where its first run leaves the map (one per side of a river). */
export function poleTreeOf(stations: ReadonlyArray<readonly PoleStation[]>, sides: ReadonlyMap<string, 1 | -1>, setback: number): PoleTree {
  const { poles, spans } = polesAndSpans(stations)
  const systems: PoleSystem[] = []
  const seen = new Set<string>()
  for (const pole of poles.values()) {
    if (seen.has(pole.id)) continue
    const members = treeFrom(pole.id, poles, spans).poles
    for (const id of members) seen.add(id)
    const runs = [...new Map(members.map((id) => (poles.get(id) as NetworkPole).station.run).map((run) => [run.id, run])).values()]
    const feed = feedOf(runs, sides, setback, pole)
    const root = [...members].sort((a, b) => Math.hypot((poles.get(a) as NetworkPole).station.x - feed[0], (poles.get(a) as NetworkPole).station.z - feed[1]) - Math.hypot((poles.get(b) as NetworkPole).station.x - feed[0], (poles.get(b) as NetworkPole).station.z - feed[1]))[0] as string
    systems.push({ ...treeFrom(root, poles, spans), feed })
  }
  return { poles, systems }
}

/** Length of the span between two poles, metres in plan. */
export const spanLength = (tree: PoleTree, a: string, b: string): number => planDistance(tree.poles.get(a) as NetworkPole, tree.poles.get(b) as NetworkPole)
