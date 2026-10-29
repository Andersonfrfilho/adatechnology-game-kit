import type { DestructibleSpec, Vec3 } from '@adatechnology/game-contracts'

import { segmentOf } from '../body/body-state'
import { REGION_SEGMENTS } from '../body/regions'
import { segmentNode } from '../body/segment-tree'
import type { SegmentId } from '../body/segment-tree'
import { regionBlast, segmentBlast } from './blast'
import type { BodyOps } from './body-ops'
import type { DamageSetup } from './damage-character'
import { energyKept, segmentResistance } from './penetration'
import { cutOf, pointsFromEnergy, projectileOf, resolvePoints } from './points'
import { layersOn, protect } from './protection'
import type { ProtectionOutcome } from './protection'
import { resolveSegment, regionOfSegment } from './resolve-part'
import { arsenalRule } from './rules/arsenal'
import type { RuleResult, SegmentRule } from './rules/blow'
import { elencoRule } from './rules/elenco'
import { kitRule } from './rules/kit'
import { regionRule } from './rules/regions'
import type { BodyHit, HitReport, ProtectionLayer } from './types'

const SEGMENT_RULES: Readonly<Record<string, SegmentRule>> = { kit: kitRule, arsenal: arsenalRule, elenco: elencoRule }
const HEAD_RESISTANCE = segmentResistance({ kind: 'head', bodyCount: 1, protection: 0 })
const NO_PROTECTION: ProtectionOutcome = { ballistic: 1, resistance: 0, limbs: 1, fire: 1 }
const ABSORBED_SPARKS = 8
const METRES_PER_MM = 0.001

export type ApplyBlowParams = {
  readonly ops: BodyOps
  readonly hit: BodyHit
  readonly setup: DamageSetup
  readonly worn: readonly ProtectionLayer[]
  readonly localPoint: Vec3
  readonly jointOf: (id: SegmentId) => Vec3
  readonly describe: () => DestructibleSpec
}

const report = (ops: BodyOps, fields: Partial<HitReport> & { points: number }, result: RuleResult = { headshot: false }): HitReport => ({
  through: false,
  exitEnergy: 0,
  ...fields,
  killed: !ops.body.alive,
  headshot: result.headshot,
})

/** Fire and heat: the exposure burns the torso (`burnPointsPerSecond` × seconds), less what the clothing keeps off. */
const burn = ({ ops, hit, setup, worn }: ApplyBlowParams): HitReport => {
  const torso = segmentOf(ops.body, 'torso')
  const fire = protect({ layers: layersOn(worn, segmentNode('torso').slots, ops.body.consumed), model: setup.model }).fire
  const points = setup.rules.burnPointsPerSecond * (hit.duration ?? 0) * fire
  ops.body.vitality -= points
  ops.damage(torso, points, hit.type)
  if (ops.body.vitality <= 0) ops.kill('vitality')
  return report(ops, { part: 'torso', points })
}

const blast = ({ ops, hit, setup, localPoint, jointOf }: ApplyBlowParams): HitReport => {
  const points = hit.points ?? pointsFromEnergy(hit.energy ?? 0, setup.rules)
  const base = { ops, center: localPoint, points, radius: hit.radius ?? 1, jointOf }
  const common = { cut: hit.cut ?? setup.rules.defaultCut.explosive, damageType: hit.type, model: setup.model, headResistance: HEAD_RESISTANCE }
  const rule = SEGMENT_RULES[setup.rules.segmentRule] ?? kitRule
  const result =
    ops.body.detail === 'regions'
      ? regionBlast({ ...base, blow: { ...common, protection: NO_PROTECTION } })
      : segmentBlast({ ...base, rule, blow: { ...common, limbFactor: ops.spec.limbFactor } })
  return report(ops, { points }, result)
}

const DEFAULT_PATH_METRES = 0.2

/** Length of the path through a part (its diameter), for the exit point of a projectile that goes through. */
const pathThrough = (spec: DestructibleSpec, id: SegmentId): number => {
  const shape = spec.parts.find((part) => part.id === id)?.shape
  return shape && shape.kind !== 'box' ? 2 * shape.radius : DEFAULT_PATH_METRES
}

const exitOf = (hit: BodyHit, depth: number): Vec3 => {
  const [x, y, z] = hit.direction ?? [0, 0, -1]
  return [hit.point[0] + x * depth, hit.point[1] + y * depth, hit.point[2] + z * depth]
}

/** Bullets, blades and blunt blows: resolve the segment, the protection, the penetration, the points; then the detail's rule decides. */
const direct = ({ ops, hit, setup, worn, localPoint, describe }: ApplyBlowParams): HitReport => {
  const { body, spec, rules } = ops
  const caliber = hit.caliberId === undefined ? undefined : setup.calibers.get(hit.caliberId)
  const projectile = hit.type === 'ballistic' ? projectileOf(hit, caliber) : undefined
  const id = resolveSegment(body, describe(), hit.part, localPoint)
  const region = regionOfSegment(body, id)
  const slots = segmentNode(body.detail === 'regions' ? (REGION_SEGMENTS[region][0] as SegmentId) : id).slots
  const protection = protect({ layers: layersOn(worn, slots, body.consumed), model: setup.model, ...(projectile ? { projectile } : {}) })
  if (protection.absorbedBy) {
    body.consumed.add(protection.absorbedBy)
    ops.emit({ type: 'debris', part: id, kind: 'sparks', point: hit.point, normal: [0, 1, 0], count: ABSORBED_SPARKS, speed: 3 })
    return report(ops, { part: id, points: 0, absorbedBy: protection.absorbedBy })
  }
  const rawPoints = resolvePoints(hit, caliber, rules)
  const points = rawPoints * protection.ballistic
  const cut = cutOf(hit, projectile, rules)
  const segment = segmentOf(body, id)
  const resistance = segmentResistance({ kind: segment.kind, bodyCount: spec.bodyCount, protection: protection.resistance })
  const through = setup.model.id === 'physical' && projectile !== undefined && projectile.force > resistance
  const exitEnergy = through && projectile ? (hit.energy ?? 0) * energyKept(projectile.force, resistance) : 0
  if (projectile) {
    const depth = pathThrough(describe(), id)
    ops.emit({ type: 'hole', part: id, hole: { point: localPoint, normal: [0, 0, 1], diameter: (hit.caliber ?? 9) * METRES_PER_MM, through }, worldPoint: hit.point, ...(through ? { exitPoint: exitOf(hit, depth) } : {}) })
  }
  const common = { points, cut, damageType: hit.type, model: setup.model, headResistance: HEAD_RESISTANCE, ...(projectile ? { projectile } : {}) }
  const result =
    body.detail === 'regions'
      ? regionRule(ops, { ...common, points: rawPoints, region, protection })
      : (SEGMENT_RULES[rules.segmentRule] ?? kitRule)(ops, {
          ...common,
          segment,
          explosive: false,
          big: points > rules.blast.bigPoints,
          limbFactor: spec.limbFactor * protection.limbs,
          ...(hit.woundAtPoint === false ? {} : { point: hit.point }),
        })
  return report(ops, { part: id, points, through, exitEnergy }, result)
}

export const applyBlow = (params: ApplyBlowParams): HitReport => {
  if (params.hit.type === 'fire' || params.hit.type === 'heat') return burn(params)
  if (params.hit.type === 'explosive') return blast(params)
  return direct(params)
}
