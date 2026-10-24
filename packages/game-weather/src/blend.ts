import type { StateValueKey, StateValues, WeatherState } from './types'

export const STATE_VALUE_KEYS: readonly StateValueKey[] = [
  'rain',
  'drops',
  'sheets',
  'windX',
  'windZ',
  'gust',
  'fogFar',
  'fogDensity',
  'skyScale',
  'visibility',
  'humidity',
  'temperatureDeltaC',
  'wetness',
  'hearingScale',
  'footstepScale',
  'dryingScale',
  'debrisPush',
  'haze',
  'mistPerSecond',
  'ashPerSecond',
]

export function valuesOf(state: WeatherState): StateValues {
  const values: Record<string, number> = {}
  for (const key of STATE_VALUE_KEYS) values[key] = state[key]
  return values as unknown as StateValues
}

/** Every number between two states: `progress` 0 is `from`, 1 is `to`. */
export function blendValues(from: StateValues, to: StateValues, progress: number): StateValues {
  const amount = Math.min(1, Math.max(0, progress))
  const blended: Record<string, number> = {}
  for (const key of STATE_VALUE_KEYS) blended[key] = from[key] + (to[key] - from[key]) * amount
  return blended as unknown as StateValues
}
