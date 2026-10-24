import type { ChainDelay, ExplosionChain, PartSpec } from './types'

/** What can set an explosive part off from outside, in the order a hit can carry it. */
export type ChainTrigger = 'shot' | 'fire' | 'explosion'

/** Temperature in °C that primes a part with `chain.fire` when its `explodes.atC` is not set. */
export const FIRE_PRIME_C = 300

/** Seconds from a trigger to the blast: a number is fixed, `[min, max]` is drawn from the world seed (one draw). */
export const drawChainDelay = (delay: ChainDelay, random: () => number): number => {
  if (typeof delay === 'number') return delay
  const [min, max] = delay
  return min + random() * (max - min)
}

/** The delay `spec` gives for `trigger`, or undefined when the part does not answer to it. */
export const chainDelayOf = (spec: PartSpec, trigger: ChainTrigger): ChainDelay | undefined => spec.explodes?.chain?.[trigger]

/** Fraction of the hit points a shot must have taken off before it primes the part. */
export const shotDamageFractionOf = (spec: PartSpec): number => spec.explodes?.chain?.shotDamageFraction ?? 0

/** The numbers of an explosive that sits in the world, as `game-weapons` gives them (`ExplosiveDef` fits). */
export interface WorldExplosive {
  readonly energy: number
  /** Metres within which the blast reaches other parts (and primes theirs). */
  readonly injuryRadius: number
  readonly chain?: ExplosionChain
}

export interface ExplosivePartOptions {
  /** Temperature in °C at which fire primes (or sets off) the part; default `FIRE_PRIME_C` when the explosive answers to fire. */
  readonly atC?: number
}

/**
 * A part that explodes with the energy and reach of `explosive` and answers to what `explosive.chain` says: a bullet, fire or a blast
 * nearby primes it and it goes off after the delay. `part` is everything else about the part (shape, material, position, fluid inside).
 */
export const explosivePart = (explosive: WorldExplosive, part: Omit<PartSpec, 'explodes'>, options: ExplosivePartOptions = {}): PartSpec => ({
  ...part,
  explodes: {
    energy: explosive.energy,
    radius: explosive.injuryRadius,
    ...(options.atC !== undefined ? { atC: options.atC } : {}),
    ...(explosive.chain ? { chain: { ...explosive.chain } } : {}),
  },
})
