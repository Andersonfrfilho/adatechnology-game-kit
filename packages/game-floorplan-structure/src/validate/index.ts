import type { DestructibleSpec } from '@adatechnology/game-contracts'

import { applyPanels } from '../wall-detail'
import type { SourceDoor, PlanStructure, WallDetail } from '../types'
import { STRUCTURAL_VIOLATION } from './codes'
import type { StructuralViolation } from './codes'
import { applySlabPanels, resolveSlabPanels } from '../slab-panels'
import { concreteViolations, loadPathViolations } from './load-path'
import { isMasonryWall, masonryViolations } from './masonry'
import { openingViolations } from './openings'
import { specViolations } from './spec'

export interface ValidateStructureOptions {
  /** Detail the walls are built in for play (default `panels`, as the houses are): the lintels and sill beams of the windows come from it. */
  wallDetail?: WallDetail
  /** The doors of the plan (`plan.doors`): each door gap in a masonry wall needs a lintel. Without them only the windows are checked. */
  doors?: readonly SourceDoor[]
}

/**
 * What a structure gets wrong as a real building: load paths (every part down to the ground, every pillar on what carries it), reinforced concrete (NBR
 * 6118 sections, steel, beam depth) and, in masonry, confined masonry (ground beam, pillars at ends, corners, junctions and every 4 m up to the bond beam,
 * lintels and sill beams, bonded and plastered bricks). An empty list is a structure that a structural engineer would sign.
 */
export function validateStructure(structure: PlanStructure, options: ValidateStructureOptions = {}): StructuralViolation[] {
  const detail = options.wallDetail ?? 'panels'
  const built = applyPanels({ parts: structure.parts, supports: structure.supports }, structure, detail)
  // the concrete as the house is built: the slabs cut into panels on their beams and the pillars those need
  const framed = applySlabPanels(built, structure, resolveSlabPanels(true)!)
  const out = [...loadPathViolations(structure), ...concreteViolations({ ...framed, construction: structure.construction }, isMasonryWall)]
  if (structure.construction.system !== 'masonry') return out
  return [...out, ...masonryViolations(structure), ...openingViolations(structure, built.parts, options.doors ?? [])]
}

/** What a destructible spec built straight as one (towers, skyscrapers) gets wrong: load paths and concrete sections. */
export function validateSpec(spec: DestructibleSpec): StructuralViolation[] {
  return specViolations(spec)
}

/** The violations counted by code (for reports and tests). */
export function countViolations(violations: readonly StructuralViolation[]): Partial<Record<keyof typeof STRUCTURAL_VIOLATION, number>> {
  const out: Partial<Record<keyof typeof STRUCTURAL_VIOLATION, number>> = {}
  for (const violation of violations) out[violation.code] = (out[violation.code] ?? 0) + 1
  return out
}

export { slabsOffSupport } from './resting-slabs'
export type { RestingState, SlabsOffSupportOptions } from './resting-slabs'
export { BEAM_DEPTH_RATIO, MAX_LINTEL_ON_MASONRY, MAX_PILLAR_SPACING, MIN_BEAM_WIDTH, MIN_PILLAR_AREA, MIN_PILLAR_SIDE, STRUCTURAL_VIOLATION } from './codes'
export type { StructuralViolation, StructuralViolationCode } from './codes'
