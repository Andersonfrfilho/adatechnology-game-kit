// Bundle entry (IIFE global `WeatherArea`): the weather bench module of @adatechnology/game-weather, ready for any room page:
// `WeatherArea.loadInto(room)` loads it with `room.loadModule` and opens its area. The module is written against the generic contracts only; it
// writes the weather into the room's environment bus (`host.environment`) and the scene fog.
// Bench: weather, transition (at once or 10 s), hour of the day, automatic schedule (x600), seed. Layers: environment, fog.
// Metrics: weather, hour, blend, rain, visibility, sight and hearing scale, wind, temperature, heat index, wet ground, strikes.
import { CLIMATES, WEATHER_STATES, createWeather, createWeatherTestModule } from '@adatechnology/game-weather'

export { CLIMATES, WEATHER_STATES, createWeather, createWeatherTestModule }

/** Creates the module for the room's locale (`?lang=en` or pt-BR), loads it and opens the weather area. Returns the room's module report. */
export function loadInto(room, options = {}) {
  const locale = options.locale ?? (new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'pt-BR')
  const report = room.loadModule(createWeatherTestModule({ ...options, locale }))
  room.openArea('weather_area')
  return report
}
