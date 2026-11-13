import { GROUND } from './types'
import type { Rect, StructurePart, Support } from './types'

/** Side of the footing of a pillar on the soil, metres (NBR 6122: no footing under 60 cm), and how deep it is buried under the pillar's foot. */
export const FOOTING_SIDE = 0.6
export const FOOTING_DEPTH = 0.4
/** Footing beyond each face of the pillar it carries, metres. */
const FOOTING_RIM = 0.15

/** The draft of the footing (sapata isolada) under `column`: a pad of concrete buried under its foot, wide enough to spread its load on the soil. */
export function footingDraft(column: Pick<StructurePart, 'id' | 'aabb' | 'y0'>): { id: string; aabb: Rect; y0: number; y1: number } {
  const [u0, v0, u1, v1] = column.aabb
  const half = Math.max(FOOTING_SIDE, u1 - u0 + 2 * FOOTING_RIM, v1 - v0 + 2 * FOOTING_RIM) / 2
  const [u, v] = [(u0 + u1) / 2, (v0 + v1) / 2]
  return { id: `footing_pier_${column.id}`, aabb: [u - half, v - half, u + half, v + half], y0: column.y0 - FOOTING_DEPTH, y1: column.y0 }
}

const overlapsInPlan = (a: Rect, b: Rect): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]

/** Whether a strip footing runs under `box`: a ground beam or a wall standing on the soil there (the strip footing under it is not drawn). */
export function onStripFooting(box: Rect, structure: { parts: readonly StructurePart[]; supports: readonly Support[] }): boolean {
  const onSoil = new Set(structure.supports.filter((s) => s.on === GROUND && s.bears !== false).map((s) => s.part))
  return structure.parts.some((p) => onSoil.has(p.id) && (p.beamKind === 'ground_beam' || p.role === 'wall') && overlapsInPlan(p.aabb, box))
}
