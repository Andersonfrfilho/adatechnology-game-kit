import type { Detonation } from './explosive-body'
import { normalize } from './rng'
import type { Use, Vec3 } from './types'
import { dot, length, subtract } from './vec'

export interface BlastEffect {
  /** `lethal` kills and dismembers, `injury` wounds, `none` is out of reach (or behind a directional charge). */
  readonly zone: 'lethal' | 'injury' | 'none'
  readonly distance: number
  /** 1 in the lethal zone, falling linearly to 0 at the edge of the injury zone. */
  readonly falloff: number
  /** Seconds of stun for whoever is in reach (flashbang). */
  readonly stunSeconds: number
}

const OUT_OF_REACH: BlastEffect = { zone: 'none', distance: Infinity, falloff: 0, stunSeconds: 0 }

const insideCone = (offset: Vec3, facing: Vec3, halfAngleDeg: number): boolean => {
  const distance = length(offset)
  if (distance <= 1e-9) return true
  return dot(offset, normalize(facing)) / distance >= Math.cos((halfAngleDeg * Math.PI) / 180)
}

/** What a detonation does to something at `target`: the zone, how hard, and the stun. A directional charge only reaches inside its cone. */
export const blastEffect = (detonation: Detonation, target: Vec3): BlastEffect => {
  const offset = subtract(target, detonation.point)
  const distance = length(offset)
  const { lethalRadius, injuryRadius, cone } = detonation
  const reach = cone ? Math.min(injuryRadius, cone.length) : injuryRadius
  if (distance > reach) return OUT_OF_REACH
  if (cone && !insideCone(offset, detonation.direction, cone.halfAngleDeg)) return OUT_OF_REACH
  const stunSeconds = detonation.stunSeconds ?? 0
  if (distance <= lethalRadius) return { zone: 'lethal', distance, falloff: 1, stunSeconds }
  const span = reach - lethalRadius
  return { zone: 'injury', distance, falloff: span > 0 ? 1 - (distance - lethalRadius) / span : 1, stunSeconds }
}

/** How much of the blast behind a launcher reaches `target`: 0 outside the cone or the radius, falling linearly from 1 at the tube. */
export const backblastEffect = (use: Extract<Use, { kind: 'backblast' }>, target: Vec3): number => {
  const offset = subtract(target, use.origin)
  const distance = length(offset)
  if (distance > use.radius || !insideCone(offset, use.direction, use.halfAngleDeg)) return 0
  return 1 - distance / use.radius
}
