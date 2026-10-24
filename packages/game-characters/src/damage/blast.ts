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
  /** A joint position in local space. */
  readonly jointOf: (id: SegmentId) => Vec3
}

/** The share of a blast each target takes: points × (1 − distance/radius), kept above the minimum, strongest first (Arsenal `grenadeAt`). */
const shares = <TTarget>(params: BlastParams, targets: readonly TTarget[], pivot: (target: TTarget) => SegmentId): { target: TTarget; points: number }[] =>
  targets
    .map((target) => ({ target, points: params.points * Math.max(0, 1 - distance(params.jointOf(pivot(target)), params.center) / params.radius) }))
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
