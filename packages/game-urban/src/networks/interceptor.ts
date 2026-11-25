import type { PlanLine } from '../cities/types'
import { ordinal } from './frame'
import type { LineVertex } from './line-network'

/** A stretch of the interceptor, from upstream to downstream. */
export type InterceptorLink = { readonly from: string; readonly to: string }

export type Interceptor = {
  readonly nodes: ReadonlyArray<{ readonly id: string; readonly x: number; readonly z: number; readonly kind: 'manhole' | 'treatment' }>
  readonly links: readonly InterceptorLink[]
}

/** The river segment nearest a point, along x or z, and where it ends downstream (its last point). */
function riverOf({ rivers, x, z }: { readonly rivers: readonly PlanLine[]; readonly x: number; readonly z: number }): { along: 'x' | 'z'; end: number } | undefined {
  let best: { along: 'x' | 'z'; end: number; distance: number } | undefined
  for (const river of rivers) {
    const last = river.points[river.points.length - 1]
    const before = river.points[river.points.length - 2]
    if (last === undefined || before === undefined) continue
    const along = Math.abs(last[0] - before[0]) < 1e-9 ? 'z' : 'x'
    const distance = along === 'z' ? Math.abs(x - last[0]) : Math.abs(z - last[1])
    if (best === undefined || distance < best.distance) best = { along, end: along === 'z' ? last[1] : last[0], distance }
  }
  return best
}

/**
 * The interceptors along the river banks: the mains of each bank reach the bank at their outlets (`outlets`), and one interceptor per
 * bank line runs from the farthest upstream of them along the river to where it leaves the map, at a treatment node; manholes at most
 * `spacing` apart. Outlets on the same bank line join the same interceptor.
 */
export type InterceptorParams = {
  /** Where the mains leave their streets: the river ends, else the one end of a line with no river. */
  readonly outlets: readonly LineVertex[]
  readonly rivers: readonly PlanLine[]
  readonly spacing: number
  /** Half the map's width and depth. */
  readonly border: readonly [number, number]
}

export function interceptorsOf({ outlets, rivers, spacing, border }: InterceptorParams): Interceptor {
  const lines = new Map<string, { along: 'x' | 'z'; at: number; end: number; outlets: LineVertex[] }>()
  for (const outlet of outlets) {
    const river = outlet.end === 'river' ? riverOf({ rivers, x: outlet.x, z: outlet.z }) : undefined
    if (river === undefined) {
      const way = outlet.outward ?? [1, 0]
      const along = way[0] !== 0 ? 'x' : 'z'
      const end = way[0] !== 0 ? Math.max(Math.abs(outlet.x) + 1, border[0]) * Math.sign(way[0]) : Math.max(Math.abs(outlet.z) + 1, border[1]) * Math.sign(way[1])
      const at = along === 'x' ? outlet.z : outlet.x
      lines.set(`${along}:${at.toFixed(3)}:${outlet.id}`, { along: along === 'x' ? 'x' : 'z', at, end, outlets: [outlet] })
      continue
    }
    const at = river.along === 'z' ? outlet.x : outlet.z
    const key = `${river.along}:${at.toFixed(3)}`
    const line = lines.get(key) ?? { along: river.along, at, end: river.end, outlets: [] }
    line.outlets.push(outlet)
    lines.set(key, line)
  }
  const nodes: Array<Interceptor['nodes'][number]> = []
  const links: InterceptorLink[] = []
  ;[...lines.values()].forEach((line, lineIndex) => {
    const station = (vertex: { x: number; z: number }): number => (line.along === 'z' ? vertex.z : vertex.x)
    const downstream = (position: number): number => -Math.abs(line.end - position)
    const ordered = [...line.outlets].sort((a, b) => downstream(station(a)) - downstream(station(b)))
    const treatment = `sewer:treatment:${ordinal(lineIndex)}`
    const point = (position: number): { x: number; z: number } => (line.along === 'z' ? { x: line.at, z: position } : { x: position, z: line.at })
    nodes.push({ id: treatment, ...point(line.end), kind: 'treatment' })
    const stops = [...ordered.map((vertex) => ({ id: vertex.id, position: station(vertex) })), { id: treatment, position: line.end }]
    for (let index = 1; index < stops.length; index++) {
      const [from, to] = [stops[index - 1], stops[index]] as [{ id: string; position: number }, { id: string; position: number }]
      const parts = Math.max(1, Math.ceil(Math.abs(to.position - from.position) / spacing - 1e-9))
      let previous = from.id
      for (let part = 1; part < parts; part++) {
        const id = `sewer:interceptor:${ordinal(lineIndex)}:${ordinal(index - 1)}:${ordinal(part - 1)}`
        nodes.push({ id, ...point(from.position + ((to.position - from.position) * part) / parts), kind: 'manhole' })
        links.push({ from: previous, to: id })
        previous = id
      }
      links.push({ from: previous, to: to.id })
    }
  })
  return { nodes, links }
}
