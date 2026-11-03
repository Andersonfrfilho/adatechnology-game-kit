import { SALT, unit } from './identity'
import type { CrowdPersonalityOptions } from './physics/options'
import type { CrowdStore } from './store'

const GAIT_WEIGHTS = [6, 1, 1, 1, 1, 2] as const

/** A triangular draw between the two ends of the range, from two independent counter-based draws of the agent. */
const triangular = (identity: number, salt: number, range: readonly [number, number]): number => range[0] + (range[1] - range[0]) * ((unit(identity, 0, salt) + unit(identity, 1, salt)) / 2)

const weighted = (identity: number, salt: number, weights: readonly number[]): number => {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let pick = unit(identity, 0, salt) * total
  for (let index = 0; index < weights.length; index++) {
    pick -= weights[index]!
    if (pick < 0) return index
  }
  return weights.length - 1
}

/** No personality: every factor is neutral, so the maths of the game does not change. */
export function applyNeutralPersonality(store: CrowdStore, i: number): void {
  store.stability[i] = store.tripFactor[i] = store.driveFactor[i] = store.cadenceFactor[i] = store.aggression[i] = 1
  store.reaction[i] = 0
  store.idle[i] = 0
  store.gaitStyle[i] = 0
}

/**
 * The personality of an agent (T4b.8), all of it from its identity and never from the shared random stream: a speed factor that multiplies the chase and wander speeds,
 * a reaction time, the stability, trip and drive factors that move its thresholds of falling and climbing, the cadence of its walk, its aggression, a gait and an idle.
 */
export function applyPersonality(store: CrowdStore, i: number, options: Required<CrowdPersonalityOptions>): void {
  const identity = store.identity[i]!
  const speed = triangular(identity, SALT.SPEED, options.speed)
  store.chaseSpeed[i]! *= speed
  store.wanderSpeed[i]! *= speed
  store.reaction[i] = triangular(identity, SALT.REACTION, options.reaction)
  store.stability[i] = triangular(identity, SALT.STABILITY, options.stability)
  store.tripFactor[i] = triangular(identity, SALT.TRIP_FACTOR, options.trip)
  store.driveFactor[i] = triangular(identity, SALT.DRIVE, options.drive)
  store.cadenceFactor[i] = triangular(identity, SALT.CADENCE, options.cadence)
  store.aggression[i] = triangular(identity, SALT.AGGRESSION, options.aggression)
  store.idle[i] = weighted(identity, SALT.IDLE, options.idle)
  store.gaitStyle[i] = weighted(identity, SALT.GAIT, GAIT_WEIGHTS)
}
