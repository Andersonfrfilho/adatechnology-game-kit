import { GROUND } from '../types'
import type { StructurePart } from '../types'
import type { BuildContext } from './context'

/** Depth of the ground beam (viga baldrame) under a ground-floor masonry wall, metres: the usual 15 x 30 cm, as wide as the wall. */
export const GROUND_BEAM_DEPTH = 0.3

/**
 * The ground beams of a masonry house on strip footings: one reinforced concrete beam under each ground-floor wall, buried with its top at the floor, cast
 * on the footing. The wall stands on it instead of on the soil; the pillars go down through it to the footing.
 */
export function addGroundBeams(context: BuildContext): void {
  const { builder, construction } = context
  if (construction.system !== 'masonry' || context.isUnit || construction.foundation.type !== 'strip_footing') return
  const top = context.level(0)
  for (const wall of context.walls) {
    if (wall.floor !== 0 || wall.type !== 'wall') continue
    const beam: StructurePart = builder.add({ id: `ground_beam_${context.groundBeams.size}`, role: 'beam', material: construction.frame.beams, aabb: wall.box, y0: top - GROUND_BEAM_DEPTH, y1: top }, { floor: 0, beamKind: 'ground_beam' })
    builder.rest(beam, GROUND, 'rebar')
    context.groundBeams.set(wall.id, beam)
  }
}
