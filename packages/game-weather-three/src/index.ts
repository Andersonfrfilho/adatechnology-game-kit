/**
 * @adatechnology/game-weather-three: the picture of `@adatechnology/game-weather` in three.js. The game's rain curtain (14 000 GPU points in a 70 m box), the near rain
 * and its splashes and rings, mist and ash on the pools of `@adatechnology/game-vfx`, linear and exponential fog with zone fog, the sky that dims in rain, lightning,
 * headlights in rain and a heat haze, plus the layers a weather bench shows.
 */
export { createWeatherRenderer, WEATHER_LAYERS } from './renderer'
export type { WeatherLayerId, WeatherRenderer, WeatherRendererOptions } from './renderer'
export { createRainCurtain, rainCurtainPositions, RAIN_CURTAIN, RAIN_CURTAIN_FRAGMENT, RAIN_CURTAIN_FULL_AT, RAIN_CURTAIN_PROFILES, RAIN_CURTAIN_VERTEX } from './rain-curtain'
export type { RainCurtain, RainCurtainOptions } from './rain-curtain'
export { createNearRain, SPLASH_FROM_MM } from './rain-near'
export type { NearRain, NearRainOptions } from './rain-near'
export { ASH, createFog, densityForFar, emitAirborne, FOG_EXP_FROM, FOG_NEAR, FOG_ZONE_NEAR, fogOf, MIST } from './fog'
export type { Fog, FogValues } from './fog'
export { createSky, SKY_DAY, SKY_NIGHT, ZONE_FOG_DEFAULTS, ZONE_LIGHT } from './sky'
export type { Sky } from './sky'
export { createLightning, LIGHTNING } from './lightning'
export type { Lightning } from './lightning'
export { createHeadlights, defaultHeadlightRule, HEADLIGHTS } from './headlights'
export type { HeadlightRules, Headlights } from './headlights'
export { createHeatHaze, HEAT_HAZE, HEAT_HAZE_FRAGMENT, HEAT_HAZE_VERTEX } from './heat-haze'
export type { HeatHaze } from './heat-haze'
/** @deprecated import from '@adatechnology/game-weather-three/testing' */
export { createWeatherVisual } from './testing'
/** @deprecated import from '@adatechnology/game-weather-three/testing' */
export type { RigVehicles, WeatherVisualOptions } from './testing'
/** @deprecated import from '@adatechnology/game-weather-three/testing' */
export { weatherVisualTextOf } from './testing'
/** @deprecated import from '@adatechnology/game-weather-three/testing' */
export type { WeatherVisualText } from './testing'
export type { ThreeLib, Vec3, WeatherProfileName, WeatherSource, ZoneFog } from './types'
