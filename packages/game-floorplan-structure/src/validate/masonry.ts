import { getAssembly } from '@adatechnology/game-destruction'

import { GROUND } from '../types'
import type { Structure, StructurePart } from '../types'
import { MAX_PILLAR_SPACING, STRUCTURAL_VIOLATION } from './codes'
import type { StructuralViolation } from './codes'

const TOLERANCE = 0.05
/** A pillar this close (along the wall) to a corner, an end or a junction stands there (`WALL_PILLAR_SIDE` plus the merge distance of `addWallPillars`). */
const AT_POINT = 0.45
const EXPOSED_FINISHES: readonly string[] = ['exposed_brick', 'exposed_block']

/** A wall of the plan as a line: its axis, the line across, where its centre line starts and ends, its half thickness. */
export interface WallLine {
  part: StructurePart
  alongU: boolean
  line: number
  from: number
  to: number
  half: number
}

export const lineOf = (part: StructurePart): WallLine => {
  const alongU = part.aabb[2] - part.aabb[0] >= part.aabb[3] - part.aabb[1]
  const half = (alongU ? part.aabb[3] - part.aabb[1] : part.aabb[2] - part.aabb[0]) / 2
  const [from, to] = alongU ? [part.aabb[0], part.aabb[2]] : [part.aabb[1], part.aabb[3]]
  return { part, alongU, line: alongU ? part.aabb[1] + half : part.aabb[0] + half, from: from + half, to: to - half, half }
}

/** A wall laid in bricks or blocks with mortar (not a concrete wall, not timber). */
/**
 * Masonry laid on a lintel, between it and the bond beam (over a door, the encunhamento): confined by the walls at its sides and the bond beam on it, it is no
 * free wall and has no pillars of its own.
 */
export const isOverOpening = (part: StructurePart, structure: Pick<Structure, 'supports'>): boolean =>
  structure.supports.some((s) => s.part === part.id && s.on.startsWith('lintel_'))

export function isMasonryWall(part: StructurePart): boolean {
  if (!part.id.startsWith('wall_') || !part.assembly || (part.role !== 'wall' && part.role !== 'partition')) return false
  const units = getAssembly(part.assembly)?.units
  return units !== undefined && units.mortar !== 'concrete'
}

const pointOf = (wall: WallLine, along: number): [number, number] => (wall.alongU ? [along, wall.line] : [wall.line, along])
const alongOfPoint = (wall: WallLine, point: readonly [number, number]): number => (wall.alongU ? point[0] : point[1])
const acrossOfPoint = (wall: WallLine, point: readonly [number, number]): number => (wall.alongU ? point[1] : point[0])
const centre = (part: StructurePart): [number, number] => [(part.aabb[0] + part.aabb[2]) / 2, (part.aabb[1] + part.aabb[3]) / 2]
const onLine = (wall: WallLine, point: readonly [number, number], slack = 0): boolean =>
  Math.abs(acrossOfPoint(wall, point) - wall.line) <= wall.half + TOLERANCE && alongOfPoint(wall, point) >= wall.from - wall.half - slack && alongOfPoint(wall, point) <= wall.to + wall.half + slack

/** What the end of a wall meets: another wall end at a corner, the side of another wall (a T), the next wall on the same line, or nothing (a free end, a door jamb). */
function endKind(wall: WallLine, along: number, others: readonly WallLine[]): 'corner' | 'junction' | 'continued' | 'free' {
  const point = pointOf(wall, along)
  const meeting = others.filter((other) => onLine(other, point))
  const across = meeting.filter((other) => other.alongU !== wall.alongU)
  const continued = meeting.length > across.length
  if (!across.length) return continued ? 'continued' : 'free'
  // the side of a wall that the line goes on through, or that meets it in its length, is a junction; two ends alone are a corner
  const atEnd = (other: WallLine): boolean => Math.min(Math.abs(alongOfPoint(other, point) - other.from), Math.abs(alongOfPoint(other, point) - other.to)) <= other.half + wall.half + TOLERANCE
  return !continued && across.every(atEnd) ? 'corner' : 'junction'
}

interface WallContext {
  wall: WallLine
  pillars: StructurePart[]
  stations: number[]
  /** Along ranges of the windows in the wall (no masonry to confine there). */
  windows: [number, number][]
}

/** Metres of masonry between two points along a wall: the distance less the windows between them. */
const masonryBetween = (from: number, to: number, windows: readonly [number, number][]): number =>
  windows.reduce((left, [a, b]) => left - Math.max(0, Math.min(to, b) - Math.max(from, a)), to - from)

function pointViolations(context: WallContext, others: readonly WallLine[]): StructuralViolation[] {
  const { wall, stations } = context
  const out: StructuralViolation[] = []
  const covered = (along: number): boolean => stations.some((at) => Math.abs(at - along) <= AT_POINT)
  for (const along of [wall.from, wall.to]) {
    const kind = endKind(wall, along, others)
    if (kind === 'continued' || covered(along)) continue
    const code = kind === 'corner' ? STRUCTURAL_VIOLATION.CORNER_WITHOUT_PILLAR : kind === 'junction' ? STRUCTURAL_VIOLATION.WALL_JUNCTION_WITHOUT_PILLAR : STRUCTURAL_VIOLATION.WALL_END_WITHOUT_PILLAR
    out.push({ code, part: wall.part.id, message: `${wall.part.id} has no pillar at its ${kind} end (${along.toFixed(2)} m along)` })
  }
  for (const other of others) {
    if (other.alongU === wall.alongU) continue
    for (const end of [other.from, other.to]) {
      const point = pointOf(other, end)
      const at = alongOfPoint(wall, point)
      if (!onLine(wall, point) || at <= wall.from + AT_POINT || at >= wall.to - AT_POINT || covered(at)) continue
      out.push({ code: STRUCTURAL_VIOLATION.WALL_JUNCTION_WITHOUT_PILLAR, part: wall.part.id, message: `${other.part.id} meets ${wall.part.id} at ${at.toFixed(2)} m along with no pillar there` })
    }
  }
  const line = [...stations].sort((a, b) => a - b)
  for (let k = 1; k < line.length; k++) {
    const gap = masonryBetween(line[k - 1]!, line[k]!, context.windows)
    if (gap > MAX_PILLAR_SPACING + TOLERANCE) out.push({ code: STRUCTURAL_VIOLATION.WALL_SPAN_WITHOUT_PILLAR, part: wall.part.id, message: `${wall.part.id} runs ${gap.toFixed(2)} m between pillars (at most ${MAX_PILLAR_SPACING} m)` })
  }
  if (!line.length && wall.to - wall.from > MAX_PILLAR_SPACING) out.push({ code: STRUCTURAL_VIOLATION.WALL_SPAN_WITHOUT_PILLAR, part: wall.part.id, message: `${wall.part.id} runs ${(wall.to - wall.from).toFixed(2)} m with no pillar` })
  return out
}

function bondBeamViolations(context: WallContext, structure: Pick<Structure, 'parts' | 'supports'>): StructuralViolation[] {
  const { wall, pillars } = context
  const resting = new Set(structure.supports.filter((s) => s.on === wall.part.id).map((s) => s.part))
  const beams = structure.parts.filter((p) => p.beamKind === 'bond_beam' && resting.has(p.id))
  if (!beams.length) return [{ code: STRUCTURAL_VIOLATION.MISSING_BOND_BEAM, part: wall.part.id, message: `${wall.part.id} has no bond beam on top` }]
  const out: StructuralViolation[] = []
  for (const pillar of pillars) {
    // the beam is over the pillar where their plan boxes overlap (a long pillar at a wall's end carries the beam over part of its length)
    const [p0, q0, p1, q1] = pillar.aabb
    const over = beams.filter((b) => Math.min(p1, b.aabb[2]) - Math.max(p0, b.aabb[0]) > TOLERANCE && Math.min(q1, b.aabb[3]) - Math.max(q0, b.aabb[1]) > TOLERANCE)
    const carries = over.some((b) => pillar.y1 >= b.y0 - TOLERANCE && structure.supports.some((s) => s.part === b.id && s.on === pillar.id && s.bears !== false))
    if (!carries) out.push({ code: STRUCTURAL_VIOLATION.PILLAR_DOES_NOT_REACH_BOND_BEAM, part: pillar.id, message: `${pillar.id} stops at ${pillar.y1} m and does not carry the bond beam of ${wall.part.id}` })
  }
  return out
}

/** The units and coats of a masonry wall: a running bond, and plaster on both faces of a plastered brick wall. */
function assemblyViolations(part: StructurePart, finish: string | undefined): StructuralViolation[] {
  const def = getAssembly(part.assembly ?? '')
  if (!def) return []
  const out: StructuralViolation[] = []
  if (def.units && def.units.bond !== 'running') out.push({ code: STRUCTURAL_VIOLATION.UNBONDED_MASONRY, part: part.id, message: `${part.id} is laid in ${def.units.bond} bond: the joints must be staggered` })
  const plastered = (def.layers ?? []).some((layer) => layer.material === 'plaster' && layer.faces === 'both')
  if (def.core.material === 'brick' && !plastered && !EXPOSED_FINISHES.includes(finish ?? '')) out.push({ code: STRUCTURAL_VIOLATION.MISSING_PLASTER, part: part.id, message: `${part.id} is brick without plaster on both faces` })
  return out
}

/**
 * Confined masonry: every exterior masonry wall stands on a ground beam (or a foundation), has a concrete pillar at each end, corner and junction and at most
 * every `MAX_PILLAR_SPACING` metres, from the floor up to the bond beam on top, which rests on them; its bricks are bonded and plastered on both faces.
 */
export function masonryViolations(structure: Pick<Structure, 'parts' | 'supports' | 'construction' | 'openings'>): StructuralViolation[] {
  const walls = structure.parts.filter(isMasonryWall)
  const columns = structure.parts.filter((p) => p.role === 'column' && p.material === 'concrete')
  const out: StructuralViolation[] = []
  for (const part of walls) {
    out.push(...assemblyViolations(part, structure.construction.walls.finish))
    if (part.floor === 0 && structure.supports.some((s) => s.part === part.id && s.on === GROUND))
      out.push({ code: STRUCTURAL_VIOLATION.MISSING_GROUND_BEAM, part: part.id, message: `${part.id} stands on the soil with no ground beam under it` })
    if (!part.exterior || isOverOpening(part, structure)) continue
    const wall = lineOf(part)
    // a pillar of the next wall on the line, standing just past this one's end, confines this end too
    const pillars = columns.filter((c) => c.floor === part.floor && onLine(wall, centre(c), AT_POINT) && Math.min(c.y1, part.y1) - Math.max(c.y0, part.y0) > 0.5)
    const windows = structure.openings.filter((o) => o.wall === part.id).map((o): [number, number] => [o.from, o.to])
    const context: WallContext = { wall, pillars, stations: pillars.map((p) => alongOfPoint(wall, centre(p))), windows }
    const others = walls.filter((w) => w !== part && w.floor === part.floor).map(lineOf)
    out.push(...pointViolations(context, others), ...bondBeamViolations(context, structure))
  }
  return out
}
