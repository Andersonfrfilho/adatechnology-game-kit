import type { PlanRect } from '../cities/types'
import { frameOf } from './frame'
import type { RunFrame } from './frame'
import type { PowerRules } from './rules'

/** A lot's front on its street: its rectangle, the street's frame, the side of the street it stands on and its span along the street. */
export type LotFrontage = {
  readonly lot: string
  readonly rect: PlanRect
  readonly frame: RunFrame
  /** Half the street's roadway plus its sidewalk: a point farther from the axis is off the street. */
  readonly reach: number
  readonly side: 1 | -1
  readonly span: readonly [number, number]
}

export type DropFitParams = {
  readonly frontage: LotFrontage
  readonly pole: { readonly x: number; readonly z: number }
  readonly anchor: readonly [number, number, number]
  readonly rules: Pick<PowerRules, 'dropMaxSkew' | 'dropFrontageSlack'>
}

export type DropMisfit = 'skewed' | 'off_frontage'

/**
 * How a drop from a street pole to a lot's anchor breaks the street's practice, or nothing: on the pole's own side the pole stands in front of
 * the lot (its station within the frontage); across the street the drop goes straight over (within `dropMaxSkew` of the street's normal),
 * never along the street. A pole off the street (a service pole inside a lot) is not judged here.
 */
export function dropMisfitOf({ frontage, pole, anchor, rules }: DropFitParams): DropMisfit | undefined {
  const [poleU, poleV] = frameOf({ frame: frontage.frame, x: pole.x, z: pole.z })
  if (Math.abs(poleV) > frontage.reach) return undefined
  const [anchorU, anchorV] = frameOf({ frame: frontage.frame, x: anchor[0], z: anchor[2] })
  if (Math.sign(poleV) === frontage.side) {
    const [low, high] = frontage.span
    return poleU >= low - rules.dropFrontageSlack && poleU <= high + rules.dropFrontageSlack ? undefined : 'off_frontage'
  }
  const skew = (Math.atan2(Math.abs(poleU - anchorU), Math.abs(poleV - anchorV)) * 180) / Math.PI
  return skew <= rules.dropMaxSkew ? undefined : 'skewed'
}

const inside = (x: number, z: number, rect: PlanRect): boolean => x > rect[0] && x < rect[2] && z > rect[1] && z < rect[3]

/** The first other lot a drop's straight path passes over (sampled every 0.25 m), or none. */
export function lotUnderDrop({ from, to, lot, frontages }: { readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly lot: string; readonly frontages: readonly LotFrontage[] }): string | undefined {
  const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.25))
  for (let index = 0; index <= steps; index++) {
    const t = index / steps
    const [x, z] = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
    const other = frontages.find((entry) => entry.lot !== lot && inside(x, z, entry.rect))
    if (other) return other.lot
  }
  return undefined
}
