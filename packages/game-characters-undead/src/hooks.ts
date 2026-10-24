import type { UndeadRules } from './rules'
import type { UndeadType } from './types'

/** What the game should do about a death or a hit that the undead rules decide. Plain data: the game draws the cloud and plays the sound. */
export type UndeadEffect =
  /** A bloater's burst (G 67053): a cloud of `radius` metres for `seconds`, and `noise` metres of noise. */
  | { readonly kind: 'cloud'; readonly radius: number; readonly seconds: number; readonly color: number }
  | { readonly kind: 'blind'; readonly radius: number; readonly seconds: number; readonly scentSeconds: number }
  | { readonly kind: 'noise'; readonly radius: number }

type Ability = UndeadType['abilities']

const num = (abilities: Ability, name: string): number | undefined => (typeof abilities[name] === 'number' ? (abilities[name] as number) : undefined)

/** The effects of a body's death: the bloater bursts (cloud 4 m, blind 5 s and a smell for 60 s near it, noise 15 m). Empty for every other type. */
export const deathEffects = (type: UndeadType, rules: UndeadRules): UndeadEffect[] => {
  const radius = num(type.abilities, 'burstRadiusMetres')
  if (radius === undefined) return []
  return [
    { kind: 'cloud', radius, seconds: rules.burst.cloudSeconds, color: rules.burst.cloudColor },
    { kind: 'blind', radius, seconds: num(type.abilities, 'blindSeconds') ?? 0, scentSeconds: num(type.abilities, 'scentSeconds') ?? 0 },
    { kind: 'noise', radius: num(type.abilities, 'burstNoiseMetres') ?? 0 },
  ]
}

/** Fire does nothing to a body with `fireImmune` (the charred). */
export const isFireImmune = (type: UndeadType): boolean => type.abilities.fireImmune === true

/** Fraction of its health a body loses when it enters water (the charred: 0.3), 0 for the rest. */
export const waterHealthLoss = (type: UndeadType): number => num(type.abilities, 'waterHealthLoss') ?? 0

/** Multiplier of the target area of the head (the brute's skull is harder to hit: 0.6), 1 for the rest. */
export const headAreaFactor = (type: UndeadType): number => num(type.abilities, 'headshotAreaMultiplier') ?? 1

/** Multiplier of the damage the body does to a door (the brute: 3), 1 for the rest. */
export const doorDamageFactor = (type: UndeadType): number => num(type.abilities, 'doorDamageMultiplier') ?? 1
