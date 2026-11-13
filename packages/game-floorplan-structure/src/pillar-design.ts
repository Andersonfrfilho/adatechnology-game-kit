import { pillarLoadFactor } from './masonry-units/derive'
import type { Opening, Rect, StructurePart, Support } from './types'

/** Concrete C25 and steel CA-50 of the pillars (NBR 6118): design strengths, kPa. */
const FCD = 25e3 / 1.4
const FYD = 500e3 / 1.15
const GAMMA = 1.4
/** Cover to the centre of the bars, metres. */
const BAR_COVER = 0.04
/** NBR 6118 17.3.5.3.2: at most 4% of steel outside the laps. */
export const MAX_PILLAR_STEEL = 0.04
/** A practical cap on the axial load ratio ν = N_d / (A_c f_cd) of a pillar sized by the kit (its moments beyond the minimum are not computed). */
export const MAX_AXIAL_RATIO = 0.8
/** λ under which second-order effects are left out (NBR 6118 15.8.2, λ1 at its least). */
const LAMBDA_1 = 35

/** What a pillar asks of its section: the axial ratio, the design moment and the steel ratio it needs (NBR 6118 15.8.3.3.2, approximate curvature). */
export interface PillarDesign {
  readonly nu: number
  readonly moment: number
  readonly steel: number
  readonly lambda: number
}

/**
 * The design of a pillar of `section` (its two sides, metres) under a characteristic load `load` (kN), braced every `length` metres: N_d = 1.4 γn N_k, the
 * minimum eccentricity e1,min = 0.015 + 0.03 h about its weak axis, the second-order eccentricity of the approximate curvature past λ1, and the symmetric
 * steel the section then needs (a plastic rectangular section: concrete 0.85 f_cd over 0.8 x, the bars at f_yd).
 */
export function pillarDesign(section: readonly [number, number], load: number, length: number): PillarDesign {
  const h = Math.min(...section)
  const b = Math.max(...section)
  const area = h * b
  // (NBR 6118 13.2.3: a pillar under 19 cm takes its loads times γn = 1.95 − 0.05 b)
  const normal = GAMMA * pillarLoadFactor(h) * load
  const nu = normal / (area * FCD)
  const lambda = (length * Math.sqrt(12)) / h
  const e1 = 0.015 + 0.03 * h
  const curvature = Math.min(0.005 / (h * (nu + 0.5)), 0.005 / h)
  const e2 = lambda > LAMBDA_1 ? (length ** 2 / 10) * curvature : 0
  const moment = normal * (e1 + e2)
  // the compressed block that carries N_d (the bars on the two faces balance), and the bars that make up what the block's lever cannot
  const block = Math.min(h, normal / (0.85 * FCD * b))
  const axialSteel = Math.max(0, normal - 0.85 * FCD * area) / FYD
  const concreteMoment = 0.85 * FCD * b * block * (h - block) / 2
  const bendingSteel = (2 * Math.max(0, moment - concreteMoment)) / (FYD * (h - 2 * BAR_COVER))
  return { nu, moment, steel: (axialSteel + bendingSteel) / area, lambda }
}

/** Whether a design is within what the kit lets a pillar carry: ν within `MAX_AXIAL_RATIO` and the steel within `MAX_PILLAR_STEEL`. */
export const withinCapacity = (design: PillarDesign): boolean => design.nu <= MAX_AXIAL_RATIO && design.steel <= MAX_PILLAR_STEEL

/** The two sides of a pillar in plan, metres. */
export const sectionOf = (column: Pick<StructurePart, 'aabb'>): [number, number] => [column.aabb[2] - column.aabb[0], column.aabb[3] - column.aabb[1]]

/** The axial ratio a pillar sized by the kit is given (ν ≤ 0.6), leaving room for the moments of the beams framing into it that are not computed. */
const TARGET_AXIAL_RATIO = 0.6
const STEP = 0.05
const up = (metres: number): number => Math.ceil(metres / STEP - 1e-6) * STEP

/**
 * Each pillar of `ids` past its capacity sized by its load (in 5 cm steps) until ν ≤ 0.6 and its design is within capacity (`pillarDesign`), its centre kept:
 * along the wall it is cast in (`alongWall`), else across it, else its least side. `load` gives its characteristic load (kN) and `length` its braced length (m).
 */
export function sizePillars(
  parts: readonly StructurePart[],
  ids: ReadonlySet<string>,
  measure: {
    load: (column: StructurePart) => number
    length: (column: StructurePart) => number
    density: number
    alongWall?: (column: StructurePart) => { readonly axis: 'u' | 'v'; readonly box: Rect } | undefined
    /** Whether a pillar may stand over `box` (never in a doorway). */
    allowed?: (box: Rect, column: StructurePart) => boolean
  },
): void {
  for (const column of parts.filter((p) => ids.has(p.id) && p.role === 'column' && p.material === 'concrete')) {
    const [du, dv] = sectionOf(column)
    const load = measure.load(column)
    const length = measure.length(column)
    // (a pillar within capacity keeps its section; one past it grows until it has room for the moments not computed)
    if (withinCapacity(pillarDesign([du, dv], load, length))) continue
    const fits = (box: Rect): boolean => {
      const design = pillarDesign([box[2] - box[0], box[3] - box[1]], load, length)
      return design.nu <= TARGET_AXIAL_RATIO && withinCapacity(design) && (measure.allowed?.(box, column) ?? true)
    }
    const [u0, v0, u1, v1] = column.aabb
    // a pillar cast in a wall grows along it, as thick as it is (out of the wall it would stand proud of both faces), both ways about its centre (it still
    // confines the corner, end or junction it stands at) and within the wall
    const wall = measure.alongWall?.(column)
    const along = wall?.axis
    const inWall = (box: Rect): boolean =>
      !wall || (along === 'u' ? box[0] >= wall.box[0] - 0.01 && box[2] <= wall.box[2] + 0.01 : box[1] >= wall.box[1] - 0.01 && box[3] <= wall.box[3] + 0.01)
    let found: Rect | undefined
    for (let k = 1; along && k <= 40 && !found; k++) {
      const grow = k * STEP
      const box: Rect = along === 'u' ? [u0 - grow / 2, v0, u1 + grow / 2, v1] : [u0, v0 - grow / 2, u1, v1 + grow / 2]
      if (inWall(box) && fits(box)) found = box
    }
    // across the wall then (proud of its faces), its length along the wall kept
    for (let k = 1; along && k <= 20 && !found; k++) {
      const grow = k * STEP
      const box: Rect = along === 'u' ? [u0, v0 - grow / 2, u1, v1 + grow / 2] : [u0 - grow / 2, v0, u1 + grow / 2, v1]
      if (fits(box)) found = box
    }
    const [u, v] = [(u0 + u1) / 2, (v0 + v1) / 2]
    for (let least = up(Math.min(du, dv) + STEP); !found && least <= 1.2; least = up(least + STEP)) {
      const [su, sv] = du <= dv ? [least, Math.max(least, dv)] : [Math.max(least, du), least]
      const box: Rect = [u - su / 2, v - sv / 2, u + su / 2, v + sv / 2]
      if (fits(box)) found = box
    }
    if (!found) continue
    column.aabb = found.map((x) => Math.round(x * 1000) / 1000) as Rect
    column.mass = Math.max(1, Math.round((found[2] - found[0]) * (found[3] - found[1]) * (column.y1 - column.y0) * measure.density))
  }
}

/**
 * Longest stretch of `column` between the levels that brace it: its foot, its head and each slab or beam tied to it on the way (one storey of a pillar that
 * runs through slabs tied to it, NBR 6118 15.6). A slab it runs through untied braces nothing.
 */
export function bracedLength(column: StructurePart, structure: { readonly parts: readonly StructurePart[]; readonly supports: readonly Support[] }): number {
  const { byId, joined } = indexOf(structure)
  const tied = (joined.get(column.id) ?? []).map((id) => byId.get(id)).filter((p): p is StructurePart => p !== undefined && (p.role === 'slab' || p.role === 'beam'))
  const levels = [column.y0, column.y1, ...tied.map((p) => Math.min(Math.max((p.y0 + p.y1) / 2, column.y0), column.y1))].sort((a, b) => a - b)
  return levels.slice(1).reduce((most, y, k) => Math.max(most, y - levels[k]!), 0)
}

interface JointIndex {
  readonly byId: ReadonlyMap<string, StructurePart>
  /** The parts joined to each part by a support that bears, either way. */
  readonly joined: ReadonlyMap<string, readonly string[]>
}

const INDEXES = new WeakMap<readonly Support[], { parts: readonly StructurePart[]; count: number; index: JointIndex }>()

/** The parts by id and what each is joined to (built once per list of supports and parts: the pillars of a tower ask thousands of times). */
function indexOf(structure: { readonly parts: readonly StructurePart[]; readonly supports: readonly Support[] }): JointIndex {
  const cached = INDEXES.get(structure.supports)
  if (cached && cached.parts === structure.parts && cached.count === structure.supports.length) return cached.index
  const joined = new Map<string, string[]>()
  for (const s of structure.supports) {
    if (s.bears === false) continue
    joined.set(s.part, [...(joined.get(s.part) ?? []), s.on])
    joined.set(s.on, [...(joined.get(s.on) ?? []), s.part])
  }
  const index = { byId: new Map(structure.parts.map((part) => [part.id, part])), joined }
  INDEXES.set(structure.supports, { parts: structure.parts, count: structure.supports.length, index })
  return index
}

/** Characteristic load a pillar carries at its foot, kN: what flows onto it (`loadFlowsAtRest`) and its own weight. */
export const pillarLoad = (flows: ReadonlyMap<string, readonly { load: number }[]>, column: StructurePart): number =>
  (((flows.get(column.id) ?? []).reduce((sum, flow) => sum + flow.load, 0) + column.mass) * 9.81) / 1000

/** The axis and box of the wall `column` is cast in (its centre in the wall's plan box, over half its height), if any: the way it may grow. */
export function wallAxisOf(column: StructurePart, parts: readonly StructurePart[]): { readonly axis: 'u' | 'v'; readonly box: Rect } | undefined {
  const [u, v] = [(column.aabb[0] + column.aabb[2]) / 2, (column.aabb[1] + column.aabb[3]) / 2]
  const wall = parts.find(
    (p) => (p.role === 'wall' || p.role === 'partition') && p.id.startsWith('wall_') && u >= p.aabb[0] - 1e-3 && u <= p.aabb[2] + 1e-3 && v >= p.aabb[1] - 1e-3 && v <= p.aabb[3] + 1e-3 && Math.min(p.y1, column.y1) - Math.max(p.y0, column.y0) > (column.y1 - column.y0) / 2,
  )
  if (!wall) return undefined
  return { axis: wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1] ? 'u' : 'v', box: wall.aabb }
}

/**
 * Whether a pillar over `box` stays out of the doors and windows of its storey (`openings`, on the walls of `parts`): a pillar grown into a doorway would stand
 * in it. Height is left out: a pillar runs the whole storey.
 */
export function clearOfOpenings(structure: { readonly parts: readonly StructurePart[]; readonly openings: readonly Opening[] }): (box: Rect, column: StructurePart) => boolean {
  const byId = new Map(structure.parts.map((part) => [part.id, part]))
  const gaps = structure.openings.flatMap((opening) => {
    const wall = byId.get(opening.wall)
    if (!wall) return []
    const alongU = wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1]
    const gap: Rect = alongU ? [opening.from, wall.aabb[1], opening.to, wall.aabb[3]] : [wall.aabb[0], opening.from, wall.aabb[2], opening.to]
    return [{ floor: wall.floor, gap }]
  })
  // (and every doorway the masonry laid over a door spans, an inner door among them)
  for (const header of structure.parts) if (/^wall_\d+_over_/.test(header.id)) gaps.push({ floor: header.floor, gap: header.aabb })
  // (a jamb a few millimetres into the pillar it stands against is the joint, not a pillar in the opening)
  const MARGIN = 0.01
  return (box, column) => !gaps.some(({ floor, gap }) => floor === column.floor && box[0] < gap[2] - MARGIN && box[2] > gap[0] + MARGIN && box[1] < gap[3] - MARGIN && box[3] > gap[1] + MARGIN)
}
