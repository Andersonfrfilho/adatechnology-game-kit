import { weaponSpeed } from './fire'
import type { Arsenal, CaliberDef, WeaponAction, WeaponCategory, WeaponDef, WeaponRules } from './types'

const SUBSTEP_SECONDS = 1 / 60
const MAX_ROUNDS_SEARCHED = 100_000

type HeatRules = WeaponRules['heat']

/** Kg of steel that heat up with the shots: barrel length times kg per metre of the category (or the weapon's own `barrelMass`), times the barrels a rotary gun shares. */
export const barrelMassOf = (def: WeaponDef, rules: HeatRules): number => {
  const dimensions = def.dimensions
  const kilogramsPerMetre = rules.barrelKilogramsPerMetre[def.category as WeaponCategory] ?? rules.barrelFallback.kilogramsPerMetre
  const single = dimensions?.barrelMass ?? (dimensions?.barrel ?? rules.barrelFallback.metres) * kilogramsPerMetre
  return single * (dimensions?.barrels ?? 1)
}

/** Seconds in which the barrel loses 1/e of its excess temperature. */
export const coolingTimeConstant = (barrelMass: number, rules: HeatRules): number => rules.cooling.baseSeconds + rules.cooling.secondsPerKilogram * barrelMass

/** Cools a barrel: Newton's law, dT/dt = -T/tau, integrated exactly (the Galeria's linear Euler steps when `rules.gallery` is set). */
export const decayHeat = (heat: number, seconds: number, barrelMass: number, rules: HeatRules): number => {
  if (heat <= 0) return 0
  if (rules.gallery) return decayGallery(heat, seconds, rules.gallery)
  return heat * Math.exp(-seconds / coolingTimeConstant(barrelMass, rules))
}

const decayGallery = (heat: number, seconds: number, gallery: NonNullable<HeatRules['gallery']>): number => {
  const steps = Math.max(1, Math.ceil(seconds / SUBSTEP_SECONDS - 1e-9))
  const step = seconds / steps
  let current = heat
  for (let i = 0; i < steps && current > 0; i++) current = Math.max(0, current - step * (gallery.decayBase + current * gallery.decayPerPoint))
  return current
}

export type HeatPerRoundParams = {
  readonly action: WeaponAction
  readonly caliber: CaliberDef | null
  /** Muzzle energy of the whole round in joules (all the pellets of a shell). */
  readonly energy: number
  readonly barrelMass: number
  readonly rules: HeatRules
}

/** °C one round adds to the barrel: the share of its muzzle energy that ends in the steel over the heat capacity of the barrel. A rocket adds a fixed amount; a bow has no cartridge and adds none. */
export const heatPerRound = ({ action, caliber, energy, barrelMass, rules }: HeatPerRoundParams): number => {
  if (action.kind === 'launcher') return rules.perRocket
  const caseType = caliber?.caseType
  if (!caseType) return 0
  if (rules.gallery) return rules.gallery.perShot[caseType]
  return (rules.barrelShare[caseType] * energy) / (barrelMass * rules.specificHeat)
}

export type RoundsToWarningParams = {
  readonly def: WeaponDef
  readonly caliber: CaliberDef
  /** Muzzle energy of one round in joules (one pellet when `caliber.pellets` says more). */
  readonly energy: number
  readonly rpm: number
  readonly rules: HeatRules
}

/** Rounds fired from cold at `rpm`, with no pause for reloads, before the barrel reaches the warning; Infinity when the cooling holds it below. */
export const roundsToWarning = ({ def, caliber, energy, rpm, rules }: RoundsToWarningParams): number => {
  if (def.action.kind !== 'firearm' || rpm <= 0) return Infinity
  const barrelMass = barrelMassOf(def, rules)
  const perRound = heatPerRound({ action: def.action, caliber, energy: energy * (caliber.pellets ?? 1), barrelMass, rules })
  const interval = 60 / rpm
  let heat = 0
  for (let round = 1; round <= MAX_ROUNDS_SEARCHED; round++) {
    heat = decayHeat(heat, round === 1 ? 0 : interval, barrelMass, rules) + perRound
    if (heat >= rules.faultFrom) return round
  }
  return Infinity
}

/** `roundsToWarning` for a weapon of the arsenal, from the muzzle energy of its own calibre and barrel at its listed rate of fire; Infinity for what has no cartridge or never heats up that far. */
export const roundsToWarningOf = (arsenal: Pick<Arsenal, 'weapons' | 'calibers' | 'rules'>, weaponId: string): number => {
  const def = arsenal.weapons.get(weaponId)
  if (!def || def.action.kind !== 'firearm') return Infinity
  const caliber = arsenal.calibers.get(def.action.caliber)
  if (!caliber) return Infinity
  const energy = 0.5 * (caliber.bulletGrams / 1000) * weaponSpeed(def.action, caliber) ** 2
  return roundsToWarning({ def, caliber, energy, rpm: def.action.rpm, rules: arsenal.rules.heat })
}

/** Each shot in the last few seconds makes the next one louder, up to a cap. */
export const burstNoise = (base: number, recentShots: number, rules: WeaponRules['noiseBurst']): number => base * (1 + Math.min(rules.cap, rules.step * recentShots))
