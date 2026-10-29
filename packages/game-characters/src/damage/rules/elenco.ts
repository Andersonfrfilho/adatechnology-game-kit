import type { SegmentKind } from '@adatechnology/game-contracts'

import { spreadPoints } from '../points'
import { HEADSHOT, NO_HEADSHOT, isLeg, segmentDamage } from './blow'
import type { SegmentRule } from './blow'

/** A head at 0 is cut off by an edge of at least this `cut` or a blow of at least this many points (Elenco `hit`). */
const HEAD_SEVER_CUT = 0.7
const HEAD_SEVER_POINTS = 90
/** The segments that hang from a joint of their own in the Elenco (`s.node`): they are cut or break at it. */
const JOINTED: ReadonlySet<SegmentKind> = new Set(['head', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'foot'])

/** The Elenco's `hit`, `sever` and `breakBone`: one ±15 % draw per blow, cut at the joint above, broken bones dangle or make the leg limp. */
export const elencoRule: SegmentRule = (ops, blow) => {
  const { segment } = blow
  const { body, rules } = ops
  if (!segment.attached || (!body.alive && segment.kind !== 'head')) return NO_HEADSHOT
  const amount = segmentDamage(ops, blow, spreadPoints(blow.points, rules.spread, ops.random))
  segment.hp = Math.max(0, segment.hp - amount)
  ops.damage(segment, amount, blow.damageType)
  if (segment.hp > 0) {
    ops.wound(segment)
    return NO_HEADSHOT
  }
  if (segment.kind === 'head') {
    if (blow.cut >= HEAD_SEVER_CUT || blow.points >= HEAD_SEVER_POINTS) ops.sever(segment, 'zero')
    else ops.breakBone(segment)
    ops.kill('head')
    return HEADSHOT
  }
  if (JOINTED.has(segment.kind)) {
    if (blow.cut >= rules.severity.severAtCut || amount >= segment.max * rules.severity.severAtDamageFraction) {
      ops.sever(segment, 'zero')
      if (isLeg(segment.kind)) ops.crawl()
      return NO_HEADSHOT
    }
    ops.breakBone(segment)
    if (isLeg(segment.kind) && segment.side) {
      ops.limp(segment.side)
      if (body.limping.length === 2) ops.crawl()
    }
    return NO_HEADSHOT
  }
  ops.breakBone(segment)
  if (segment.kind === 'torso') ops.kill('vitality')
  else if (segment.kind === 'pelvis') ops.crawl()
  else if (segment.kind === 'neck') ops.kill('head')
  return NO_HEADSHOT
}
