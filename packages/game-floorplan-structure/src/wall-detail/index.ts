import { getAssembly } from '@adatechnology/game-destruction'

import type { Construction, Rect, Structure, StructurePart, WallDetail } from '../types'
import { applySplits } from './apply'
import type { PartsAndSupports } from './apply'
import { splitIntoCourses } from './courses'
import type { CourseSpec } from './courses'
import { splitIntoPanels } from './panels'
import type { WallSplit } from './panels'
import { CONSTRUCTION_SYSTEMS } from '../registry'

const LOG_DIAMETER = 0.26
const isWall = (part: StructurePart): boolean => part.id.startsWith('wall_') && part.assembly !== undefined && (part.role === 'wall' || part.role === 'partition')

function logSpec(construction: Construction, part: StructurePart): CourseSpec {
  const diameter = (construction.walls.logDiameter as number | undefined) ?? LOG_DIAMETER
  return { rowHeight: diameter, bond: 'stack', joint: CONSTRUCTION_SYSTEMS.get(construction.system)!.joints.wall, assembly: part.assembly! }
}

/** Walls cut at their windows (piers, sills, lintels, spandrels); the walls of logs as courses of logs. */
function panelSplits(input: PartsAndSupports, structure: Structure): Map<string, WallSplit> {
  const { construction } = structure
  const system = CONSTRUCTION_SYSTEMS.get(construction.system)!
  const splits = new Map<string, WallSplit>()
  for (const part of input.parts.filter(isWall)) {
    if (construction.system === 'log') {
      splits.set(part.id, splitIntoCourses(part, structure.openings, logSpec(construction, part)))
      continue
    }
    const split = splitIntoPanels(part, structure.openings, {
      lintelMaterial: system.timber ? construction.frame.timber : 'concrete', ...(system.timber ? {} : { lintelAssembly: 'reinforced_concrete' }), lintelJoint: system.joints.beam, wallJoint: system.joints.wall,
    })
    if (split.pieces.length > 1) splits.set(part.id, split)
  }
  return splits
}

/** Splits the walls the way `detail` says: `coarse` keeps one part per wall, `panels` cuts them at the windows, `units` goes on to bricks and blocks. */
export function applyPanels(input: PartsAndSupports, structure: Structure, detail: WallDetail): PartsAndSupports {
  if (detail === 'coarse') return input
  return applySplits(input, panelSplits(input, structure))
}

export interface Sized extends PartsAndSupports {
  capacities: Map<string, number>
}

/** Cuts each wall piece that its assembly lays in units (bricks, blocks, concrete panels) into those units; a unit takes the share of the piece's capacity its width has (it carries its column of the wall). */
export function applyUnits(input: Sized, structure: Structure): Sized {
  const splits = new Map<string, WallSplit>()
  for (const part of input.parts) {
    if (part.unit || !part.assembly || part.role === 'beam' || part.role === 'none') continue
    const units = getAssembly(part.assembly)?.units
    if (!units) continue
    const joint = CONSTRUCTION_SYSTEMS.get(structure.construction.system)!.joints.wall
    splits.set(part.id, splitIntoCourses(part, [], { rowHeight: units.size[1], unitLength: units.size[0], bond: units.bond, joint: units.mortar === 'concrete' ? 'mortar' : joint, assembly: part.assembly }))
  }
  const next = applySplits(input, splits)
  const capacities = new Map(input.capacities)
  for (const [id, split] of splits) {
    const capacity = input.capacities.get(id)
    capacities.delete(id)
    if (capacity === undefined) continue
    const along = (box: Rect): number => Math.max(box[2] - box[0], box[3] - box[1])
    const length = along(input.parts.find((part) => part.id === id)!.aabb)
    for (const piece of split.pieces) capacities.set(piece.id, Math.max(1, (capacity * along(piece.aabb)) / length))
  }
  return { ...next, capacities }
}
