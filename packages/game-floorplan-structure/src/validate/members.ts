import { onStripFooting } from '../footing'
import { GROUND } from '../types'
import type { Structure, StructurePart, Support } from '../types'
import { isMasonryWall } from './masonry'
import { isPedestal } from './load-path'
import { MAX_COLUMN_SLENDERNESS, STRUCTURAL_VIOLATION } from './codes'
import type { StructuralViolation } from './codes'

/** How far two parts may share a volume at a joint and still be two parts that meet (a bar's cover, the bed of a bearing), metres in each direction. */
const JOINT = 0.03
const EPSILON = 0.005

const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.min(a1, b1) - Math.max(a0, b0)
const inPlan = (a: StructurePart, b: StructurePart, by = EPSILON): boolean => overlap(a.aabb[0], a.aabb[2], b.aabb[0], b.aabb[2]) > by && overlap(a.aabb[1], a.aabb[3], b.aabb[1], b.aabb[3]) > by
const leastSide = (part: StructurePart): number => Math.min(part.aabb[2] - part.aabb[0], part.aabb[3] - part.aabb[1])
const isConcreteColumn = (part: StructurePart): boolean => part.role === 'column' && part.material === 'concrete' && !isPedestal(part)

/** A pillar cast in a masonry wall (confined masonry): the wall it is cast against holds it all along its height. */
const inWall = (column: StructurePart, parts: readonly StructurePart[]): boolean =>
  parts.some((p) => isMasonryWall(p) && inPlan(p, column) && overlap(p.y0, p.y1, column.y0, column.y1) >= (column.y1 - column.y0) / 2)

/**
 * Longest stretch of `column` between the levels that brace it: its foot, its head and each slab or beam tied to it on the way (one storey of a pillar that
 * runs through slabs tied to it, NBR 6118 15.6). A slab it runs through untied braces nothing.
 */
export function bracedLength(column: StructurePart, structure: Pick<Structure, 'parts' | 'supports'>): number {
  const byId = new Map(structure.parts.map((part) => [part.id, part]))
  const tied = structure.supports
    .filter((s) => s.bears !== false && (s.part === column.id || s.on === column.id))
    .map((s) => byId.get(s.part === column.id ? s.on : s.part))
    .filter((p): p is StructurePart => p !== undefined && (p.role === 'slab' || p.role === 'beam'))
  const levels = [column.y0, column.y1, ...tied.map((p) => Math.min(Math.max((p.y0 + p.y1) / 2, column.y0), column.y1))].sort((a, b) => a - b)
  return levels.slice(1).reduce((most, y, k) => Math.max(most, y - levels[k]!), 0)
}

/** Free concrete pillars no slenderer than NBR 6118 allows without second-order analysis: λ = l_e √12 / b over their longest braced stretch. */
function slendernessViolations(structure: Pick<Structure, 'parts' | 'supports'>): StructuralViolation[] {
  const out: StructuralViolation[] = []
  for (const column of structure.parts.filter(isConcreteColumn)) {
    if (inWall(column, structure.parts)) continue
    const length = bracedLength(column, structure)
    const lambda = (length * Math.sqrt(12)) / leastSide(column)
    if (lambda > MAX_COLUMN_SLENDERNESS + EPSILON)
      out.push({ code: STRUCTURAL_VIOLATION.COLUMN_TOO_SLENDER, part: column.id, message: `${column.id} runs ${length.toFixed(2)} m unbraced on a ${leastSide(column).toFixed(2)} m side: λ ${lambda.toFixed(0)} passes ${MAX_COLUMN_SLENDERNESS} (NBR 6118 15.8)` })
  }
  return out
}

/**
 * A concrete pillar standing on the soil stands on a foundation: its own footing (a pedestal under it), or the strip footing under a ground beam or a wall it
 * stands in. On the bare soil, nothing spreads its load.
 */
function foundationViolations(structure: Pick<Structure, 'parts' | 'supports'>): StructuralViolation[] {
  const onSoil = new Set(structure.supports.filter((s) => s.on === GROUND && s.bears !== false).map((s) => s.part))
  return structure.parts
    .filter((p) => isConcreteColumn(p) && onSoil.has(p.id) && !onStripFooting(p.aabb, structure))
    .map((p) => ({ code: STRUCTURAL_VIOLATION.PILLAR_WITHOUT_FOUNDATION, part: p.id, message: `${p.id} stands on the soil with no footing under it` }))
}

/** A beam held at one point only turns about it (a mechanism): it needs two supports, or a bearing along its length. */
function singleSupportViolations(structure: Pick<Structure, 'parts' | 'supports'>): StructuralViolation[] {
  const byId = new Map(structure.parts.map((part) => [part.id, part]))
  const out: StructuralViolation[] = []
  for (const beam of structure.parts.filter((p) => p.role === 'beam' && p.material === 'concrete')) {
    const supports = structure.supports.filter((s: Support) => s.part === beam.id && s.bears !== false)
    if (supports.length !== 1 || supports[0]!.on === GROUND) continue
    const on = byId.get(supports[0]!.on)
    if (!on) continue
    const alongU = beam.aabb[2] - beam.aabb[0] >= beam.aabb[3] - beam.aabb[1]
    const held = alongU ? overlap(beam.aabb[0], beam.aabb[2], on.aabb[0], on.aabb[2]) : overlap(beam.aabb[1], beam.aabb[3], on.aabb[1], on.aabb[3])
    const length = alongU ? beam.aabb[2] - beam.aabb[0] : beam.aabb[3] - beam.aabb[1]
    if (held < length / 2)
      out.push({ code: STRUCTURAL_VIOLATION.BEAM_SINGLE_SUPPORT, part: beam.id, message: `${beam.id} rests on ${on.id} alone, over ${Math.max(0, held).toFixed(2)} of its ${length.toFixed(2)} m: it needs a second support` })
  }
  return out
}

/** The long plan axis of a linear member (a beam, a wall), its width across it; none for a part as wide as long (a slab, a pillar). */
function axisOf(part: StructurePart): { alongU: boolean; width: number } | undefined {
  const du = part.aabb[2] - part.aabb[0]
  const dv = part.aabb[3] - part.aabb[1]
  if (Math.max(du, dv) < 2 * Math.min(du, dv)) return undefined
  return { alongU: du >= dv, width: Math.min(du, dv) }
}

const isFrame = (part: StructurePart): boolean => part.role === 'beam' && part.unit === undefined

/**
 * A beam laid on the line of another linear member it is not joined to, the two in the same volume beyond a joint: one is built through the other (an eave
 * beam run into the masonry over a door, two beams cast into each other end to end with no bearing). Members that cross meet at a node, and masonry laid on
 * one line is one masonry: those are no overlap.
 */
function overlapViolations(structure: Pick<Structure, 'parts' | 'supports'>): StructuralViolation[] {
  const joined = new Set(structure.supports.flatMap((s) => [`${s.part}|${s.on}`, `${s.on}|${s.part}`]))
  const linear = structure.parts.filter((p) => (isFrame(p) || p.role === 'wall' || p.role === 'partition') && p.unit === undefined && axisOf(p) !== undefined)
  const out: StructuralViolation[] = []
  const byId = new Map(structure.parts.map((part) => [part.id, part]))
  const onPillars = (part: StructurePart): boolean => {
    const under = structure.supports.filter((s) => s.part === part.id && s.bears !== false).map((s) => byId.get(s.on))
    return under.length > 0 && under.every((p) => p?.role === 'column')
  }
  for (const a of linear.filter((p) => isFrame(p) && onPillars(p))) {
    const axis = axisOf(a)!
    for (const b of linear) {
      if (b === a || a.host === b.id || b.host === a.id || joined.has(`${a.id}|${b.id}`)) continue
      if (axisOf(b)!.alongU !== axis.alongU || !inPlan(a, b, JOINT) || overlap(a.y0, a.y1, b.y0, b.y1) <= JOINT) continue
      // (two members of one line meet end to end over their width: their boxes run past the end of their centre lines by half of it)
      const along = axis.alongU ? overlap(a.aabb[0], a.aabb[2], b.aabb[0], b.aabb[2]) : overlap(a.aabb[1], a.aabb[3], b.aabb[1], b.aabb[3])
      if (along <= Math.max(axis.width, axisOf(b)!.width) + JOINT) continue
      out.push({ code: STRUCTURAL_VIOLATION.OVERLAPPING_PARTS, part: a.id, message: `${a.id} runs ${along.toFixed(2)} m into ${b.id} along their line, not joined to it: the two occupy the same volume` })
    }
  }
  return out
}

/**
 * The members as members: free pillars braced within NBR 6118 slenderness and standing on a foundation, beams on two supports (`framed`: the house with its
 * slabs cut into panels on their beams), and no beam between pillars built through a member of its line (`built`, before the slabs are framed).
 */
export function memberViolations(framed: Pick<Structure, 'parts' | 'supports'>, built: Pick<Structure, 'parts' | 'supports'>): StructuralViolation[] {
  return [...slendernessViolations(framed), ...foundationViolations(framed), ...singleSupportViolations(framed), ...overlapViolations(built)]
}
