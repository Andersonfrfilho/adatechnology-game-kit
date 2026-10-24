import type { BodyRegion, SegmentKind } from '@adatechnology/game-contracts'

import { PHYSICAL_RULES, TEAM_GAME_RULES } from './defaults'
import type { PenetrationModel } from './types'

/** P = √(E·m/A) against the resistance of the path; a protection layer stops a projectile whose force is not above its resistance. */
export const PHYSICAL_PENETRATION: PenetrationModel = {
  id: 'physical',
  stops: (layer, projectile) => projectile.force <= (layer.ballistic?.resistance ?? 0),
  piercesSkull: (projectile, headResistance) => projectile.force > headResistance,
}

/** The game's rule: pistol-class rounds are stopped by a vest or a helmet; the skull is pierced within the calibre's `cranio` range. */
export const TEAM_GAME_PENETRATION: PenetrationModel = {
  id: 'team-game',
  stops: (_layer, projectile) => projectile.class === 'pistol',
  piercesSkull: (projectile) => projectile.skullRange === 1 || projectile.distance <= projectile.skullRange,
}

export const PENETRATION_MODELS = { physical: PHYSICAL_PENETRATION, 'team-game': TEAM_GAME_PENETRATION } as const

const { tissuePerCentimetre, torsoPath, regionFactor } = PHYSICAL_RULES

/** Resistance of a torso path: flesh 22 cm × 0.25 + bone 2 cm × 1.0 = 7.5. */
export const TORSO_RESISTANCE = torsoPath.fleshCentimetres * tissuePerCentimetre.flesh + torsoPath.boneCentimetres * tissuePerCentimetre.bone

const HEAD_KINDS: ReadonlySet<SegmentKind> = new Set(['head', 'jaw', 'neck'])
const TORSO_KINDS: ReadonlySet<SegmentKind> = new Set(['torso', 'pelvis'])

export type ResistanceParams = { readonly kind: SegmentKind; readonly bodyCount: number; readonly protection: number }

/** R of the path through a segment: torso 7.5 (× the body count of a brute), head 0.7×, limbs 0.5×, plus the protection worn over it. */
export const segmentResistance = ({ kind, bodyCount, protection }: ResistanceParams): number => {
  if (TORSO_KINDS.has(kind)) return TORSO_RESISTANCE * regionFactor.torso * bodyCount + protection
  if (HEAD_KINDS.has(kind)) return TORSO_RESISTANCE * regionFactor.head + protection
  return TORSO_RESISTANCE * regionFactor.limb + protection
}

/** Share of the energy a projectile of force `force` keeps after a path of resistance `resistance`: P/(P+R). */
export const energyKept = (force: number, resistance: number): number => (force > 0 ? force / (force + resistance) : 0)

/** Penetration points a region costs in the game (`custo`): head 0.7, torso 1 (a brute 2), limb 0.5. */
export const teamGameCost = (region: BodyRegion, bodyCount: number): number => {
  const cost = TEAM_GAME_RULES.regionCost
  if (region === 'head') return cost.head
  if (region === 'torso') return bodyCount > 1 ? cost.bruteTorso : cost.torso
  return cost.limb
}

/** The game's falloff: full damage up to the effective range, then linear down to half at twice the range, never below half. */
export const teamGameFalloff = (distance: number, range: number): number => {
  const floor = TEAM_GAME_RULES.falloff.atTwiceRange
  return distance <= range * TEAM_GAME_RULES.falloff.fullAtRange ? 1 : Math.max(floor, 1 - ((distance - range) / range) * (1 - floor))
}
