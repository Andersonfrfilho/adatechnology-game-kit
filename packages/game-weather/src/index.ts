/**
 * @adatechnology/game-weather: pure, seeded weather. States (clear to typhoon) with the numbers of the teams' pages, climates that move between
 * them in game time (2 to 6 hours each, fronts from the west), lightning with the thunder delay, ground wetness, what the weather means for
 * sight, hearing and footsteps, the heat index and the day-night formula. No three.js, no audio, no game content: renderers and sound read it.
 */
export { createWeather, createTimeline, DEFAULT_START_HOUR } from './weather'
export type { TimelineOptions, Weather, WeatherOptions, WeatherTimeline } from './weather'
export { CLIMATES, WEATHER_STATES, createWeatherRegistry } from './registry'
export type { RegistryOptions, WeatherRegistry } from './registry'
export { blendValues, STATE_VALUE_KEYS, valuesOf } from './blend'
export { createScheduler } from './scheduler'
export type { Scheduler } from './scheduler'
export { FLASH_END_SECONDS, SPEED_OF_SOUND, createLightningStream, flashIntensity, thunderDelay } from './lightning'
export type { LightningStream } from './lightning'
export { DEFAULT_DRY_OUT_SECONDS, DEFAULT_WET_RISE_SECONDS, createWetness } from './wetness'
export type { Wetness, WetnessOptions } from './wetness'
export { DRY_VISIBILITY_METERS, NIGHT_SIGHT_LOSS, deriveEffects } from './effects'
export type { EffectsInput } from './effects'
export { heatIndexC, heatStress } from './heat'
export { DAY_REAL_SECONDS, DEFAULT_TIME_SCALE, GAME_DAY_SECONDS, dayFractionAt, daylight } from './daylight'
export type { Daylight } from './daylight'
export { createRng, createStream, streamSeed } from './rng'
export type {
  Climate,
  DeepPartial,
  LightningConfig,
  StateValueKey,
  StateValues,
  Strike,
  WeatherEffects,
  WeatherEventMap,
  WeatherSample,
  WeatherState,
} from './types'

export { createWeatherTestModule } from './bench/module'
export type { WeatherScenarioLike, WeatherTestModule, WeatherTestModuleOptions } from './bench/module'
export { weatherBenchTextOf } from './bench/locale'
export type { WeatherBenchText } from './bench/locale'
