import type { Vec3 } from '@adatechnology/game-contracts'

import { REGION_SEGMENTS, BODY_REGIONS } from '../body/regions'
import { segmentNode } from '../body/segment-tree'
import type { SegmentId } from '../body/segment-tree'
import { distance } from '../body/transform'
import type { BodyOps } from './body-ops'
import { HEADSHOT, NO_HEADSHOT, destroyWithBleeding } from './rules/blow'
import type { RuleResult, SegmentBlow, SegmentRule } from './rules/blow'
import { regionRule } from './rules/regions'
import type { RegionBlow } from './rules/regions'

export type BlastParams = {
  readonly ops: BodyOps
  /** Centre of the blast in the body's local space. */
  readonly center: Vec3
  readonly points: number
  readonly radius: number
  /** Inside this distance a segment takes the whole blast (lethal); from it to `radius` it takes at most `blast.injuryPoints`, falling off to nothing at `radius`. Without it: `points × (1 − distance/radius)`. */
  readonly lethalRadius?: number
  /** A joint position in local space. */
  readonly jointOf: (id: SegmentId) => Vec3
}

/** Points per segment at the edge of the lethal radius when the rules name none: a person there is left badly hurt, not dead. */
const INJURY_POINTS = 15

/** The points of a blast on a segment `metres` from its centre: `points × (1 − distance/radius)`; with a `lethalRadius`, all of them inside it and, beyond it, the injury share that falls off to the edge. */
const pointsAt = (params: BlastParams, metres: number): number => {
  const { points, radius, lethalRadius, ops } = params
  if (lethalRadius === undefined || lethalRadius >= radius) return points * Math.max(0, 1 - metres / radius)
  if (metres <= lethalRadius) return points
  const injury = Math.min(points, ops.rules.blast.injuryPoints ?? INJURY_POINTS)
  return injury * Math.max(0, 1 - (metres - lethalRadius) / (radius - lethalRadius))
}

/** The share of a blast each target takes (`pointsAt`), kept above the minimum, strongest first (Arsenal `grenadeAt`). */
const shares = <TTarget>(params: BlastParams, targets: readonly TTarget[], pivot: (target: TTarget) => SegmentId): { target: TTarget; points: number }[] =>
  targets
    .map((target) => ({ target, points: pointsAt(params, distance(params.jointOf(pivot(target)), params.center)) }))
    .filter((share) => share.points > params.ops.rules.blast.minimumPoints)
    .sort((a, b) => b.points - a.points)

export type SegmentBlastParams = BlastParams & { readonly rule: SegmentRule; readonly blow: Omit<SegmentBlow, 'segment' | 'points' | 'big' | 'explosive' | 'point'> }

/** A blast on the 17 segments: a strong share on the head blows it off; every other share goes through the segment rule as an explosive blow. */
export const segmentBlast = (params: SegmentBlastParams): RuleResult => {
  const { ops, rule, blow } = params
  const { blast, segments } = ops.rules
  let result = NO_HEADSHOT
  for (const { target, points } of shares(params, ops.body.segments.filter((segment) => segment.attached), (segment) => segment.id)) {
    if (!target.attached) continue
    if (target.kind === 'head' && points > blast.headDestroyPoints) {
      destroyWithBleeding(ops, target)
      ops.kill('explosion')
      result = HEADSHOT
      continue
    }
    rule(ops, { ...blow, segment: target, points: points / segments[target.kind].multiplier, big: points > blast.bigPoints, explosive: true })
  }
  return result
}

export type RegionBlastParams = BlastParams & { readonly blow: Omit<RegionBlow, 'region' | 'points'> }

/** A blast on the 6 crowd regions, each measured at the joint of the segment that names it. */
export const regionBlast = (params: RegionBlastParams): RuleResult => {
  let result = NO_HEADSHOT
  const pivot = (region: (typeof BODY_REGIONS)[number]): SegmentId => segmentNode(REGION_SEGMENTS[region][0] as SegmentId).id
  for (const { target, points } of shares(params, BODY_REGIONS, pivot)) {
    if (regionRule(params.ops, { ...params.blow, region: target, points }).headshot) result = HEADSHOT
  }
  return result
}
