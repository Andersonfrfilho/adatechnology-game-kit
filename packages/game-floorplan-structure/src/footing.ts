import { densityOf } from './density'
import { loadFlowsAtRest } from './loads'
import type { LoadFlow } from './loads'
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

/** Flows of load at rest onto each part (`loadFlowsAtRest`), kg. */
export type LoadFlows = ReadonlyMap<string, readonly LoadFlow[]>

const PEDESTAL_RATIO = 3

/**
 * Whether `part` is a footing: a concrete block on the soil that spreads what stands on it, one made by `footingDraft` or any concrete pedestal resting on the
 * ground (a porch's footings, a crawl space's piers: no taller than three times its least side).
 */
export function isFooting(part: StructurePart, supports: readonly Support[]): boolean {
  if (part.role !== 'column' || part.material !== 'concrete' || !supports.some((s) => s.part === part.id && s.on === GROUND && s.bears !== false)) return false
  const least = Math.min(part.aabb[2] - part.aabb[0], part.aabb[3] - part.aabb[1])
  return footingColumnOf(part, supports) !== undefined || part.y1 - part.y0 <= PEDESTAL_RATIO * least
}

/** Characteristic load a footing brings onto the soil, kN: what comes down onto it, with its own weight and the soil over it (`FOOTING_WEIGHT_FACTOR`). */
export const footingLoad = (flows: LoadFlows, footing: string): number =>
  (FOOTING_WEIGHT_FACTOR * (flows.get(footing) ?? []).reduce((sum, flow) => sum + flow.load, 0) * GRAVITY) / 1000

/**
 * Each footing (`isFooting`) sized by the load it brings onto the soil: a square of area at least 1.05 N_k / σ_adm (`soilPressure`, kPa), never under
 * `FOOTING_SIDE` nor under its present size, and deep enough to be a rigid footing (NBR 6118 22.6.1: h ≥ (B - b) / 3, b the least side of what stands on it),
 * its top kept where it is. `only`: just those footings; `flows`: the loads to size by (default those of `structure`).
 */
export function sizeFootings(structure: { parts: StructurePart[]; supports: readonly Support[] }, sizing: { soilPressure?: number; only?: ReadonlySet<string>; flows?: LoadFlows } = {}): void {
  const soilPressure = sizing.soilPressure ?? ALLOWABLE_SOIL_PRESSURE
  const footings = structure.parts.filter((part) => (!sizing.only || sizing.only.has(part.id)) && isFooting(part, structure.supports))
  if (!footings.length) return
  const flows = sizing.flows ?? loadFlowsAtRest(structure.parts, structure.supports).flows
  const byId = new Map(structure.parts.map((part) => [part.id, part]))
  for (const part of footings) {
    const standing = structure.supports.filter((s) => s.on === part.id && s.bears !== false).map((s) => byId.get(s.part)).filter((p): p is StructurePart => p?.role === 'column')
    const sides = standing.flatMap((p) => [p.aabb[2] - p.aabb[0], p.aabb[3] - p.aabb[1]])
    const widest = sides.length ? Math.max(...sides) : 0
    const side = up(Math.max(FOOTING_SIDE, part.aabb[2] - part.aabb[0] - 1e-6, part.aabb[3] - part.aabb[1] - 1e-6, Math.sqrt(footingLoad(flows, part.id) / soilPressure), widest + 2 * FOOTING_RIM))
    const least = sides.length ? Math.min(...sides) : 0
    // (never smaller than it already is: sized again by the loads of the framed slabs, it only grows)
    const depth = up(Math.max(FOOTING_DEPTH, part.y1 - part.y0 - 1e-6, (side - least) / 3))
    const [u, v] = [(part.aabb[0] + part.aabb[2]) / 2, (part.aabb[1] + part.aabb[3]) / 2]
    part.aabb = [u - side / 2, v - side / 2, u + side / 2, v + side / 2].map((x) => Math.round(x * 1000) / 1000) as Rect
    part.y0 = Math.round((part.y1 - depth) * 1000) / 1000
    part.mass = Math.max(1, Math.round(side * side * depth * densityOf(part.material)))
  }
}
