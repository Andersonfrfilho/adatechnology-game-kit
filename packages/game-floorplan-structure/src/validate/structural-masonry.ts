import { beamBearings, groutedAt } from '../beam-bearings'
import { touches } from '../geometry'
import { coresAlong, doubledCores } from '../grout'
import { getMasonryUnit, MORTAR_JOINT, moduleOf, unitServes } from '../masonry-units'
import type { MasonryUnit } from '../masonry-units'
import { barArea, cellArea, MAX_GROUT_SPACING, MAX_STEEL_IN_CELL, MIN_GROUT_BAR } from '../structural-masonry/design'
import type { LoadedRoom } from '../structural-masonry/live-loads'
import { GROUND } from '../types'
import type { Opening, Structure, StructurePart } from '../types'
import { STRUCTURAL_VIOLATION } from './codes'
import type { StructuralViolation } from './codes'
import { assemblyViolations, centre, endKind, isMasonryWall, isOverOpening, lineOf, onLine, pointOf, pointViolations } from './masonry'
import type { Confinement, WallLine } from './masonry'
import { strengthViolations } from './structural-masonry-strength'

/** The cores of structural masonry at the points of a wall: in the first cell of a free end, a corner or a junction (one module of the unit). */
const coresOf = (unit: MasonryUnit): Confinement => ({ name: 'grouted core', spacing: MAX_GROUT_SPACING, reach: moduleOf(unit) + TOLERANCE })
/** Bars in a cell where they are spliced: the bar of the course below laps the one above (traspasse), so a cell holds two. */
const BARS_AT_SPLICE = 2
/** Metres of a wall its bond beam may leave uncovered (the joint at its end). */
const BOND_BEAM_SLACK = 0.05
/** How far a wall end, a jamb, a sill or a head may sit off its grid, metres (the joint takes it). */
const GRID_SLACK = 0.02
const TOLERANCE = 0.01

type MasonryStructure = Pick<Structure, 'parts' | 'supports' | 'construction' | 'openings' | 'levels'>

const offGrid = (x: number, step: number): boolean => Math.abs(x - Math.round(x / step) * step) > GRID_SLACK
const bondBeamsOn = (part: StructurePart, structure: MasonryStructure): StructurePart[] => {
  const resting = new Set(structure.supports.filter((s) => s.on === part.id && s.bears !== false).map((s) => s.part))
  return structure.parts.filter((p) => p.beamKind === 'bond_beam' && resting.has(p.id))
}

/** The unit and the steel of the cores: graded for structural use, with a channel unit for the reinforced courses, a bar in each core within its cell. */
function unitViolations(unit: MasonryUnit, groutBar: number | undefined): StructuralViolation[] {
  const out: StructuralViolation[] = []
  if (!unitServes(unit, 'structural')) out.push({ code: STRUCTURAL_VIOLATION.UNIT_NOT_STRUCTURAL, part: unit.id, message: `${unit.id} is graded for sealing only: a structural wall needs a unit graded for it` })
  if (!unit.channel) out.push({ code: STRUCTURAL_VIOLATION.MISSING_CHANNEL_UNIT, part: unit.id, message: `${unit.id} has no channel unit: the bond beams and lintels of structural masonry are reinforced courses of channel units` })
  if (groutBar === undefined || groutBar < MIN_GROUT_BAR - 1e-9)
    out.push({ code: STRUCTURAL_VIOLATION.GROUT_WITHOUT_BAR, part: unit.id, message: `the grouted cores have ${groutBar === undefined ? 'no bar' : `a Ø ${(groutBar * 1000).toFixed(1)} mm bar`}: at least Ø ${MIN_GROUT_BAR * 1000} mm` })
  else if (BARS_AT_SPLICE * barArea(groutBar) > MAX_STEEL_IN_CELL * cellArea(unit))
    out.push({ code: STRUCTURAL_VIOLATION.GROUT_STEEL_CONGESTED, part: unit.id, message: `two Ø ${(groutBar * 1000).toFixed(1)} mm bars at a splice fill ${((100 * BARS_AT_SPLICE * barArea(groutBar)) / cellArea(unit)).toFixed(1)} % of a cell of ${unit.id}: at most ${MAX_STEEL_IN_CELL * 100} %` })
  return out
}

/** The grouted cores along the line of `part` (its own, and those of the walls on the same line: a door's jambs are the ends of two walls). */
function lineStations(part: StructurePart, walls: readonly StructurePart[]): number[] {
  const wall = lineOf(part)
  return walls.filter((w) => w.floor === part.floor && lineOf(w).alongU === wall.alongU && Math.abs(lineOf(w).line - wall.line) <= wall.half).flatMap((w) => coresAlong(w, walls))
}

/** The lintel over a door of structural masonry is a course of channel blocks, or whole courses of them: its underside on the head, its depth on the courses. */
function doorLintelViolations(door: Opening, structure: MasonryStructure, course: number): StructuralViolation[] {
  const lintel = structure.parts.find((p) => p.id === `lintel_${door.id}`)
  if (!lintel) return []
  if (Math.abs(lintel.y0 - door.y1) <= GRID_SLACK && !offGrid(lintel.y1 - lintel.y0, course)) return []
  return [{ code: STRUCTURAL_VIOLATION.OFF_MODULE, part: lintel.id, message: `${lintel.id} (${lintel.y0}-${lintel.y1} m) is no course of channel blocks over the head of ${door.id} at ${door.y1} m` }]
}

/**
 * The windows and doors of a wall laid to the coordination of its unit (jambs on the module, sills and heads on the courses, the door's lintel a course of
 * channel blocks), a grouted core in the first cell beside each jamb, and the wall's ends on the module.
 */
function coordinationViolations(part: StructurePart, walls: readonly StructurePart[], structure: MasonryStructure, unit: MasonryUnit): StructuralViolation[] {
  const wall = lineOf(part)
  const module = moduleOf(unit)
  const course = unit.height + MORTAR_JOINT
  const level = structure.levels[part.floor] ?? 0
  const stations = lineStations(part, walls)
  const out: StructuralViolation[] = []
  for (const end of [wall.from, wall.to]) if (offGrid(end, module)) out.push({ code: STRUCTURAL_VIOLATION.OFF_MODULE, part: part.id, message: `${part.id} ends at ${end.toFixed(3)} m, off the ${module} m module of ${unit.id}` })
  for (const o of structure.openings.filter((x) => x.wall === part.id)) {
    for (const jamb of [o.from, o.to]) if (offGrid(jamb, module)) out.push({ code: STRUCTURAL_VIOLATION.OFF_MODULE, part: part.id, message: `${o.id}: jamb at ${jamb.toFixed(3)} m, off the ${module} m module` })
    for (const y of [o.y0, o.y1]) if (offGrid(y - level, course)) out.push({ code: STRUCTURAL_VIOLATION.OFF_MODULE, part: part.id, message: `${o.id}: sill or head ${(y - level).toFixed(3)} m over the floor, off the ${course.toFixed(2)} m courses` })
    if (o.kind === 'door') out.push(...doorLintelViolations(o, structure, course))
    // the first cell beside each jamb, in the masonry (not in the opening)
    if (!stations.some((s) => s <= o.from + TOLERANCE && s >= o.from - module - TOLERANCE))
      out.push({ code: STRUCTURAL_VIOLATION.OPENING_WITHOUT_GROUT, part: part.id, message: `${part.id} has no grouted core in the cell beside the jamb of ${o.id} at ${o.from.toFixed(2)} m` })
    if (!stations.some((s) => s >= o.to - TOLERANCE && s <= o.to + module + TOLERANCE))
      out.push({ code: STRUCTURAL_VIOLATION.OPENING_WITHOUT_GROUT, part: part.id, message: `${part.id} has no grouted core in the cell beside the jamb of ${o.id} at ${o.to.toFixed(2)} m` })
  }
  return out
}

/** Every corner and T of two bearing walls interlocked: the walls touch (their courses alternate into each other) and their bond beams tie over the meeting. */
function junctionViolations(walls: readonly StructurePart[], structure: MasonryStructure): StructuralViolation[] {
  const out: StructuralViolation[] = []
  const seen = new Set<string>()
  const lines = walls.map(lineOf)
  for (const wall of lines) {
    const others = lines.filter((w) => w !== wall && w.part.floor === wall.part.floor)
    for (const along of [wall.from, wall.to]) {
      const kind = endKind(wall, along, others)
      if (kind !== 'corner' && kind !== 'junction') continue
      for (const other of others.filter((w: WallLine) => w.alongU !== wall.alongU && onLine(w, pointOf(wall, along)))) {
        const key = [wall.part.id, other.part.id].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)
        const tied = bondBeamsOn(wall.part, structure).some((a) => bondBeamsOn(other.part, structure).some((b) => a === b || touches(a.aabb, b.aabb, TOLERANCE)))
        if (!touches(wall.part.aabb, other.part.aabb, TOLERANCE) || !tied)
          out.push({ code: STRUCTURAL_VIOLATION.JUNCTION_NOT_INTERLOCKED, part: wall.part.id, message: `${wall.part.id} and ${other.part.id} meet with ${tied ? 'a gap between them' : 'no bond beam tying them'}` })
      }
    }
  }
  return out
}

/** Metres of the length of `part` no bond beam on it covers. */
function uncovered(part: StructurePart, beams: readonly StructurePart[]): number {
  const alongU = lineOf(part).alongU
  const [from, to] = alongU ? [part.aabb[0], part.aabb[2]] : [part.aabb[1], part.aabb[3]]
  const spans = beams.map((b): [number, number] => (alongU ? [b.aabb[0], b.aabb[2]] : [b.aabb[1], b.aabb[3]])).sort((x, y) => x[0] - y[0])
  let cursor = from
  let open = 0
  for (const [a, b] of spans) {
    if (a > cursor) open += Math.min(a, to) - cursor
    cursor = Math.max(cursor, b)
    if (cursor >= to) break
  }
  return open + Math.max(0, to - cursor)
}

/** The detailing of one bearing wall: foundation, bond, grouted cores, bond beam, no concrete pillar, cores under the beams that bear on it. */
function wallViolations(part: StructurePart, context: { structure: MasonryStructure; walls: readonly StructurePart[]; framed: readonly StructurePart[]; cores: Confinement }): StructuralViolation[] {
  const { structure, walls } = context
  const wall = lineOf(part)
  const stations = coresAlong(part, walls)
  const windows = structure.openings.filter((o) => o.wall === part.id && o.kind === 'window').map((o): [number, number] => [o.from, o.to])
  const others = walls.filter((w) => w !== part && w.floor === part.floor).map(lineOf)
  const out = [...assemblyViolations(part, structure.construction.walls.finish), ...pointViolations({ wall, pillars: [], stations, windows }, others, context.cores)]
  if (part.floor === 0 && structure.supports.some((s) => s.part === part.id && s.on === GROUND))
    out.push({ code: STRUCTURAL_VIOLATION.MISSING_GROUND_BEAM, part: part.id, message: `${part.id} stands on the soil with no strip footing, ground beam or raft under it` })
  const beams = bondBeamsOn(part, structure)
  if (!beams.length) out.push({ code: STRUCTURAL_VIOLATION.MISSING_BOND_BEAM, part: part.id, message: `${part.id} has no reinforced bond beam course on top` })
  else {
    const open = uncovered(part, beams)
    if (open > BOND_BEAM_SLACK) out.push({ code: STRUCTURAL_VIOLATION.BOND_BEAM_NOT_CONTINUOUS, part: part.id, message: `${part.id}: its bond beam leaves ${open.toFixed(2)} m of the wall uncovered` })
  }
  if (structure.parts.some((c) => c.role === 'column' && c.material === 'concrete' && c.floor === part.floor && onLine(wall, centre(c))))
    out.push({ code: STRUCTURAL_VIOLATION.PILLAR_IN_STRUCTURAL_WALL, part: part.id, message: `${part.id} is structural masonry with a concrete pillar in it` })
  for (const bearing of beamBearings([...context.framed.filter((p) => p.role === 'beam'), ...walls]).filter((b) => b.wall.id === part.id && !groutedAt(stations, b.at)))
    out.push({ code: STRUCTURAL_VIOLATION.CONCENTRATED_LOAD_WITHOUT_GROUT, part: part.id, message: `${bearing.beam.id} bears on ${part.id} at ${bearing.at.toFixed(2)} m with no grouted core under it` })
  return out
}

/**
 * Structural masonry (NBR 16868): the walls carry the building, so it needs no concrete pillars or confined bond beams on pillars; it needs instead a unit
 * graded for it with a channel unit, a bar of steel in each grouted core, cores at every corner, junction, free end, jamb and beam bearing and at most every
 * `MAX_GROUT_SPACING` (each cell grouted once), a reinforced bond beam course on every bearing wall, interlocked corners and junctions, its walls and
 * openings on the coordination of the unit, and each pier within its design strength and slenderness (`strengthViolations`).
 */
export function structuralMasonryViolations(structure: MasonryStructure, context: { framed: Pick<Structure, 'parts' | 'supports'>; rooms: readonly LoadedRoom[] }): StructuralViolation[] {
  const unitId = structure.construction.walls.unit
  if (unitId === undefined) return []
  const unit = getMasonryUnit(unitId)
  // (the masonry laid on a door's lintel is no wall of its own: the jambs are the free ends of the walls beside the door)
  const walls = structure.parts.filter((p) => isMasonryWall(p) && p.role === 'wall' && !isOverOpening(p, structure))
  const out = [...unitViolations(unit, structure.construction.walls.groutBar), ...junctionViolations(walls, structure)]
  for (const part of walls) {
    out.push(...wallViolations(part, { structure, walls, framed: context.framed.parts, cores: coresOf(unit) }), ...coordinationViolations(part, walls, structure, unit))
  }
  for (const [a, b] of doubledCores(walls))
    out.push({ code: STRUCTURAL_VIOLATION.GROUT_CORE_DOUBLED, part: a.wall.id, message: `${a.wall.id} at ${a.at.toFixed(2)} m and ${b.wall.id} at ${b.at.toFixed(2)} m grout the same cell` })
  return [...out, ...strengthViolations({ structure, framed: context.framed, rooms: context.rooms, unit, walls })]
}
