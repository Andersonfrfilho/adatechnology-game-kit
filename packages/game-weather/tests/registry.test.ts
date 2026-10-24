import { describe, expect, it } from 'vitest'

import { CLIMATES, WEATHER_STATES, createTimeline, createWeather, createWeatherRegistry } from '../src'
import type { WeatherState } from '../src'

const drizzle: WeatherState = { ...WEATHER_STATES.find((entry) => entry.id === 'light_rain')!, id: 'drizzle', sources: ['test'], rain: 0.5, drops: 300 }

describe('registry', () => {
  it('ships every state and climate', () => {
    const registry = createWeatherRegistry()
    expect(registry.stateIds()).toHaveLength(10)
    expect(registry.climateIds()).toEqual(['temperate', 'tropical'])
    expect(registry.state('storm')?.drops).toBe(4000)
  })

  it('adds a state and replaces one by id', () => {
    const registry = createWeatherRegistry({ states: [drizzle, { ...drizzle, id: 'clear', rain: 1 }] })
    expect(registry.state('drizzle')?.drops).toBe(300)
    expect(registry.state('clear')?.rain).toBe(1)
    expect(registry.stateIds()).toHaveLength(11)
  })

  it('patches by id, deeply, and ignores an id it does not have', () => {
    const registry = createWeatherRegistry({
      patch: {
        states: { storm: { lightning: { interval: [1, 2] }, rain: 90 }, nothing: { rain: 1 } },
        climates: { temperate: { dwellHours: [1, 1], temperatureC: { mean: 5 } } },
      },
    })
    expect(registry.state('storm')?.rain).toBe(90)
    expect(registry.state('storm')?.lightning).toEqual({ interval: [1, 2], first: [2, 4], distance: [200, 4000], reveal: 0.2 })
    expect(registry.state('nothing')).toBeUndefined()
    expect(registry.climate('temperate')?.dwellHours).toEqual([1, 1])
    expect(registry.climate('temperate')?.temperatureC).toEqual({ mean: 5, swing: 6 })
    expect(WEATHER_STATES.find((entry) => entry.id === 'storm')?.rain).toBe(60)
    expect(CLIMATES[0]?.dwellHours).toEqual([2, 6])
  })

  it('removes states and climates, and changes them later with the same verbs', () => {
    const registry = createWeatherRegistry({ remove: { states: ['fog'], climates: ['tropical'] } })
    expect(registry.state('fog')).toBeUndefined()
    expect(registry.climate('tropical')).toBeUndefined()
    registry.registerState(drizzle)
    registry.patchState('drizzle', { rain: 0.9 })
    expect(registry.state('drizzle')?.rain).toBe(0.9)
    registry.removeState('drizzle')
    expect(registry.state('drizzle')).toBeUndefined()
    registry.registerClimate({ ...CLIMATES[0]!, id: 'dry' })
    expect(registry.climateIds()).toContain('dry')
    registry.patchClimate('dry', { blendMinutes: 1 })
    expect(registry.climate('dry')?.blendMinutes).toBe(1)
    registry.removeClimate('dry')
    expect(registry.climate('dry')).toBeUndefined()
  })

  it('never schedules a state that was removed', () => {
    for (const seed of [1, 2, 3, 4]) {
      const timeline = createTimeline({ seed, hours: 200, remove: { states: ['fog', 'windy'] } })
      expect(timeline.transitions.length).toBeGreaterThan(20)
      for (const entry of timeline.transitions) expect(['fog', 'windy']).not.toContain(entry.to)
    }
  })

  it('uses an added state in a climate and the patch of a shipped one', () => {
    const climate = { ...CLIMATES[0]!, id: 'drizzly', transitions: { clear: { drizzle: 1 }, drizzle: { clear: 1 } } }
    const weather = createWeather({ states: [drizzle], climates: [climate], climate: 'drizzly', seed: 3 })
    weather.advance(7 * 3600 / 72 + 1)
    expect(['clear', 'drizzle']).toContain(weather.state())
    const timeline = createTimeline({ states: [drizzle], climates: [climate], climate: 'drizzly', hours: 60 })
    expect(new Set(timeline.transitions.map((entry) => entry.to))).toEqual(new Set(['clear', 'drizzle']))
  })

  it('stays in a state with nowhere to go, and cannot stall on a zero dwell', () => {
    const stuck = createTimeline({ hours: 30, patch: { climates: { temperate: { transitions: { clear: { overcast: 0, windy: 0, fog: 0, light_rain: 0 } } } } } })
    expect(stuck.transitions.every((entry) => entry.to === 'clear')).toBe(true)
    const weather = createWeather({ patch: { climates: { temperate: { dwellHours: [0, 0] } } } })
    weather.advance(10)
    expect(weather.sample().gameSeconds).toBeCloseTo(720, 9)
  })

  it('shares one registry between worlds, and a timeline of a live world leaves it alone', () => {
    const registry = createWeatherRegistry()
    const weather = createWeather({ registry, seed: 8, autoSchedule: false })
    weather.advance(5)
    const before = weather.sample()
    const timeline = weather.timeline(24)
    expect(timeline.samples).toHaveLength(24 * 6 + 1)
    expect(weather.sample()).toEqual(before)
    expect(weather.registry).toBe(registry)
  })
})
