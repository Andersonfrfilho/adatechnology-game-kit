import { meleeFamilyOf, sweepOf } from '@adatechnology/game-weapons'
import type { Hit, Vec3 } from '@adatechnology/game-contracts'

/**
 * A hand-held blow as it meets the surface (`handHeld`: a body marks it where it lands, unlike a crash): which way the weapon sweeps across it (from the motion of the blow the body plays, `MOTION_SWEEPS` of game-weapons) and
 * the length of a club's contact line (its family's `contactLength`). A cut then runs along the swing and a bat leaves a crease along its barrel.
 */
export function withSweep(hit: Hit, blow: { readonly weapon: string; readonly motion: string | undefined; readonly forward: Vec3 }): Hit {
  const sweep = sweepOf(blow.motion, blow.forward)
  const contactLength = meleeFamilyOf(blow.weapon)?.contactLength
  return { ...hit, handHeld: true, ...(sweep ? { sweep } : {}), ...(contactLength !== undefined ? { contactLength } : {}) }
}
