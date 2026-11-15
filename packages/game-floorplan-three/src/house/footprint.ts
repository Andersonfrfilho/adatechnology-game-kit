import type { HouseWall } from '../kernel-types.js'
import type { Aabb } from './solids.js'

/**
 * The ground floor's walls as boxes in the plan (any height): what the lot's own pieces (its public sidewalk, its walls) are laid round, never through.
 * `sidewalk` grows an outside wall's box by the protective sidewalk laid along it, on every side.
 */
export function groundWallBoxes(walls: readonly HouseWall[], sidewalk = 0): Aabb[] {
  return walls.filter((w) => w.floor === 0 && w.type !== 'railing').map((w): Aabb => {
    const h = (w.thickness || 0.15) / 2 + (w.exterior ? sidewalk : 0)
    return w.axis === 'u'
      ? [Math.min(w.u0, w.u1) - h, -1, w.v0 - h, Math.max(w.u0, w.u1) + h, 100, w.v0 + h]
      : [w.u0 - h, -1, Math.min(w.v0, w.v1) - h, w.u0 + h, 100, Math.max(w.v0, w.v1) + h]
  })
}
