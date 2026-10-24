import { heatIndexC, heatStress } from './heat'
import type { StateValues, WeatherEffects } from './types'

/** Gameplay visibility of a dry day (the game's dry fog far, jogo.js L69141): `sightScale` is the visibility against it. */
export const DRY_VISIBILITY_METERS = 220
/** jogo.js L66872: sight is `perc[0] × (1 − 0.4 × nightF)`. */
export const NIGHT_SIGHT_LOSS = 0.4

export type EffectsInput = {
  readonly values: StateValues
  readonly nightFactor: number
  readonly temperatureC: number
  readonly humidityPercent: number
  readonly lightningReveal: number
}

/** What the weather means for gameplay, as numbers for whoever has eyes, ears or feet in the world (perception, footsteps, heat). */
export function deriveEffects(input: EffectsInput): WeatherEffects {
  const { values, nightFactor } = input
  const weatherSight = Math.min(1, Math.max(0, values.visibility / DRY_VISIBILITY_METERS))
  const heatIndex = heatIndexC(input.temperatureC, input.humidityPercent)
  return {
    visibility: values.visibility,
    sightScale: weatherSight * (1 - NIGHT_SIGHT_LOSS * nightFactor),
    hearingScale: values.hearingScale,
    footstepScale: values.footstepScale,
    heatIndexC: heatIndex,
    heatStress: heatStress(heatIndex),
    lightningReveal: input.lightningReveal,
    dryingScale: values.dryingScale,
    debrisPush: values.debrisPush,
  }
}
