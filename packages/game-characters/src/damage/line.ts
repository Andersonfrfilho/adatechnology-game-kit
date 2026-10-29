import type { DestructionEvent, Vec3 } from '@adatechnology/game-contracts'

import { isBodyRegion } from '../body/regions'
import { isSegmentId, segmentNode } from '../body/segment-tree'
import type { DamageCharacter } from './damage-character'
import { TEAM_GAME_RULES } from './defaults'
import { energyKept, teamGameCost, teamGameFalloff } from './penetration'
import { penetrationForce } from './points'
import type { CaliberEntry } from './types'

/** One body in the line of fire, `distance` metres from the muzzle. */
export type LineTarget = { readonly character: DamageCharacter; readonly part: string; readonly distance: number; readonly point?: Vec3 }

/** What the line needs from a shot (a `Shot` of game-weapons fits). */
export type LineShot = {
  readonly energyAt: (distance: number) => number
  /** Projectile grams. */
  readonly mass: number
  /** Diameter in mm. */
  readonly caliber: number
  readonly caliberId?: string
  readonly source?: string
}

export type LineHit = { readonly index: number; readonly points: number; readonly energy: number; readonly killed: boolean; readonly headshot: boolean; readonly events: DestructionEvent[] }
export type LineResult = { readonly hits: LineHit[]; /** 1-based index of the last body hit (0: none). */ readonly stoppedAt: number }

export type PenetrateLineParams = {
  readonly model: 'physical' | 'team-game'
  readonly shot: LineShot
  readonly targets: readonly LineTarget[]
  readonly calibers: ReadonlyMap<string, CaliberEntry>
}

/** After a kill the game restarts the ray 0.3 m past the body and measures the next distances from there (`shootRay`). */
const RESTART_METRES = 0.3

const regionOfPart = (part: string) => (isSegmentId(part) ? segmentNode(part).region : isBodyRegion(part) ? part : 'torso')

const lineHit = (index: number, target: LineTarget, fields: { points: number; energy: number; events: DestructionEvent[] }): LineHit => ({
  index,
  ...fields,
  killed: !target.character.alive,
  headshot: target.character.lastHit?.headshot ?? false,
})

/** The game's `shootRay`: penetration points spent per body (head 0.7, torso 1, a brute 2, limb 0.5), 75 % of the damage carried on. */
const teamGameLine = ({ shot, targets, calibers }: PenetrateLineParams): LineResult => {
  const caliber = shot.caliberId === undefined ? undefined : calibers.get(shot.caliberId)
  if (caliber?.penetration === undefined || caliber.points === undefined) throw new Error(`game-characters: the team-game line needs a calibre with points and penetration ("${shot.caliberId}")`)
  let penetration = caliber.penetration
  let points = caliber.points
  let origin = 0
  const hits: LineHit[] = []
  for (const [index, target] of targets.entries()) {
    if (!target.character.alive || target.distance - origin <= 0) continue
    const distance = target.distance - origin
    const dealt = points * teamGameFalloff(distance, caliber.effectiveRangeMetres ?? Infinity)
    const events = target.character.hit({ type: 'ballistic', point: target.point ?? [0, 0, 0], part: target.part, points: dealt, caliberId: caliber.id, distance, ...(shot.source ? { source: shot.source } : {}) })
    hits.push(lineHit(index, target, { points: dealt, energy: shot.energyAt(target.distance), events }))
    penetration -= teamGameCost(regionOfPart(target.part), target.character.spec.bodyCount)
    points *= TEAM_GAME_RULES.damageKeptPerBody
    if (penetration <= 0) break
    if (!target.character.alive) origin = target.distance + RESTART_METRES
  }
  return { hits, stoppedAt: hits.length === 0 ? 0 : (hits[hits.length - 1]?.index ?? -1) + 1 }
}

/** P7: the force P = √(E·m/A) hits a body while it is above 0, loses the body's resistance R and keeps P/(P+R) of the energy. */
const physicalLine = ({ shot, targets }: PenetrateLineParams): LineResult => {
  const first = targets[0]
  let force = first ? penetrationForce(shot.energyAt(first.distance), shot.mass, shot.caliber) : 0
  let kept = 1
  const hits: LineHit[] = []
  for (const [index, target] of targets.entries()) {
    if (force <= 0) break
    if (!target.character.alive) continue
    const energy = shot.energyAt(target.distance) * kept
    const events = target.character.hit({ type: 'ballistic', point: target.point ?? [0, 0, 0], part: target.part, energy, mass: shot.mass, caliber: shot.caliber, distance: target.distance, ...(shot.caliberId ? { caliberId: shot.caliberId } : {}) })
    hits.push(lineHit(index, target, { points: target.character.lastHit?.points ?? 0, energy, events }))
    const resistance = target.character.resistanceOf(target.part)
    kept *= energyKept(force, resistance)
    force -= resistance
  }
  return { hits, stoppedAt: hits.length === 0 ? 0 : (hits[hits.length - 1]?.index ?? -1) + 1 }
}

/** A shot through a line of bodies, nearest first. Each body takes the hit through its own damage model. */
export const penetrateLine = (params: PenetrateLineParams): LineResult => (params.model === 'team-game' ? teamGameLine(params) : physicalLine(params))
