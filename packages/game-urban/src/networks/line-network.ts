import { ordinal, worldOf } from './frame'
import type { RunEnd, StreetRun } from './runs'

/** A key point of a buried line: a run end, a crossing of two runs' lines, or the middle of a stretch that closes a loop. */
export type LineVertex = { readonly id: string; readonly x: number; readonly z: number; readonly role: 'end' | 'crossing' | 'split'; readonly end?: RunEnd }

/** A stretch of line on one run between two vertices, in the direction of the flow. `ua`, `ub` are the stations of `from` and `to`. */
export type LineSegment = { readonly run: StreetRun; readonly from: string; readonly to: string; readonly ua: number; readonly ub: number }

export type LineNetwork = { readonly vertices: ReadonlyMap<string, LineVertex>; readonly segments: readonly LineSegment[]; readonly roots: readonly string[] }

export type LineParams = {
  readonly prefix: string
  readonly runs: readonly StreetRun[]
  /** Distance of the line from the axis of each run (+ to +z or +x). */
  readonly offset: (run: StreetRun) => number
  /** A line stops this far before the river bank (the sewer's interceptor runs there). */
  readonly riverInset: number
  /** A line reaches a cross line this far past its own run's end (a street that ends at another). */
  readonly reach: number
  /** Drain lines flow to their roots (the river ends), supply lines from them (the border ends). */
  readonly flow: 'drain' | 'supply'
}

type Station = { readonly u: number; readonly vertex: LineVertex }

function stationsOf(run: StreetRun, params: LineParams): Station[] {
  const place = (u: number): readonly [number, number] => worldOf(run.along, run.axis, u, params.offset(run))
  const out: Station[] = []
  const position = run.axis + params.offset(run)
  for (const other of params.runs) {
    if (other.along === run.along) continue
    const u = other.axis + params.offset(other)
    if (u < run.from - params.reach || u > run.to + params.reach || position < other.from - params.reach || position > other.to + params.reach) continue
    const [x, z] = place(u)
    out.push({ u, vertex: { id: `${params.prefix}:x:${[run.id, other.id].sort().join(':')}`, x, z, role: 'crossing' } })
  }
  const ends: Array<readonly [number, RunEnd, string]> = [
    [run.ends[0] === 'river' ? run.from + params.riverInset : run.from, run.ends[0], 'start'],
    [run.ends[1] === 'river' ? run.to - params.riverInset : run.to, run.ends[1], 'end'],
  ]
  for (const [u, end, name] of ends) {
    if (out.some((station) => Math.abs(station.u - u) < 0.5)) continue
    const [x, z] = place(u)
    out.push({ u, vertex: { id: `${params.prefix}:${run.id}:${name}`, x, z, role: 'end', end } })
  }
  return out.sort((a, b) => a.u - b.u)
}

type Link = { readonly run: StreetRun; readonly a: Station; readonly b: Station }

/** The lines of every run joined at their crossings, as a tree toward (drain) or from (supply) the roots; a stretch that would close a loop is split in its middle. */
export function lineNetworkOf(params: LineParams): LineNetwork {
  const vertices = new Map<string, LineVertex>()
  const links: Link[] = []
  for (const run of params.runs) {
    const stations = stationsOf(run, params)
    for (const station of stations) if (!vertices.has(station.vertex.id)) vertices.set(station.vertex.id, station.vertex)
    for (let index = 1; index < stations.length; index++) links.push({ run, a: stations[index - 1] as Station, b: stations[index] as Station })
  }
  const roots = rootsOf(vertices, links, params.flow)
  const parent = shortestTree(roots, links)
  const segments: LineSegment[] = []
  let splits = 0
  for (const link of links) {
    const [a, b] = [link.a.vertex.id, link.b.vertex.id]
    const toward = (from: Station, to: Station): LineSegment =>
      params.flow === 'drain' ? { run: link.run, from: from.vertex.id, to: to.vertex.id, ua: from.u, ub: to.u } : { run: link.run, from: to.vertex.id, to: from.vertex.id, ua: to.u, ub: from.u }
    if (parent.get(a) === b) segments.push(toward(link.a, link.b))
    else if (parent.get(b) === a) segments.push(toward(link.b, link.a))
    else {
      const u = (link.a.u + link.b.u) / 2
      const [x, z] = worldOf(link.run.along, link.run.axis, u, params.offset(link.run))
      const middle: Station = { u, vertex: { id: `${params.prefix}:${link.run.id}:split:${ordinal(splits++)}`, x, z, role: 'split' } }
      vertices.set(middle.vertex.id, middle.vertex)
      segments.push(toward(middle, link.a), toward(middle, link.b))
    }
  }
  return { vertices, segments, roots }
}

function componentsOf(vertices: ReadonlyMap<string, LineVertex>, links: readonly Link[]): string[][] {
  const near = new Map<string, string[]>()
  for (const link of links) {
    near.set(link.a.vertex.id, [...(near.get(link.a.vertex.id) ?? []), link.b.vertex.id])
    near.set(link.b.vertex.id, [...(near.get(link.b.vertex.id) ?? []), link.a.vertex.id])
  }
  const seen = new Set<string>()
  const out: string[][] = []
  for (const id of vertices.keys()) {
    if (seen.has(id)) continue
    const group: string[] = []
    const pending = [id]
    while (pending.length > 0) {
      const next = pending.pop() as string
      if (seen.has(next)) continue
      seen.add(next)
      group.push(next)
      pending.push(...(near.get(next) ?? []))
    }
    out.push(group)
  }
  return out
}

/** Drain: every river end of a group (else its first border end, else its first vertex); supply: the first border end of a group (else its first vertex). */
function rootsOf(vertices: ReadonlyMap<string, LineVertex>, links: readonly Link[], flow: 'drain' | 'supply'): string[] {
  return componentsOf(vertices, links).flatMap((group) => {
    const ends = (end: RunEnd): string[] => group.filter((id) => vertices.get(id)?.end === end)
    const river = flow === 'drain' ? ends('river') : []
    if (river.length > 0) return river
    return [ends('edge')[0] ?? (group[0] as string)]
  })
}

/** Each vertex's next vertex toward its nearest root, by line length (ties by id). */
function shortestTree(roots: readonly string[], links: readonly Link[]): Map<string, string> {
  const distance = new Map(roots.map((root) => [root, 0]))
  const parent = new Map<string, string>()
  const done = new Set<string>()
  for (;;) {
    const open = [...distance.entries()].filter(([id]) => !done.has(id)).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))[0]
    if (open === undefined) return parent
    const [id, base] = open
    done.add(id)
    for (const link of links) {
      const [here, there] = link.a.vertex.id === id ? [link.a, link.b] : link.b.vertex.id === id ? [link.b, link.a] : [undefined, undefined]
      if (here === undefined || there === undefined || done.has(there.vertex.id)) continue
      const length = base + Math.abs(there.u - here.u)
      if (length >= (distance.get(there.vertex.id) ?? Number.POSITIVE_INFINITY)) continue
      distance.set(there.vertex.id, length)
      parent.set(there.vertex.id, id)
    }
  }
}
