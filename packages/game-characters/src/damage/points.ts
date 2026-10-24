import type { DamageType } from '@adatechnology/game-contracts'

import type { BallisticClass, BodyHit, CaliberEntry, DamageRules, ProjectileInfo } from './types'

/** Deterministic mulberry32 stream in [0, 1). */
export const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** Damage points of a blow from its energy in joules: `coefficient · E^exponent` (9×19 → 35, 7.62×39 → 59, .308 → 71.7). */
export const pointsFromEnergy = (energy: number, rules: Pick<DamageRules, 'points'>): number => (energy > 0 ? rules.points.coefficient * energy ** rules.points.exponent : 0)

/** The caller's points, else the calibre table's, else the energy formula. */
export const resolvePoints = (hit: BodyHit, caliber: CaliberEntry | undefined, rules: Pick<DamageRules, 'points'>): number => hit.points ?? caliber?.points ?? pointsFromEnergy(hit.energy ?? 0, rules)

/** One draw of ±`spread` on the points (none when the spread is 0, so the stream is not touched). */
export const spreadPoints = (points: number, spread: number, random: () => number): number => (spread > 0 ? points * (1 - spread + random() * 2 * spread) : points)

const DEFAULT_PROJECTILE_GRAMS = 8
const RIFLE_JOULES = 1000

/** P = √(E·m/A): E in joules, m in grams, A the cross-section in mm². */
export const penetrationForce = (energy: number, grams: number, diameterMm: number): number => {
  const area = (Math.PI * diameterMm ** 2) / 4
  return area > 0 && energy > 0 ? Math.sqrt((energy * grams) / area) : 0
}

/** What a ballistic hit is (force, class, skull range, pellets, distance), from the hit and the calibre table. */
export const projectileOf = (hit: BodyHit, caliber: CaliberEntry | undefined): ProjectileInfo => {
  const pellets = hit.pellets ?? caliber?.pellets ?? 1
  const energy = hit.energy ?? 0
  const fallback: BallisticClass = energy > RIFLE_JOULES ? 'rifle' : 'pistol'
  return {
    force: penetrationForce(energy, hit.mass ?? DEFAULT_PROJECTILE_GRAMS, hit.caliber ?? 9),
    class: caliber?.class ?? fallback,
    skullRange: caliber?.skullRange ?? 1,
    pellets,
    distance: hit.distance ?? 0,
  }
}

/** `hit.cut`, else the default of its damage type (a bullet by class: pistol 0.15, buckshot 0.75, rifle 0.45). */
export const cutOf = (hit: BodyHit, projectile: ProjectileInfo | undefined, rules: Pick<DamageRules, 'defaultCut'>): number => {
  if (hit.cut !== undefined) return hit.cut
  const type: DamageType = hit.type
  if (type === 'ballistic' && projectile) return rules.defaultCut.ballistic[projectile.pellets > 1 ? 'buckshot' : projectile.class]
  if (type === 'slash' || type === 'blunt' || type === 'explosive') return rules.defaultCut[type]
  return 0
}
