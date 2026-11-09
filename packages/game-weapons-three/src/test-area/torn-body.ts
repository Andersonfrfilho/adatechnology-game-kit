import type { Vec3 } from '@adatechnology/game-contracts'

/** A world box of what is drawn (min x, y, z, max x, y, z), as `DestructionRenderer.shownBoxes` gives it. */
export type DrawnBox = readonly [number, number, number, number, number, number]

/** Where one part of a body is drawn and what it weighs. */
export interface PartPlace {
  /** Kg. */
  readonly mass: number
  /** The drawn boxes of the part; none when nothing of it is drawn. */
  readonly boxes: readonly DrawnBox[]
}

/** The middle of the box that holds every drawn box, or undefined when there is none. */
export function boxesCentre(boxes: readonly DrawnBox[]): Vec3 | undefined {
  if (boxes.length === 0) return undefined
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  for (const box of boxes) {
    for (let axis = 0; axis < 3; axis++) {
      low[axis] = Math.min(low[axis]!, box[axis]!)
      high[axis] = Math.max(high[axis]!, box[axis + 3]!)
    }
  }
  return [(low[0]! + high[0]!) / 2, (low[1]! + high[1]!) / 2, (low[2]! + high[2]!) / 2]
}

/**
 * How far (m, on the ground plane) the centre of mass of a body moved between two readings of its parts, the parts keyed the same way in both: a body torn into
 * pieces is measured by where all its pieces went, not by the one piece that kept its id. A part weighs what it weighed at the first reading; a part not drawn in
 * one of the two readings is left out of both. Undefined when no part is drawn in both.
 */
export function tornBodyShift<TKey>(before: ReadonlyMap<TKey, PartPlace>, after: ReadonlyMap<TKey, PartPlace>): number | undefined {
  let mass = 0
  const from = [0, 0]
  const to = [0, 0]
  for (const [key, first] of before) {
    const second = after.get(key)
    const start = boxesCentre(first.boxes)
    const end = second ? boxesCentre(second.boxes) : undefined
    if (!start || !end || first.mass <= 0) continue
    mass += first.mass
    from[0] += start[0] * first.mass
    from[1] += start[2] * first.mass
    to[0] += end[0] * first.mass
    to[1] += end[2] * first.mass
  }
  if (mass === 0) return undefined
  return Math.hypot((to[0]! - from[0]!) / mass, (to[1]! - from[1]!) / mass)
}
