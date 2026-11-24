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
function riverOf(rivers: readonly PlanLine[], x: number, z: number): { along: 'x' | 'z'; end: number } | undefined {
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
export function interceptorsOf(outlets: readonly LineVertex[], rivers: readonly PlanLine[], spacing: number): Interceptor {
  const lines = new Map<string, { along: 'x' | 'z'; at: number; end: number; outlets: LineVertex[] }>()
  for (const outlet of outlets) {
    const river = riverOf(rivers, outlet.x, outlet.z)
    if (river === undefined) continue
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
