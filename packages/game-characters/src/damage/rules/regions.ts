import { MISSING_BITS } from '@adatechnology/game-contracts'
import type { BodyRegion, DamageType } from '@adatechnology/game-contracts'

import { segmentOf } from '../../body/body-state'
import { REGION_HIT_POINTS, REGION_SEGMENTS } from '../../body/regions'
import type { LimbRegion } from '../../body/regions'
import type { BodyOps } from '../body-ops'
import { spreadPoints } from '../points'
import type { ProtectionOutcome } from '../protection'
import type { PenetrationModel, ProjectileInfo } from '../types'
import { HEADSHOT, NO_HEADSHOT } from './blow'
import type { RuleResult } from './blow'

/** One blow on one crowd region. `points` are the blow's own (the game stuns on them); the torso applies the vest share itself. */
export type RegionBlow = {
  readonly region: BodyRegion
  readonly points: number
  readonly cut: number
  readonly damageType: DamageType
  readonly projectile?: ProjectileInfo
  readonly protection: ProtectionOutcome
  readonly model: PenetrationModel
  readonly headResistance: number
}

const LIMB_BITS: Readonly<Record<Exclude<LimbRegion, 'head'>, { readonly severed: number; readonly broken: number }>> = {
  armL: { severed: MISSING_BITS.armL, broken: MISSING_BITS.armLBroken },
  armR: { severed: MISSING_BITS.armR, broken: MISSING_BITS.armRBroken },
  legL: { severed: MISSING_BITS.legL, broken: MISSING_BITS.legLBroken },
  legR: { severed: MISSING_BITS.legR, broken: MISSING_BITS.legRBroken },
}

const rootOf = (ops: BodyOps, region: BodyRegion) => segmentOf(ops.body, REGION_SEGMENTS[region][0] as Parameters<typeof segmentOf>[1])

const hitHead = (ops: BodyOps, blow: RegionBlow, points: number): RuleResult => {
  const { body, rules } = ops
  const rule = rules.severity
  const multiplier = rules.segments.head.multiplier
  const { projectile } = blow
  const lethal = projectile ? blow.model.piercesSkull(projectile, blow.headResistance) && points >= rule.headKillDamage : points * multiplier >= body.regions.head
  if (lethal) {
    const shotgunClose = projectile !== undefined && projectile.pellets > 1 && projectile.distance < rule.headBitShotgunMetres
    if (points > rule.headBitDamage || shotgunClose) {
      body.missing |= MISSING_BITS.head
      ops.destroy(segmentOf(body, 'head'))
    }
    return HEADSHOT
  }
  body.vitality -= points * multiplier
  body.regions.head -= points
  ops.damage(segmentOf(body, 'head'), points * multiplier, blow.damageType)
  if (points > rule.jawDamage && ops.random() < rule.jawChance && (body.missing & MISSING_BITS.jaw) === 0) {
    body.missing |= MISSING_BITS.jaw
    ops.sever(segmentOf(body, 'jaw'))
  }
  return NO_HEADSHOT
}

const hitLimb = (ops: BodyOps, blow: RegionBlow, region: Exclude<LimbRegion, 'head'>, points: number): void => {
  const { body, spec, rules } = ops
  const leg = region === 'legL' || region === 'legR'
  const factor = (leg ? spec.multipliers.legs : spec.multipliers.arms) * spec.limbFactor * blow.protection.limbs
  const amount = points * factor
  body.regions[region] -= amount
  body.vitality -= amount * rules.severity.regionLimbVitalityShare
  const root = rootOf(ops, region)
  ops.damage(root, amount, blow.damageType)
  const max = REGION_HIT_POINTS[region]
  if (leg && body.regions[region] <= max * rules.severity.limpAtHpFraction) ops.limp(region === 'legL' ? 'L' : 'R')
  if (body.regions[region] > 0) return
  const severs = blow.cut >= rules.severity.severAtCut || amount > max * rules.severity.severAtDamageFraction
  const bit = severs ? LIMB_BITS[region].severed : LIMB_BITS[region].broken
  const isNew = (body.missing & bit) === 0
  body.missing |= bit
  if (leg) ops.crawl()
  if (!isNew) return
  if (severs) ops.sever(root)
  else ops.breakBone(root)
}

/** The game's `zDamage` (G 67011–67045): the crowd model of 6 regions, the bitmask, the helmet, the vest, limp, crawl and the jaw. */
export const regionRule = (ops: BodyOps, blow: RegionBlow): RuleResult => {
  const { body, rules } = ops
  const points = spreadPoints(blow.points, rules.spread, ops.random)
  let result = NO_HEADSHOT
  if (blow.region === 'head') result = hitHead(ops, blow, points)
  else if (blow.region === 'torso') {
    const amount = points * ops.spec.multipliers.torso * blow.protection.ballistic
    body.vitality -= amount
    ops.damage(segmentOf(body, 'torso'), amount, blow.damageType)
  } else hitLimb(ops, blow, blow.region, points)
  if (result.headshot) ops.kill('head')
  else if (body.vitality <= 0) ops.kill('vitality')
  if (!body.alive || result.headshot || body.vitality <= 0) return result
  if (points >= rules.severity.stunAtPoints) ops.stun()
  return result
}
