import type { PlanRect } from '@adatechnology/game-urban'

import { rectCentre } from './geometry'
import type { LotFront } from './site'

/** Where a house stands: the world position of its plan's origin corner and the turn about y that makes its front face the lot's street. */
export type HousePlacement = { readonly x: number; readonly z: number; readonly ry: number }

/**
 * The plan of a house in its own frame: `u` along x from 0 to `width`, `v` along z from 0 to `depth`, the front at `v = 0` looking toward -z. `yard` is how far the plan's own lot runs
 * in front of the facade (its front wall, gate and service pole stand there), 0 when the lot starts at the facade.
 */
export type HouseSize = { readonly width: number; readonly depth: number; readonly yard?: number }

/**
 * The house centred along the street, its plan's lot flush with the front edge of the site's lot: the facade stands `yard` metres back, so the front yard (and the service pole the
 * plan puts just in front of it) lands on the lot and the sidewalk, never on the road. A house turned by `ry` maps its own (u, v) to the world by the rotation about y, so the
 * four fronts differ by a quarter turn each: `n` looks toward -z (the house as drawn), `s` toward +z (half a turn), `e` toward +x, `w` toward -x.
 */
export function lotPlacement(rect: PlanRect, front: LotFront, size: HouseSize): HousePlacement {
  const [x0, z0, x1, z1] = rect
  const [cx, cz] = rectCentre(rect)
  const yard = size.yard ?? 0
  switch (front) {
    case 'n':
      return { x: cx - size.width / 2, z: z0 + yard, ry: 0 }
    case 's':
      return { x: cx + size.width / 2, z: z1 - yard, ry: Math.PI }
    case 'e':
      return { x: x1 - yard, z: cz - size.width / 2, ry: -Math.PI / 2 }
    case 'w':
      return { x: x0 + yard, z: cz + size.width / 2, ry: Math.PI / 2 }
  }
}

/** What the house leaves outside its lot (metres, positive); 0 when it fits, in each direction. */
export function overflowOf(rect: PlanRect, front: LotFront, size: HouseSize): { readonly along: number; readonly deep: number } {
  const [x0, z0, x1, z1] = rect
  const frontage = front === 'n' || front === 's' ? x1 - x0 : z1 - z0
  const room = front === 'n' || front === 's' ? z1 - z0 : x1 - x0
  return { along: Math.max(0, size.width - frontage), deep: Math.max(0, size.depth + (size.yard ?? 0) - room) }
}
