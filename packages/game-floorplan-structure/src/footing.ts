import { densityOf } from './density'
import { loadsAtRest } from './loads'
import { GROUND } from './types'
import type { Rect, StructurePart, Support } from './types'

/** Side of the footing of a pillar on the soil, metres (NBR 6122: no footing under 60 cm), and how deep it is buried under the pillar's foot. */
export const FOOTING_SIDE = 0.6
export const FOOTING_DEPTH = 0.4
/** Allowable pressure on the soil by default, kPa (0.2 MPa: a firm clay or a compact sand, NBR 6122); `StructureOptions.soilPressure` sets another. */
export const ALLOWABLE_SOIL_PRESSURE = 200
/** The footing's own weight and the soil over it, as a share of what the pillar brings down (A ≥ 1.05 N_k / σ_adm). */
export const FOOTING_WEIGHT_FACTOR = 1.05
const GRAVITY = 9.81
const STEP = 0.05
const up = (metres: number): number => Math.ceil(metres / STEP - 1e-6) * STEP

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

/** The column a footing made by `footingDraft` carries, if `part` is one. */
export function footingColumnOf(part: StructurePart, supports: readonly Support[]): string | undefined {
  if (!part.id.startsWith('footing_pier_')) return undefined
  const column = part.id.slice('footing_pier_'.length)
  return supports.some((s) => s.part === column && s.on === part.id) ? column : undefined
}

/** Characteristic load a footing brings onto the soil from `column`, kN: what the column brings down, with the footing's own weight (`FOOTING_WEIGHT_FACTOR`). */
export const footingLoad = (loads: ReadonlyMap<string, number>, column: string): number => (FOOTING_WEIGHT_FACTOR * (loads.get(column) ?? 0) * GRAVITY) / 1000

/**
 * Each footing made by `footingDraft` sized by the load of its column on the soil: a square of area at least 1.05 N_k / σ_adm (`soilPressure`, kPa),
 * never under `FOOTING_SIDE` nor under its present size (`only`: just those footings; `loads`: the loads at rest to size by, default those of `structure`), and deep enough to be a rigid footing (NBR 6118 22.6.1: h ≥ (B - b_pillar) / 3), its top kept at the column's foot.
 */
export function sizeFootings(structure: { parts: StructurePart[]; supports: readonly Support[] }, sizing: { soilPressure?: number; only?: ReadonlySet<string>; loads?: ReadonlyMap<string, number> } = {}): void {
  const soilPressure = sizing.soilPressure ?? ALLOWABLE_SOIL_PRESSURE
  const byId = new Map(structure.parts.map((part) => [part.id, part]))
  const footings = structure.parts.flatMap((part) => {
    if (sizing.only && !sizing.only.has(part.id)) return []
    const column = footingColumnOf(part, structure.supports)
    const carried = column === undefined ? undefined : byId.get(column)
    return carried ? [{ part, column: carried }] : []
  })
  if (!footings.length) return
  const loads = sizing.loads ?? loadsAtRest(structure.parts, structure.supports)
  for (const { part, column } of footings) {
    const [du, dv] = [column.aabb[2] - column.aabb[0], column.aabb[3] - column.aabb[1]]
    // (never smaller than it already is: sized again by the loads of the framed slabs, it only grows)
    const side = up(Math.max(FOOTING_SIDE, part.aabb[2] - part.aabb[0] - 1e-6, Math.sqrt(footingLoad(loads, column.id) / soilPressure), du + 2 * FOOTING_RIM, dv + 2 * FOOTING_RIM))
    const depth = up(Math.max(FOOTING_DEPTH, (side - Math.min(du, dv)) / 3))
    const [u, v] = [(column.aabb[0] + column.aabb[2]) / 2, (column.aabb[1] + column.aabb[3]) / 2]
    part.aabb = [u - side / 2, v - side / 2, u + side / 2, v + side / 2].map((x) => Math.round(x * 1000) / 1000) as Rect
    part.y0 = Math.round((part.y1 - depth) * 1000) / 1000
    part.mass = Math.max(1, Math.round(side * side * depth * densityOf(part.material)))
  }
}
