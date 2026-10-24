import type { BodyRegion } from '@adatechnology/game-contracts'

import teamGame from '../presets/team-game.json'
import type { SegmentId } from './segment-tree'

/** The regions that keep their own hit points in the crowd model (the torso has none: torso hits go to vitality). */
export type LimbRegion = Exclude<BodyRegion, 'torso'>

export const LIMB_REGIONS: readonly LimbRegion[] = ['head', 'armL', 'armR', 'legL', 'legR']

/** The game's region numbers (`SEG`): hit points of the head, of an arm and of a leg. */
export const REGION_HIT_POINTS: Readonly<Record<LimbRegion, number>> = {
  head: teamGame.segments.head,
  armL: teamGame.segments.arm,
  armR: teamGame.segments.arm,
  legL: teamGame.segments.leg,
  legR: teamGame.segments.leg,
}

/** The segments that make up each region, and the one that names it in events (the first). */
export const REGION_SEGMENTS: Readonly<Record<BodyRegion, readonly SegmentId[]>> = {
  head: ['head', 'jaw', 'neck'],
  torso: ['torso', 'pelvis'],
  armL: ['upperArmL', 'forearmL', 'handL'],
  armR: ['upperArmR', 'forearmR', 'handR'],
  legL: ['thighL', 'shinL', 'footL'],
  legR: ['thighR', 'shinR', 'footR'],
}

export const BODY_REGIONS: readonly BodyRegion[] = ['head', 'torso', 'armL', 'armR', 'legL', 'legR']

export const isBodyRegion = (value: string): value is BodyRegion => (BODY_REGIONS as readonly string[]).includes(value)
