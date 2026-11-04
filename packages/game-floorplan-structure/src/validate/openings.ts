import type { Opening, SourceDoor, Structure, StructurePart } from '../types'
import { DOOR_HEIGHT } from '../structure/openings'
import { LINTEL_DEPTH, SILL_BEAM_DEPTH } from '../wall-detail/panels'
import { STRUCTURAL_VIOLATION } from './codes'
import type { StructuralViolation } from './codes'
import { isMasonryWall, lineOf } from './masonry'
import type { WallLine } from './masonry'

const TOLERANCE = 0.05
/** A window this close to the floor has too little masonry under it for a sill beam (a French window). */
const LOW_WINDOW = SILL_BEAM_DEPTH + 0.05

/**
 * A beam in the wall's line that covers `[from, to]` along it, with its underside (`side: 'y0'`) within a lintel's depth over `y` (the bond beam is the
 * lintel of a window right under it) or its top (`'y1'`) at `y`.
 */
function beamAcross(parts: readonly StructurePart[], wall: WallLine, span: { from: number; to: number }, side: 'y0' | 'y1', y: number): boolean {
  return parts.some((part) => {
    const off = part[side] - y
    if (part.role !== 'beam' || off < -TOLERANCE || off > (side === 'y0' ? LINTEL_DEPTH : TOLERANCE)) return false
    const [from, to, low, high] = wall.alongU ? [part.aabb[0], part.aabb[2], part.aabb[1], part.aabb[3]] : [part.aabb[1], part.aabb[3], part.aabb[0], part.aabb[2]]
    return from <= span.from + TOLERANCE && to >= span.to - TOLERANCE && low <= wall.line + TOLERANCE && high >= wall.line - TOLERANCE
  })
}

function windowViolations(opening: Opening, wall: StructurePart, built: readonly StructurePart[]): StructuralViolation[] {
  const line = lineOf(wall)
  const out: StructuralViolation[] = []
  if (!beamAcross(built, line, opening, 'y0', opening.y1)) out.push({ code: STRUCTURAL_VIOLATION.OPENING_WITHOUT_LINTEL, part: opening.id, message: `window ${opening.id} in ${wall.id} has no lintel over it` })
  if (opening.y0 - wall.y0 > LOW_WINDOW && !beamAcross(built, line, opening, 'y1', opening.y0))
    out.push({ code: STRUCTURAL_VIOLATION.OPENING_WITHOUT_SILL, part: opening.id, message: `window ${opening.id} in ${wall.id} has no sill beam under it` })
  return out
}

/** The masonry walls beside a door gap (the door is the gap between two walls on one line). */
function wallsBeside(door: SourceDoor, walls: readonly StructurePart[]): WallLine[] {
  const along = door.axis === 'u' ? door.u : door.v
  const across = door.axis === 'u' ? door.v : door.u
  const from = along - door.width / 2
  const to = along + door.width / 2
  return walls
    .filter((w) => w.floor === door.floor)
    .map(lineOf)
    .filter((w) => w.alongU === (door.axis === 'u') && Math.abs(w.line - across) <= TOLERANCE && (Math.abs(w.to - from) <= TOLERANCE || Math.abs(w.from - to) <= TOLERANCE))
}

/** Lintels and sill beams: a lintel over every window and door of a masonry wall, a sill beam under every window that has masonry under it. */
export function openingViolations(structure: Pick<Structure, 'parts' | 'openings' | 'levels'>, built: readonly StructurePart[], doors: readonly SourceDoor[]): StructuralViolation[] {
  const walls = structure.parts.filter(isMasonryWall)
  const hosts = new Map(walls.map((wall) => [wall.id, wall]))
  const out: StructuralViolation[] = []
  for (const opening of structure.openings) {
    const wall = hosts.get(opening.wall)
    if (wall) out.push(...windowViolations(opening, wall, built))
  }
  for (const door of doors) {
    const beside = wallsBeside(door, walls)
    if (!beside.length) continue
    const along = door.axis === 'u' ? door.u : door.v
    const span = { from: along - door.width / 2, to: along + door.width / 2 }
    const lintel = beamAcross(built, beside[0]!, span, 'y0', (structure.levels[door.floor] ?? 0) + DOOR_HEIGHT)
    if (!lintel) out.push({ code: STRUCTURAL_VIOLATION.OPENING_WITHOUT_LINTEL, part: door.id, message: `door ${door.id} has no lintel over it` })
  }
  return out
}
