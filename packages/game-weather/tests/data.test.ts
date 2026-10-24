import { describe, expect, it } from 'vitest'

import { CLIMATES, WEATHER_STATES, STATE_VALUE_KEYS, createWeather } from '../src'

const state = (id: string) => WEATHER_STATES.find((entry) => entry.id === id)!

describe('shipped states', () => {
  it('has the ten states, each saying where its numbers come from', () => {
    expect(WEATHER_STATES.map((entry) => entry.id)).toEqual(['clear', 'overcast', 'light_rain', 'heavy_rain', 'storm', 'fog', 'windy', 'cyclone', 'typhoon', 'extreme_heat'])
    for (const entry of WEATHER_STATES) {
      expect(entry.sources.length, entry.id).toBeGreaterThan(0)
      for (const key of STATE_VALUE_KEYS) expect(Number.isFinite(entry[key]), `${entry.id}.${key}`).toBe(true)
    }
  })

  it('keeps the numbers of the team pages', () => {
    expect(state('clear')).toMatchObject({ fogFar: 220, windX: 3.5, windZ: 1.5 })
    expect(state('overcast')).toMatchObject({ fogDensity: 0.03, windX: 0.35, windZ: 0.12, skyScale: 0.9 })
    expect(state('light_rain')).toMatchObject({ drops: 900, windX: 0.3, rain: 2.5, wetness: 0.35, visibility: 160, hearingScale: 0.8 })
    expect(state('heavy_rain')).toMatchObject({ drops: 2200, windX: 1.2, rain: 15, fogFar: 140, skyScale: 0.8, visibility: 120, hearingScale: 0.6 })
    expect(state('storm')).toMatchObject({ drops: 4000, windX: 4.5, rain: 60, sheets: 1, hearingScale: 0.5 })
    expect(state('storm').lightning).toEqual({ interval: [3.5, 6], first: [2, 4], distance: [200, 4000], reveal: 0.2 })
    expect(state('fog')).toMatchObject({ fogDensity: 0.075, mistPerSecond: 5, ashPerSecond: 14, visibility: 40 })
    expect(state('windy')).toMatchObject({ windX: 8, gust: 12 })
  })

  it('has the physics presets at 33 and 50 m/s with the gust 1.3 times the wind', () => {
    expect(state('cyclone')).toMatchObject({ windX: 33, rain: 60 })
    expect(state('cyclone').gust).toBeCloseTo(33 * 1.3, 9)
    expect(state('typhoon')).toMatchObject({ windX: 50, rain: 60 })
    expect(state('typhoon').gust).toBeCloseTo(50 * 1.3, 9)
    expect(state('cyclone').debrisPush).toBeGreaterThan(0)
    expect(state('extreme_heat')).toMatchObject({ humidity: 0.6, haze: 1, dryingScale: 2 })
  })

  it('makes extreme heat 38 °C at the tropical noon', () => {
    const weather = createWeather({ climate: 'tropical', start: 'extreme_heat', startHour: 12 })
    expect(weather.sample().temperatureC).toBeCloseTo(38, 9)
  })
})

describe('shipped climates', () => {
  it('start clear: the normal world comes first', () => {
    for (const climate of CLIMATES) expect(climate.start).toBe('clear')
    expect(createWeather({ climate: 'temperate' }).sample().state).toBe('clear')
    expect(createWeather({ climate: 'tropical' }).sample().state).toBe('clear')
  })

  it('only name known states, and keep the extremes out of the temperate one', () => {
    const ids = new Set(WEATHER_STATES.map((entry) => entry.id))
    for (const climate of CLIMATES) {
      for (const [from, weights] of Object.entries(climate.transitions)) {
        expect(ids.has(from), `${climate.id}: ${from}`).toBe(true)
        for (const to of Object.keys(weights)) expect(ids.has(to), `${climate.id}: ${from} -> ${to}`).toBe(true)
      }
    }
    const temperate = CLIMATES.find((climate) => climate.id === 'temperate')!
    const reachable = new Set(Object.values(temperate.transitions).flatMap((weights) => Object.keys(weights)))
    for (const extreme of ['cyclone', 'typhoon', 'extreme_heat']) {
      expect(reachable.has(extreme)).toBe(false)
      expect(temperate.transitions[extreme]).toBeUndefined()
    }
    const tropical = CLIMATES.find((climate) => climate.id === 'tropical')!
    const tropicalReach = new Set(Object.values(tropical.transitions).flatMap((weights) => Object.keys(weights)))
    for (const extreme of ['cyclone', 'typhoon', 'extreme_heat']) expect(tropicalReach.has(extreme)).toBe(true)
  })

  it('last 2 to 6 game hours, with fronts that arrive from the west', () => {
    for (const climate of CLIMATES) {
      expect(climate.dwellHours).toEqual([2, 6])
      expect(climate.frontDirection).toEqual([1, 0])
      expect(climate.sources.length).toBeGreaterThan(0)
    }
  })
})
