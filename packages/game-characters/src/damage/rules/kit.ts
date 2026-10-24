import { segmentOf } from '../../body/body-state'
import type { SegmentState } from '../../types'
import type { BodyOps } from '../body-ops'
import { spreadPoints } from '../points'
import { HEADSHOT, NO_HEADSHOT, bleedWound, destroyWithBleeding, isLeg, segmentDamage, severWithBleeding } from './blow'
import type { RuleResult, SegmentBlow, SegmentRule } from './blow'

type Outcome = 'destroyed' | 'severed' | 'broken'

/** At 0: destroyed by a blast or a blow of twice the segment; severed by an edge (`cut` ≥ 0.5) or a blow above 90 % of it; else broken. */
export const severityOf = (ops: BodyOps, blow: SegmentBlow, amount: number, max: number): Outcome => {
  const rule = ops.rules.severity
  if (blow.explosive || amount >= max * rule.destroyAtDamageMultiple) return 'destroyed'
  if (blow.cut >= rule.severAtCut || amount > max * rule.severAtDamageFraction) return 'severed'
  return 'broken'
}

const lose = (ops: BodyOps, segment: SegmentState, outcome: Outcome): void => {
  if (outcome === 'destroyed') destroyWithBleeding(ops, segment)
  else if (outcome === 'severed') severWithBleeding(ops, segment)
  else ops.breakBone(segment)
}

/** The game's head rule: a projectile kills when it pierces the skull with enough points, a blow when it takes the head's hit points. */
const hitHead = (ops: BodyOps, blow: SegmentBlow, points: number, amount: number, hpBefore: number): RuleResult => {
  const { segment, projectile } = blow
  const rule = ops.rules.severity
  const lethal = projectile ? blow.model.piercesSkull(projectile, blow.headResistance) && points >= rule.headKillDamage : amount >= hpBefore
  if (lethal) {
    const shotgunClose = projectile !== undefined && projectile.pellets > 1 && projectile.distance < rule.headBitShotgunMetres
    if (blow.explosive || points > rule.headBitDamage || shotgunClose) destroyWithBleeding(ops, segment)
    else ops.breakBone(segment)
    ops.kill('head')
    return HEADSHOT
  }
  ops.body.vitality -= amount
  ops.wound(segment)
  if (points > rule.jawDamage && ops.random() < rule.jawChance) severWithBleeding(ops, segmentOf(ops.body, 'jaw'))
  return NO_HEADSHOT
}

const hitTorso = (ops: BodyOps, points: number, amount: number, segment: SegmentState): void => {
  ops.body.vitality -= amount
  if (points < ops.rules.severity.splitAtDamage && segment.hp > 0) return ops.wound(segment)
  const torso = segmentOf(ops.body, 'torso')
  if (!torso.attached) return
  severWithBleeding(ops, torso)
  ops.change('split', 'torso')
  if (ops.rules.deathRule === 'head-only') ops.crawl()
  else ops.kill('vitality')
}

const hitLimb = (ops: BodyOps, blow: SegmentBlow, amount: number, hpBefore: number): void => {
  const { segment } = blow
  const rule = ops.rules.severity
  ops.body.vitality -= amount * rule.limbVitalityShare
  if (isLeg(segment.kind) && segment.side && segment.hp <= segment.max * rule.limpAtHpFraction) ops.limp(segment.side)
  if (segment.hp > 0 || hpBefore <= 0) return ops.wound(segment)
  const outcome = severityOf(ops, blow, amount, segment.max)
  lose(ops, segment, outcome)
  if (segment.kind === 'thigh' || segment.kind === 'shin') ops.crawl()
}

/** The kit's rule: Arsenal numbers, the design's severity, the game's head rule, the death rule of the kit. */
export const kitRule: SegmentRule = (ops, blow) => {
  const { segment } = blow
  if (!segment.attached) return NO_HEADSHOT
  const points = spreadPoints(blow.points, ops.rules.spread, ops.random)
  const amount = segmentDamage(ops, blow, points)
  if (blow.point && !blow.explosive) bleedWound(ops, segment, blow.point)
  const hpBefore = segment.hp
  segment.hp -= amount
  ops.damage(segment, amount, blow.damageType)
  let result = NO_HEADSHOT
  if (segment.kind === 'head') result = hitHead(ops, blow, points, amount, hpBefore)
  else if (segment.kind === 'torso' || segment.kind === 'pelvis') hitTorso(ops, points, amount, segment)
  else if (segment.kind === 'jaw' || segment.kind === 'neck') {
    if (segment.hp <= 0 && hpBefore > 0) {
      lose(ops, segment, severityOf(ops, blow, amount, segment.max))
      if (segment.kind === 'neck' && !segment.attached) ops.kill('head')
    } else ops.wound(segment)
  } else hitLimb(ops, blow, amount, hpBefore)
  if (ops.body.vitality <= 0) ops.kill('vitality')
  if (ops.body.alive && points >= ops.rules.severity.stunAtPoints) ops.stun()
  return result
}
