import type { DamageType, SegmentKind, Vec3 } from '@adatechnology/game-contracts'

import { segmentNode } from '../../body/segment-tree'
import type { ResolvedCharacterSpec } from '../../character'
import type { SegmentState } from '../../types'
import type { BodyOps } from '../body-ops'
import type { PenetrationModel, ProjectileInfo } from '../types'

/** One blow on one segment, after protection: what every segment rule receives. */
export type SegmentBlow = {
  readonly segment: SegmentState
  /** Points after protection, before the rule's multipliers and spread. */
  readonly points: number
  readonly cut: number
  readonly damageType: DamageType
  readonly projectile?: ProjectileInfo
  readonly explosive: boolean
  /** A blast strong enough to destroy what it takes to 0 (Arsenal `big`). */
  readonly big: boolean
  /** Where it landed (world): a bullet wound bleeds there; a blast share has none. */
  readonly point?: Vec3
  /** Extra factor on arms and legs (age × protection). */
  readonly limbFactor: number
  readonly model: PenetrationModel
  /** Resistance of the head path (the skull rule of the `physical` model). */
  readonly headResistance: number
}

export type RuleResult = { readonly headshot: boolean }

export type SegmentRule = (ops: BodyOps, blow: SegmentBlow) => RuleResult

export const NO_HEADSHOT: RuleResult = { headshot: false }
export const HEADSHOT: RuleResult = { headshot: true }

const ARM_KINDS: ReadonlySet<SegmentKind> = new Set(['upperArm', 'forearm', 'hand'])
const LEG_KINDS: ReadonlySet<SegmentKind> = new Set(['thigh', 'shin', 'foot'])

export const isArm = (kind: SegmentKind): boolean => ARM_KINDS.has(kind)
export const isLeg = (kind: SegmentKind): boolean => LEG_KINDS.has(kind)
export const isLimb = (kind: SegmentKind): boolean => isArm(kind) || isLeg(kind)

/** The body type's multiplier for the group the segment is in (head, torso, arms, legs). */
export const typeMultiplier = (spec: ResolvedCharacterSpec, kind: SegmentKind): number => {
  if (isArm(kind)) return spec.multipliers.arms
  if (isLeg(kind)) return spec.multipliers.legs
  if (kind === 'torso' || kind === 'pelvis') return spec.multipliers.torso
  return spec.multipliers.head
}

/** Points the segment takes: the blow × segment multiplier × body type × (on a limb) age and protection. */
export const segmentDamage = (ops: BodyOps, blow: SegmentBlow, points: number): number => {
  const { kind } = blow.segment
  return points * ops.rules.segments[kind].multiplier * typeMultiplier(ops.spec, kind) * (isLimb(kind) ? blow.limbFactor : 1)
}

/** The stump a lost segment leaves bleeds hard (×1.5 at the neck and head) for 45 s, spurting (Arsenal `stumpAt`). */
export const bleedStump = (ops: BodyOps, segment: SegmentState): void => {
  const bleed = ops.rules.segments[segment.kind].bleed
  const parent = segmentNode(segment.id).parent
  const stump = parent ? (ops.body.segments.find((candidate) => candidate.id === parent) ?? segment) : segment
  ops.bleed({ segment: stump, rate: bleed * (segment.kind === 'neck' || segment.kind === 'head' ? 1.5 : 1), duration: 45, spurt: true })
}

/** The piece that flies off bleeds 35 % of the rate for 15 s (Arsenal `sever`). */
export const bleedPiece = (ops: BodyOps, segment: SegmentState): void => ops.bleed({ segment, rate: ops.rules.segments[segment.kind].bleed * 0.35, duration: 15, spurt: true })

/** A bullet wound bleeds 30 % of the segment's rate for 10 s, without spurting (Arsenal `damage` with a point). */
export const bleedWound = (ops: BodyOps, segment: SegmentState, point: Vec3): void =>
  ops.bleed({ segment, rate: ops.rules.segments[segment.kind].bleed * 0.3, duration: 10, spurt: false, point })

/** Cut off at the joint, with its two bleeders. */
export const severWithBleeding = (ops: BodyOps, segment: SegmentState): void => {
  if (!segment.attached) return
  bleedStump(ops, segment)
  ops.sever(segment)
  bleedPiece(ops, segment)
}

/** Blown to pieces: only the stump bleeds. */
export const destroyWithBleeding = (ops: BodyOps, segment: SegmentState): void => {
  if (!segment.attached) return
  bleedStump(ops, segment)
  ops.destroy(segment)
}
