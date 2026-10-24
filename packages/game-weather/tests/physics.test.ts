import { describe, expect, it } from 'vitest'

import { blendValues, createWeather, createWetness, dayFractionAt, daylight, deriveEffects, heatIndexC, heatStress, valuesOf, WEATHER_STATES } from '../src'

describe('wetness', () => {
  it('rises with the rain toward the wetness of the state', () => {
    const weather = createWeather({ autoSchedule: false })
    weather.force('light_rain')
    weather.advance(10)
    expect(weather.sample().groundWetness).toBeCloseTo(10 / 120, 9)
    weather.advance(300)
    expect(weather.sample().groundWetness).toBeCloseTo(0.35, 9)
    weather.force('heavy_rain')
    weather.advance(1000)
    expect(weather.sample().groundWetness).toBeCloseTo(0.8, 9)
  })

  it('is dry 180 s after the rain stops, falling in a straight line', () => {
    const weather = createWeather({ autoSchedule: false })
    weather.force('heavy_rain')
    weather.advance(1000)
    weather.force('clear')
    weather.advance(90)
    expect(weather.sample().groundWetness).toBeCloseTo(0.4, 9)
    weather.advance(89)
    expect(weather.sample().groundWetness).toBeGreaterThan(0)
    weather.advance(2)
    expect(weather.sample().groundWetness).toBe(0)
  })

  it('dries twice as fast in extreme heat and stops drying when the rain comes back', () => {
    const weather = createWeather({ autoSchedule: false, climate: 'tropical' })
    weather.force('heavy_rain')
    weather.advance(1000)
    weather.force('extreme_heat')
    weather.advance(91)
    expect(weather.sample().groundWetness).toBe(0)
    weather.force('heavy_rain')
    weather.advance(60)
    expect(weather.sample().groundWetness).toBeCloseTo(0.5, 9)
    weather.force('clear')
    weather.advance(20)
    const drying = weather.sample().groundWetness
    weather.force('heavy_rain')
    weather.advance(10)
    expect(weather.sample().groundWetness).toBeCloseTo(drying + 10 / 120, 9)
  })

  it('keeps the damp the fog leaves and can be tuned', () => {
    const fast = createWetness({ riseSeconds: 10, dryOutSeconds: 20 })
    expect(fast.update(5, 1)).toBeCloseTo(0.5, 9)
    expect(fast.update(10, 0)).toBeCloseTo(0.25, 9)
    expect(fast.update(10, 0)).toBeCloseTo(0, 9)
    fast.reset(0.3)
    expect(fast.value()).toBe(0.3)
    const weather = createWeather({ autoSchedule: false, start: 'fog' })
    weather.advance(1000)
    expect(weather.sample().groundWetness).toBeCloseTo(0.15, 9)
  })
})

describe('effects', () => {
  const effectsOf = (id: string, nightFactor = 0) => {
    const state = WEATHER_STATES.find((entry) => entry.id === id)!
    return deriveEffects({ values: valuesOf(state), nightFactor, temperatureC: 20, humidityPercent: 50, lightningReveal: state.lightning?.reveal ?? 0 })
  }

  it('sees 120 m in heavy rain and quiets the steps and the ears with the rain', () => {
    const heavy = effectsOf('heavy_rain')
    expect(heavy.visibility).toBe(120)
    expect(heavy.sightScale).toBeCloseTo(120 / 220, 9)
    expect(effectsOf('clear')).toMatchObject({ sightScale: 1, hearingScale: 1, footstepScale: 1 })
    expect([effectsOf('light_rain').hearingScale, heavy.hearingScale, effectsOf('storm').hearingScale]).toEqual([0.8, 0.6, 0.5])
    expect(effectsOf('storm').footstepScale).toBeLessThan(heavy.footstepScale)
  })

  it('loses 40 % of the sight at night, as the game does', () => {
    expect(effectsOf('clear', 1).sightScale).toBeCloseTo(0.6, 9)
    expect(effectsOf('heavy_rain', 1).sightScale).toBeCloseTo((120 / 220) * 0.6, 9)
    expect(effectsOf('clear', 0.5).sightScale).toBeCloseTo(0.8, 9)
  })

  it('reveals the scene for 0.2 s where there is lightning', () => {
    expect(effectsOf('storm').lightningReveal).toBe(0.2)
    expect(effectsOf('clear').lightningReveal).toBe(0)
  })

  it('carries the weather effects in every sample', () => {
    const weather = createWeather({ autoSchedule: false })
    weather.force('heavy_rain')
    const sample = weather.sample()
    expect(sample.effects.visibility).toBe(120)
    expect(sample.effects.hearingScale).toBe(0.6)
    expect(sample.windSpeed).toBeCloseTo(1.2, 9)
  })
})

describe('heat index', () => {
  const fahrenheit = (value: number) => ((value - 32) * 5) / 9
  const toFahrenheit = (celsius: number) => (celsius * 9) / 5 + 32

  it('follows the NOAA table within a degree and a half Fahrenheit', () => {
    for (const [tempF, humidity, indexF] of [
      [80, 40, 80],
      [90, 50, 95],
      [90, 70, 105],
      [100, 40, 109],
      [100, 50, 118],
      [110, 40, 136],
    ] as const) {
      expect(Math.abs(toFahrenheit(heatIndexC(fahrenheit(tempF), humidity)) - indexF), `${tempF}F ${humidity}%`).toBeLessThan(1.5)
    }
  })

  it('is the temperature in the cool and below the regression threshold', () => {
    expect(Math.abs(heatIndexC(10, 50) - 10)).toBeLessThan(1)
    expect(Math.abs(heatIndexC(20, 40) - 20)).toBeLessThan(1)
    expect(heatIndexC(25, 60)).toBeLessThan(27)
  })

  it('applies the low and high humidity adjustments', () => {
    expect(heatIndexC(fahrenheit(95), 10)).toBeLessThan(heatIndexC(fahrenheit(95), 20))
    expect(heatIndexC(fahrenheit(85), 95)).toBeGreaterThan(heatIndexC(fahrenheit(85), 80))
  })

  it('maps the NOAA bands to a 0..1 stress', () => {
    expect(heatStress(20)).toBe(0)
    expect(heatStress(27)).toBe(0)
    expect(heatStress(32)).toBeCloseTo(1 / 3, 9)
    expect(heatStress(41)).toBeCloseTo(2 / 3, 9)
    expect(heatStress(54)).toBe(1)
    expect(heatStress(70)).toBe(1)
    expect(heatStress(36.5)).toBeCloseTo(0.5, 9)
  })

  it('puts the tropical extreme heat in the danger bands', () => {
    const weather = createWeather({ climate: 'tropical', start: 'extreme_heat', startHour: 12, autoSchedule: false })
    const { effects, temperatureC, humidityPercent } = weather.sample()
    expect(temperatureC).toBeCloseTo(38, 9)
    expect(humidityPercent).toBeCloseTo(70, 9)
    expect(effects.heatIndexC).toBeGreaterThan(41)
    expect(effects.heatStress).toBeGreaterThan(2 / 3)
  })
})

describe('daylight', () => {
  it('is the formula of the game: noon is full sun, midnight is full night', () => {
    expect(daylight(0.5)).toEqual({ sun: 1, nightFactor: 0 })
    expect(daylight(0)).toEqual({ sun: 0, nightFactor: 1 })
    const dusk = daylight(0.72)
    expect(dusk.sun).toBeCloseTo(Math.sin(0.72 * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 12)
    expect(dusk.nightFactor).toBeCloseTo(1 - Math.min(1, dusk.sun * 2.2), 12)
  })

  it('is dark at 0.1 and fully light from 0.3 of the day, and mirrored around noon', () => {
    expect(daylight(0.1).nightFactor).toBeGreaterThan(0.5)
    expect(daylight(0.3).nightFactor).toBe(0)
    expect(daylight(0.3).sun).toBeCloseTo(daylight(0.7).sun, 12)
    expect(daylight(0.6).nightFactor).toBe(0)
  })

  it('wraps the day fraction', () => {
    expect(dayFractionAt(8, 0)).toBeCloseTo(1 / 3, 12)
    expect(dayFractionAt(23, 7200)).toBeCloseTo(1 / 24, 12)
    expect(dayFractionAt(0, -3600)).toBeCloseTo(23 / 24, 12)
  })
})

describe('blend', () => {
  it('takes every number from one state to the other', () => {
    const clear = valuesOf(WEATHER_STATES[0]!)
    const storm = valuesOf(WEATHER_STATES.find((entry) => entry.id === 'storm')!)
    expect(blendValues(clear, storm, 0)).toEqual(clear)
    expect(blendValues(clear, storm, 1)).toEqual(storm)
    expect(blendValues(clear, storm, 0.5).rain).toBe(30)
    expect(blendValues(clear, storm, 2)).toEqual(storm)
    expect(blendValues(clear, storm, -1)).toEqual(clear)
  })
})
