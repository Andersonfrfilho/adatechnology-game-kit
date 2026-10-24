import { segmentOf } from '../../body/body-state'
import type { SegmentState } from '../../types'
import type { BodyOps } from '../body-ops'
import { HEADSHOT, NO_HEADSHOT, bleedWound, destroyWithBleeding, segmentDamage, severWithBleeding } from './blow'
import type { SegmentBlow, SegmentRule } from './blow'

/** A blow of at least this many points blows the head off (Arsenal `damage`: `dmg >= 30`). */
const HEAD_BLOW_POINTS = 30
const LIMB_VITALITY_SHARE = 0.3

const split = (ops: BodyOps): void => {
  const torso = segmentOf(ops.body, 'torso')
  if (!torso.attached) return
  severWithBleeding(ops, torso)
  ops.change('split', 'torso')
  ops.kill('vitality')
}

const loseLimb = (ops: BodyOps, segment: SegmentState, blow: SegmentBlow): void => {
  if (blow.big || -segment.hp > segment.max) destroyWithBleeding(ops, segment)
  else severWithBleeding(ops, segment)
  const { body } = ops
  if (segment.kind === 'thigh' || segment.kind === 'shin') {
    if (body.alive) ops.crawl()
  } else if (segment.kind === 'foot' && body.alive && !body.crawl && body.limping.length === 0 && segment.side) ops.limp(segment.side)
}

/** The Galeria 3D do Arsenal's `damage`: every number and branch of the page, in its order. */
export const arsenalRule: SegmentRule = (ops, blow) => {
  const { segment } = blow
  if (!segment.attached) return NO_HEADSHOT
  const amount = segmentDamage(ops, blow, blow.points)
  if (blow.point) bleedWound(ops, segment, blow.point)
  segment.hp -= amount
  ops.damage(segment, amount, blow.damageType)
  let result = NO_HEADSHOT
  if (segment.kind === 'head') {
    if (blow.points >= HEAD_BLOW_POINTS || segment.hp <= 0) {
      destroyWithBleeding(ops, segment)
      ops.kill('head')
      result = HEADSHOT
    } else ops.wound(segment)
  } else if (segment.kind === 'jaw') {
    if (segment.hp <= 0) severWithBleeding(ops, segment)
  } else if (segment.kind === 'neck') {
    if (segment.hp <= 0) {
      severWithBleeding(ops, segment)
      ops.kill('head')
    }
  } else if (segment.kind === 'torso' || segment.kind === 'pelvis') {
    ops.body.vitality -= amount
    if (blow.points >= ops.rules.severity.splitAtDamage || segment.hp <= 0) split(ops)
  } else {
    ops.body.vitality -= amount * LIMB_VITALITY_SHARE
    if (segment.hp <= 0) loseLimb(ops, segment, blow)
  }
  if (ops.body.alive && ops.body.vitality <= 0) ops.kill('vitality')
  return result
}
