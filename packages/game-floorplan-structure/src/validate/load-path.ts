import { GROUND } from '../types'
import type { Structure, StructurePart, Support } from '../types'
import { BEAM_DEPTH_RATIO, MAX_LINTEL_ON_MASONRY, MIN_BEAM_WIDTH, MIN_PILLAR_AREA, MIN_PILLAR_SIDE, STRUCTURAL_VIOLATION } from './codes'
import type { StructuralViolation } from './codes'

/** A part this close above the top of what it rests on still rests on it (metres). */
const CONTACT = 0.05
const EPSILON = 0.005

/** The parts with a load path down to the ground over the supports that bear. */
export function groundedParts(parts: readonly StructurePart[], supports: readonly Support[]): Set<string> {
  const ids = new Set(parts.map((part) => part.id))
  const grounded = new Set<string>([GROUND])
  const bearing = supports.filter((s) => s.bears !== false && ids.has(s.part))
  let grew = true
  while (grew) {
    grew = false
    for (const support of bearing) {
      if (grounded.has(support.part) || !grounded.has(support.on)) continue
      grounded.add(support.part)
      grew = true
    }
  }
  return grounded
}

/** Every part with a load path to the ground, and every pillar standing on what it rests on. */
export function loadPathViolations(structure: Pick<Structure, 'parts' | 'supports'>): StructuralViolation[] {
  const { parts, supports } = structure
  const grounded = groundedParts(parts, supports)
  const byId = new Map(parts.map((part) => [part.id, part]))
  const out: StructuralViolation[] = []
  for (const part of parts) {
    if (part.role === 'none') continue
    const pillar = part.role === 'column'
    if (!grounded.has(part.id)) {
      out.push({ code: pillar ? STRUCTURAL_VIOLATION.PILLAR_NOT_GROUNDED : STRUCTURAL_VIOLATION.FLOATING_PART, part: part.id, message: `${part.id} has no load path to the ground` })
      continue
    }
    if (!pillar) continue
    const bases = supports.filter((s) => s.part === part.id && s.bears !== false)
    const standsOnBase = bases.some((s) => {
      if (s.on === GROUND) return part.y0 <= CONTACT
      const base = byId.get(s.on)
      return base !== undefined && part.y0 >= base.y0 - EPSILON && part.y0 <= base.y1 + CONTACT
    })
    if (!standsOnBase) out.push({ code: STRUCTURAL_VIOLATION.PILLAR_NOT_GROUNDED, part: part.id, message: `${part.id} starts at ${part.y0} m, above what it rests on` })
  }
  return out
}

const alongOf = (part: StructurePart): { alongU: boolean; from: number; to: number; width: number } => {
  const alongU = part.aabb[2] - part.aabb[0] >= part.aabb[3] - part.aabb[1]
  return alongU
    ? { alongU, from: part.aabb[0], to: part.aabb[2], width: part.aabb[3] - part.aabb[1] }
    : { alongU, from: part.aabb[1], to: part.aabb[3], width: part.aabb[2] - part.aabb[0] }
}

/** The along ranges of a beam where each of its bearing supports holds it. */
function bearingsOf(beam: StructurePart, supports: readonly Support[], byId: ReadonlyMap<string, StructurePart>): Bearing[] {
  const frame = alongOf(beam)
  return supports
    .filter((s) => s.part === beam.id && s.bears !== false && s.on !== GROUND)
    .map((s) => byId.get(s.on))
    .filter((on): on is StructurePart => on !== undefined)
    .map((on) => {
      const [low, high] = frame.alongU ? [on.aabb[0], on.aabb[2]] : [on.aabb[1], on.aabb[3]]
      return { on, from: Math.max(frame.from, low), to: Math.min(frame.to, high) }
    })
    .filter((bearing) => bearing.to - bearing.from > -EPSILON)
}

const isWallLike = (part: StructurePart): boolean => part.role === 'wall' || part.role === 'partition'
/** A plain concrete pedestal (a footing block under a post) may go without steel: no taller than three times its least side (ACI 318 14.3.3). */
const PEDESTAL_RATIO = 3
const isPedestal = (part: StructurePart): boolean => part.role === 'column' && part.y1 - part.y0 <= PEDESTAL_RATIO * Math.min(part.aabb[2] - part.aabb[0], part.aabb[3] - part.aabb[1])

/**
 * Concrete pillars and beams against NBR 6118: the minimum sections (13.2.2, 13.2.3), the steel of a reinforced member, a beam between point supports at
 * least a tenth of its span deep, and no long beam that only masonry carries.
 */
export function concreteViolations(structure: Pick<Structure, 'parts' | 'supports' | 'construction'>, isMasonry: (part: StructurePart) => boolean): StructuralViolation[] {
  const { parts, supports } = structure
  const byId = new Map(parts.map((part) => [part.id, part]))
  const out: StructuralViolation[] = []
  for (const part of parts) {
    if (part.material !== 'concrete' || (part.role !== 'column' && part.role !== 'beam')) continue
    if (!structure.construction.frame.rebar && !isPedestal(part)) out.push({ code: STRUCTURAL_VIOLATION.UNREINFORCED_CONCRETE, part: part.id, message: `${part.id} is concrete without steel` })
    if (part.role === 'column') {
      const sides = [part.aabb[2] - part.aabb[0], part.aabb[3] - part.aabb[1]]
      if (Math.min(...sides) < MIN_PILLAR_SIDE - EPSILON || sides[0]! * sides[1]! < MIN_PILLAR_AREA - EPSILON)
        out.push({ code: STRUCTURAL_VIOLATION.CONCRETE_BELOW_MIN_SECTION, part: part.id, message: `${part.id} is ${sides.map((s) => s.toFixed(2)).join(' x ')} m: NBR 6118 asks at least ${MIN_PILLAR_SIDE} m a side and ${MIN_PILLAR_AREA} m²` })
      continue
    }
    const castOn = supports
      .filter((s) => s.on === part.id && s.bears !== false)
      .map((s) => byId.get(s.part))
      .filter((top): top is StructurePart => top !== undefined && top.role === 'beam' && top.material === 'concrete' && Math.abs(top.y0 - part.y1) < 0.01)
      .reduce((most, top) => Math.max(most, top.y1 - top.y0), 0)
    out.push(...beamViolations(part, bearingsOf(part, supports, byId), { isMasonry, castOn }))
  }
  return out
}

/** Longest effective span between the bearings of a beam: the clear span plus, at each end, half the bearing up to 0.3 of the depth (NBR 6118 14.6.2.4). */
function effectiveSpan(bearings: readonly { from: number; to: number }[], depth: number): number {
  const sorted = [...bearings].sort((a, b) => a.from - b.from)
  let most = 0
  for (let k = 1; k < sorted.length; k++) {
    const previous = sorted.slice(0, k).reduce((a, b) => (b.to > a.to ? b : a))
    const next = sorted[k]!
    const clear = next.from - previous.to
    if (clear <= 0) continue
    most = Math.max(most, clear + Math.min((previous.to - previous.from) / 2, 0.3 * depth) + Math.min((next.to - next.from) / 2, 0.3 * depth))
  }
  return most
}

interface Bearing {
  on: StructurePart
  from: number
  to: number
}

function beamViolations(beam: StructurePart, bearings: readonly Bearing[], context: { isMasonry: (part: StructurePart) => boolean; castOn: number }): StructuralViolation[] {
  const out: StructuralViolation[] = []
  const frame = alongOf(beam)
  const length = frame.to - frame.from
  // a beam cast together with the one on it (a lintel under the bond beam) works as one section
  const depth = beam.y1 - beam.y0 + context.castOn
  if (frame.width < MIN_BEAM_WIDTH - EPSILON) out.push({ code: STRUCTURAL_VIOLATION.CONCRETE_BELOW_MIN_SECTION, part: beam.id, message: `${beam.id} is ${frame.width.toFixed(2)} m wide: NBR 6118 asks at least ${MIN_BEAM_WIDTH} m` })
  if (!bearings.length) return out
  const continuous = bearings.some((b) => isWallLike(b.on) && b.to - b.from >= length / 2)
  const span = continuous ? 0 : effectiveSpan(bearings, depth)
  if (depth < span / BEAM_DEPTH_RATIO - EPSILON) out.push({ code: STRUCTURAL_VIOLATION.CONCRETE_BELOW_MIN_SECTION, part: beam.id, message: `${beam.id} is ${depth.toFixed(2)} m deep over a ${span.toFixed(2)} m span: it needs at least L/${BEAM_DEPTH_RATIO} = ${(span / BEAM_DEPTH_RATIO).toFixed(2)} m` })
  if (length > MAX_LINTEL_ON_MASONRY && bearings.every((b) => context.isMasonry(b.on)))
    out.push({ code: STRUCTURAL_VIOLATION.BEAM_ON_WEAK_MASONRY, part: beam.id, message: `${beam.id} spans ${length.toFixed(2)} m on masonry alone: no pillar carries it` })
  return out
}
