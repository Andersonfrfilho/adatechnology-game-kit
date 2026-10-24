// Bundle entry (IIFE global `WeatherArea`): the weather bench module of @adatechnology/game-weather, ready for any room page:
// `WeatherArea.loadInto(room)` loads it with `room.loadModule` and opens its area. The module is written against the generic contracts only; it
// writes the weather into the room's environment bus (`host.environment`) and the scene fog, and pushes it through the weather bridges to the room's
// fluid film (rain, drying, wash), the effects world (wind) and the room's sound (rain and wind loops, thunder).
// The picture comes from @adatechnology/game-weather-three: the rain curtain, the near rain with splashes, mist and ash, fog, sky, lightning, headlights (a lamp rig in front of the camera) and heat haze.
// Bench: weather, transition (at once or 10 s), hour of the day, automatic schedule (x600), seed. Layers: environment, fog, rain curtain, near rain, mist and ash, sky, lightning, headlights, heat haze.
// Metrics: weather, hour, blend, rain, visibility, sight and hearing scale, wind, temperature, heat index, wet ground, strikes.
import { CLIMATES, WEATHER_STATES, createWeather, createWeatherTestModule } from '@adatechnology/game-weather'
import { createWeatherVisual } from '@adatechnology/game-weather-three'

export { CLIMATES, WEATHER_STATES, createWeather, createWeatherTestModule, createWeatherVisual }

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the weather area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const locale = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createWeatherTestModule({ targets: { film: room.film, vfx: room.vfx }, visual: createWeatherVisual({ vfx: room.vfx }), ...options, locale }))
  room.openArea('weather_area')
  return report
}
