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
    const bearings = bearingsOf(part, supports, byId)
    out.push(...beamViolations(part, bearings, { isMasonry, castOn }))
    // a beam framing into another hangs from it: the one it frames into is at least as deep (a lintel cast under a bond beam is the bond beam's own section)
    for (const { on } of bearings) {
      // (a bond beam on its wall is held all along by the masonry under it: only one that spans takes the beam as a point load)
      if (on.role !== 'beam' || on.material !== 'concrete' || on.y1 < part.y1 - 0.01 || castOn > 0 || (on.beamKind === 'bond_beam' && !spansAt(on, part, byId, supports))) continue
      if (sectionDepthAt(on, part.aabb, structure.parts) < depthToHold(on, part) - 0.01)
        out.push({ code: STRUCTURAL_VIOLATION.BEAM_ON_SHALLOWER_BEAM, part: part.id, message: `${part.id} (bottom at ${part.y0.toFixed(2)} m) rests on ${on.id}, whose section ends at ${(on.y1 - sectionDepthAt(on, part.aabb, structure.parts)).toFixed(2)} m` })
    }
  }
  return out
}

/**
 * How deep the section of `host` has to reach under its top to take `beam` framed into it (NBR 6118 18.3.7, indirect support): down to the bottom of
 * `beam`, so the supported beam never hangs under the one that carries it. A bond beam level with the slab's top takes a beam cast under the slab: it
 * reaches past the beam's own depth by the slab.
 */
export const depthToHold = (host: StructurePart, beam: StructurePart): number => host.y1 - beam.y0

/**
 * Depth of the concrete section `beam` makes over the plan box `at`: its own and that of the beams cast under it there (a bond beam over an opening and the
 * lintel under it work as one beam).
 */
export function sectionDepthAt(beam: StructurePart, at: readonly number[], parts: readonly StructurePart[]): number {
  let bottom = beam.y0
  for (let found = true; found; ) {
    found = false
    for (const under of parts) {
      if (under === beam || under.role !== 'beam' || under.material !== beam.material || Math.abs(under.y1 - bottom) > 0.01) continue
      if (under.aabb[0] >= at[2]! || under.aabb[2] <= at[0]! || under.aabb[1] >= at[3]! || under.aabb[3] <= at[1]!) continue
      bottom = under.y0
      found = true
    }
  }
  return beam.y1 - bottom
}

/** Whether `host` spans where `part` rests on it: no wall or pillar under it there (a bond beam over an opening). */
function spansAt(host: StructurePart, part: StructurePart, byId: ReadonlyMap<string, StructurePart>, supports: readonly Support[]): boolean {
  const [u0, v0, u1, v1] = part.aabb
  return !supports.some((s) => {
    if (s.part !== host.id || s.bears === false) return false
    const under = byId.get(s.on)
    if (!under || (under.role !== 'wall' && under.role !== 'column')) return false
    return under.aabb[0] < u1 && under.aabb[2] > u0 && under.aabb[1] < v1 && under.aabb[3] > v0
  })
}

/** The span a beam on `bearings` is sized for: none on a wall under half its length or more (it rests on it all along), else its effective span. */
const spanToCarry = (bearings: readonly Bearing[], length: number, depth: number): number =>
  bearings.some((b) => isWallLike(b.on) && b.to - b.from >= length / 2) ? 0 : effectiveSpan(bearings, depth)

/**
 * The least depth `beam` needs on the supports `structure` gives it (a tenth of its effective span, NBR 6118 14.6.2.4), counting a beam cast on it: what the
 * validator asks of it, for a builder to size it with.
 */
export function depthToCarry(beam: StructurePart, structure: Pick<Structure, 'parts' | 'supports'>, step = 0.05): number {
  const byId = new Map(structure.parts.map((part) => [part.id, part]))
  const castOn = structure.supports
    .filter((s) => s.on === beam.id && s.bears !== false)
    .map((s) => byId.get(s.part))
    .filter((top): top is StructurePart => top !== undefined && top.role === 'beam' && top.material === 'concrete' && Math.abs(top.y0 - beam.y1) < 0.01)
    .reduce((most, top) => Math.max(most, top.y1 - top.y0), 0)
  const frame = alongOf(beam)
  const bearings = bearingsOf(beam, structure.supports, byId)
  let depth = beam.y1 - beam.y0
  while (depth + castOn < spanToCarry(bearings, frame.to - frame.from, depth + castOn) / BEAM_DEPTH_RATIO - EPSILON) depth = Math.round((depth + step) * 100) / 100
  return depth
}

/** Longest effective span between the bearings of a beam: the clear span plus, at each end, half the bearing up to 0.3 of the depth (NBR 6118 14.6.2.4). */
export function effectiveSpan(bearings: readonly { from: number; to: number }[], depth: number): number {
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
  const span = spanToCarry(bearings, length, depth)
  if (depth < span / BEAM_DEPTH_RATIO - EPSILON) out.push({ code: STRUCTURAL_VIOLATION.CONCRETE_BELOW_MIN_SECTION, part: beam.id, message: `${beam.id} is ${depth.toFixed(2)} m deep over a ${span.toFixed(2)} m span: it needs at least L/${BEAM_DEPTH_RATIO} = ${(span / BEAM_DEPTH_RATIO).toFixed(2)} m` })
  if (length > MAX_LINTEL_ON_MASONRY && bearings.every((b) => context.isMasonry(b.on)))
    out.push({ code: STRUCTURAL_VIOLATION.BEAM_ON_WEAK_MASONRY, part: beam.id, message: `${beam.id} spans ${length.toFixed(2)} m on masonry alone: no pillar carries it` })
  return out
}
