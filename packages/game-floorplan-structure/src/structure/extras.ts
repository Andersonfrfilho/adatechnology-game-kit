import { GROUND } from '../types'
import { round2, touches } from '../geometry'
import type { BuildContext } from './context'

const CHIMNEY_CLEARANCE_ABOVE_RIDGE = 0.6

/** A masonry chimney or a stove flue next to the house, tied to the wall it touches, rising above the ridge. */
export function addChimney(context: BuildContext): void {
  const chimney = context.extras.chimney
  if (!chimney) return
  const { builder } = context
  const top = context.floorCount - 1
  const ridge = context.roof.ridge || context.level(top) + context.ceilingOf(top)
  const height = Math.max(ridge, chimney.top || 0) + CHIMNEY_CLEARANCE_ABOVE_RIDGE
  const part = builder.add({ id: 'chimney', role: 'column', material: chimney.material || 'brick', aabb: chimney.aabb, y0: chimney.flue ? context.level(0) : 0, y1: height }, { floor: 0, fill: chimney.flue ? 0.15 : 0.7 })
  if (chimney.flue) builder.rest(part, context.base0 ?? GROUND, 'resting')
  else builder.rest(part, GROUND, 'mortar')
  const walls = builder.parts.filter((wall) => wall.role === 'wall' && wall.floor === 0 && !wall.id.startsWith('basement') && touches(wall.aabb, part.aabb, 0.1))
  for (const wall of walls) builder.rest(part, wall, 'bolt')
  chimney.height = round2(height)
}

/** The stone mouth of a well. */
export function addWell(context: BuildContext): void {
  const well = context.extras.well
  if (!well) return
  const part = context.builder.add({ id: 'well', role: 'column', material: 'stone', aabb: well.aabb, y0: -0.5, y1: well.height || 0.9 }, { floor: 0, fill: 0.5 })
  context.builder.rest(part, GROUND, 'mortar')
}
