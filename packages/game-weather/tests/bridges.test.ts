import { createEnvironmentBus } from '@adatechnology/game-contracts'
import type { AudioSink, LoopHandle, SoundRequest } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createWeather, createWeatherBridges, environmentOf } from '../src'

function fakes() {
  const calls: string[] = []
  const film = {
    weather: [] as Array<{ rain: number; drying?: number }>,
    washes: [] as Array<number | undefined>,
    setWeather(weather: { rain: number; drying?: number }) {
      this.weather.push(weather)
    },
    wash(max?: number) {
      this.washes.push(max)
      return 0
    },
  }
  const interactables = {
    rain: [] as number[],
    wind: [] as Array<[number, number]>,
    water: {
      setRain: (mm: number) => void interactables.rain.push(mm),
    },
    setWind: (x: number, z: number) => void interactables.wind.push([x, z]),
  }
  const vegetation = { wind: [] as unknown[], setWind: (wind: unknown) => void vegetation.wind.push(wind) }
  const vfx = { wind: [] as unknown[], setWind: (wind: unknown) => void vfx.wind.push(wind) }
  const plays: SoundRequest[] = []
  const loops = new Map<string, number[]>()
  const audio: AudioSink = {
    play: (request) => (plays.push(request), { id: plays.length }),
    stop: () => undefined,
    loop: (sound): LoopHandle => {
      loops.set(sound, [])
      return { set: (state) => void loops.get(sound)!.push(state.volume ?? NaN), stop: () => void calls.push(`stop ${sound}`) }
    },
    register: (bank) => void calls.push(`register ${(bank as { id: string }).id}`),
  }
  const environment = createEnvironmentBus()
  return { film, interactables, vegetation, vfx, audio, plays, loops, calls, environment }
}

const run = (weather: ReturnType<typeof createWeather>, bridges: ReturnType<typeof createWeatherBridges>, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.5) {
    weather.advance(0.5)
    bridges.update(0.5)
  }
}

describe('the weather bridges', () => {
  it('pushes the numbers of the weather to every target, with the rules written down', () => {
    const target = fakes()
    const weather = createWeather({ seed: 3, start: 'storm', autoSchedule: false })
    const bridges = createWeatherBridges({ film: target.film, interactables: target.interactables, vegetation: target.vegetation, vfx: target.vfx, environment: target.environment })
    bridges.bind(weather)
    const sample = weather.sample()
    expect(target.film.weather.at(-1)).toEqual({ rain: 1, drying: 1 })
    expect(target.interactables.rain).toEqual([60])
    expect(target.interactables.wind).toEqual([[4.5, 0]])
    expect(target.vfx.wind).toEqual([[4.5, 0, 0]])
    expect(target.vegetation.wind).toEqual([{ direction: [4.5, 0], strength: 4.5 / 20, gust: 6 / 20 }])
    expect(target.environment.get()).toMatchObject(environmentOf(sample))
    expect(target.environment.get().rain).toBe(60)
  })

  it('pushes only what changed', () => {
    const target = fakes()
    const weather = createWeather({ seed: 3, start: 'storm', autoSchedule: false })
    const bridges = createWeatherBridges({ film: target.film, interactables: target.interactables, vegetation: target.vegetation })
    bridges.bind(weather)
    run(weather, bridges, 10)
    expect(target.film.weather).toHaveLength(1)
    expect(target.interactables.rain).toHaveLength(1)
    expect(target.interactables.wind).toHaveLength(1)
    weather.force('clear', 0)
    run(weather, bridges, 1)
    expect(target.interactables.rain.at(-1)).toBe(0)
    expect(target.film.weather.at(-1)).toEqual({ rain: 0, drying: 1 })
  })

  it('light rain stops the drying and does not wash; heavy rain washes the fresh stain every second', () => {
    const light = fakes()
    const lightWeather = createWeather({ seed: 3, start: 'light_rain', autoSchedule: false })
    const lightBridges = createWeatherBridges({ film: light.film })
    lightBridges.bind(lightWeather)
    run(lightWeather, lightBridges, 10)
    expect(light.film.weather.at(-1)).toEqual({ rain: 1, drying: 1 })
    expect(light.film.washes).toEqual([])

    const heavy = fakes()
    const heavyWeather = createWeather({ seed: 3, start: 'heavy_rain', autoSchedule: false })
    const heavyBridges = createWeatherBridges({ film: heavy.film })
    heavyBridges.bind(heavyWeather)
    run(heavyWeather, heavyBridges, 10)
    expect(heavy.film.washes.length).toBe(10)
    expect(heavy.film.washes.every((max) => max === 0.5)).toBe(true)
  })

  it('passes the heat as a drying scale', () => {
    const target = fakes()
    const weather = createWeather({ seed: 3, start: 'extreme_heat', autoSchedule: false })
    const bridges = createWeatherBridges({ film: target.film })
    bridges.bind(weather)
    expect(target.film.weather.at(-1)).toEqual({ rain: 0, drying: 2 })
  })

  it('keeps the direction of the vegetation when the wind drops to nothing, and takes the rules from the options', () => {
    const target = fakes()
    const weather = createWeather({ seed: 3, start: 'clear', autoSchedule: false })
    const bridges = createWeatherBridges({ vegetation: target.vegetation, film: target.film }, { windFull: 10, filmRainFullAt: 30, washFrom: 40 })
    bridges.bind(weather)
    expect(target.vegetation.wind[0]).toMatchObject({ strength: Math.hypot(3.5, 1.5) / 10, gust: 0.5 })
    expect(weather.registry.state('clear')).toBeDefined()
    const rainy = createWeather({ seed: 3, start: 'heavy_rain', autoSchedule: false })
    bridges.bind(rainy)
    expect(target.film.weather.at(-1)).toEqual({ rain: 0.5, drying: 1 })
    run(rainy, bridges, 5)
    expect(target.film.washes).toEqual([])
  })

  it('follows a new weather and lets go of the old one', () => {
    const target = fakes()
    const first = createWeather({ seed: 3, start: 'storm', autoSchedule: false, timeScale: 72 })
    const second = createWeather({ seed: 4, start: 'clear', autoSchedule: false })
    const bridges = createWeatherBridges({ audio: target.audio }, { sound: { listener: () => [0, 0, 0] } })
    bridges.bind(first)
    bridges.bind(second)
    for (let step = 0; step < 400; step++) first.advance(0.5)
    expect(target.plays).toEqual([])
    bridges.dispose()
  })

  it('plays the rain and wind loops at the level of the weather, and the thunder when it arrives', () => {
    const target = fakes()
    const weather = createWeather({ seed: 3, start: 'storm', autoSchedule: false })
    const bridges = createWeatherBridges({ audio: target.audio })
    bridges.bind(weather)
    expect(target.calls).toContain('register weather')
    expect(target.loops.get('rain_loop')!.at(-1)).toBeCloseTo(0.06, 9)
    expect(target.loops.get('wind_loop')!.at(-1)).toBeCloseTo((0.05 * 4.5) / 3.8, 9)
    let strikes = 0
    weather.on('strike', () => void (strikes += 1))
    run(weather, bridges, 60)
    expect(strikes).toBeGreaterThan(5)
    expect(target.plays.length).toBeGreaterThan(0)
    expect(target.plays.length).toBeLessThanOrEqual(strikes)
    expect(target.plays.every((play) => play.sound === 'thunder' && play.position !== undefined)).toBe(true)
    weather.force('clear', 0)
    run(weather, bridges, 1)
    expect(target.loops.get('rain_loop')!.at(-1)).toBe(0)
    bridges.dispose()
    expect(target.calls).toContain('stop rain_loop')
    expect(target.calls).toContain('stop wind_loop')
  })

  it('works with no targets, and with the sound switched off', () => {
    const weather = createWeather({ seed: 3, start: 'storm', autoSchedule: false })
    const nothing = createWeatherBridges({})
    nothing.bind(weather)
    run(weather, nothing, 5)
    const target = fakes()
    const silent = createWeatherBridges({ audio: target.audio }, { sound: false })
    silent.bind(weather)
    run(weather, silent, 5)
    expect(target.loops.size).toBe(0)
    expect(target.calls).toEqual([])
  })
})
