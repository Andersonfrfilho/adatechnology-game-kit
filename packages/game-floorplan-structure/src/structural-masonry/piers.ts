import type { LoadFlow } from '../loads'
import type { StructurePart } from '../types'

/** A stretch of a bearing wall between its windows (or the whole wall), along the wall's centre line, and the length of wall whose load comes down it. */
export interface Pier {
  readonly from: number
  readonly to: number
  /** The pier and half of each window beside it, metres: the lintel over a window passes half the load over it to each jamb. */
  readonly tributary: number
}

/** A pier with the characteristic loads it carries, kg: at its top (what rests on the wall) and its own weight. */
export interface LoadedPier extends Pier {
  readonly top: number
  readonly own: number
  /** kg of what bears on one face of the wall only, signed by the face (a slab on one side, a beam ending on the wall): loads on both faces cancel. */
  readonly oneSided: number
}

/** The piers of a wall from `from` to `to` cut by its windows (`[from, to]` along the wall). */
export function piersOf(from: number, to: number, windows: readonly (readonly [number, number])[]): Pier[] {
  const sorted = [...windows].filter(([a, b]) => b > from && a < to).sort((x, y) => x[0] - y[0])
  const out: Pier[] = []
  let cursor = from
  sorted.forEach(([a, b], k) => {
    if (a > cursor) out.push({ from: cursor, to: a, tributary: a - cursor + (k > 0 ? (sorted[k - 1]![1] - sorted[k - 1]![0]) / 2 : 0) + (b - a) / 2 })
    cursor = Math.max(cursor, b)
  })
  const last = sorted[sorted.length - 1]
  if (to > cursor) out.push({ from: cursor, to, tributary: to - cursor + (last ? (last[1] - last[0]) / 2 : 0) })
  return out
}

interface PierLoadParams {
  readonly wall: StructurePart
  readonly alongU: boolean
  readonly piers: readonly Pier[]
  readonly flows: readonly LoadFlow[]
  readonly parts: ReadonlyMap<string, StructurePart>
  /** Parts that bear on the wall at a point (a lintel at a jamb, a beam across it): their load goes down the pier under them, not spread. */
  readonly concentrated: (part: StructurePart) => boolean
  /** -1 or +1 for what bears on one face of the wall (a slab, a beam ending on it), the share of it so for a bond beam carrying slabs, 0 for a centred load. */
  readonly sided: (part: StructurePart) => number
}

const alongOf = (part: StructurePart, alongU: boolean): number => (alongU ? (part.aabb[0] + part.aabb[2]) / 2 : (part.aabb[1] + part.aabb[3]) / 2)

/**
 * The loads of each pier: the point loads (lintels, beams across) on the pier under them (the nearest when they fall over a window), the rest spread by
 * tributary length, and the wall's own weight by the pier's length.
 */
export function loadPiers(params: PierLoadParams): LoadedPier[] {
  const { piers, flows } = params
  const total = piers.reduce((sum, pier) => sum + pier.tributary, 0)
  const length = piers.reduce((sum, pier) => sum + pier.to - pier.from, 0)
  const top = piers.map(() => 0)
  const moment = piers.map(() => 0)
  for (const flow of flows) {
    const part = params.parts.get(flow.from)
    if (!part) continue
    const side = params.sided(part)
    if (params.concentrated(part)) {
      // on the pier under it, or shared by the two jambs of the window it spans
      const at = alongOf(part, params.alongU)
      const distance = piers.map((pier) => Math.max(0, pier.from - at, at - pier.to))
      const nearest = Math.min(...distance)
      const under = piers.flatMap((_, k) => (distance[k]! <= nearest + 1e-3 ? [k] : []))
      for (const k of under) {
        top[k] = top[k]! + flow.load / under.length
        moment[k] = moment[k]! + (side * flow.load) / under.length
      }
      continue
    }
    piers.forEach((pier, k) => {
      const share = (flow.load * pier.tributary) / total
      top[k] = top[k]! + share
      moment[k] = moment[k]! + side * share
    })
  }
  return piers.map((pier, k) => ({ ...pier, top: top[k]!, own: (params.wall.mass * (pier.to - pier.from)) / Math.max(1e-6, length), oneSided: moment[k]! }))
}
