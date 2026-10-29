/** The P7 physical penetration rule, in plain arithmetic: the line a shot travels through bodies. */
import type { PhysicalPenetration } from './decisions'

export type CaliberInput = { readonly id: string; readonly diameter: number; readonly bulletGrams: number; readonly muzzleSpeed: number }

export type PenetrationLine = {
  readonly caliber: string
  readonly force: number
  readonly bodies: number
  /** Share of the energy the shot keeps after the first torso. */
  readonly energyKeptFirstBody: number
}

const round = (value: number, places: number): number => Math.round(value * 10 ** places) / 10 ** places

export const torsoResistance = (rule: PhysicalPenetration): number =>
  rule.torsoPath.fleshCentimetres * rule.tissuePerCentimetre.flesh + rule.torsoPath.boneCentimetres * rule.tissuePerCentimetre.bone

/** P = sqrt(E * m / A): E in joules at the muzzle, m in grams, A the cross-section in mm^2. */
export const penetrationForce = (caliber: CaliberInput): number => {
  const energy = 0.5 * (caliber.bulletGrams / 1000) * caliber.muzzleSpeed ** 2
  const area = (Math.PI * caliber.diameter ** 2) / 4
  return Math.sqrt((energy * caliber.bulletGrams) / area)
}

/** Bodies hit in a line of torsos: each one is hit while force is left, then costs its resistance. */
export const bodiesHit = (force: number, resistance: number): number => {
  let remaining = force
  let bodies = 0
  while (remaining > 0) {
    bodies += 1
    remaining -= resistance
  }
  return bodies
}

export const penetrationLine = (caliber: CaliberInput, rule: PhysicalPenetration): PenetrationLine => {
  const force = penetrationForce(caliber)
  const resistance = torsoResistance(rule)
  return { caliber: caliber.id, force: round(force, 2), bodies: bodiesHit(force, resistance), energyKeptFirstBody: round(force / (force + resistance), 2) }
}
