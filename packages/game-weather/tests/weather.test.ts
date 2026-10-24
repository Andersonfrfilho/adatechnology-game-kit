import { describe, expect, it } from 'vitest'

import { CLIMATES, createTimeline, createWeather } from '../src'
import type { Strike } from '../src'

const HOUR = 3600
const REAL_SECONDS_PER_GAME_MINUTE = 60 / 72

describe('the schedule', () => {
  it('changes state every 2 to 6 game hours, with a blend that runs from the west', () => {
    for (const climate of CLIMATES) {
      for (const seed of [1, 7, 42]) {
        const timeline = createTimeline({ seed, climate: climate.id, hours: 120 })
        expect(timeline.transitions.length).toBeGreaterThan(10)
        const times = [0, ...timeline.transitions.map((entry) => entry.gameSeconds)]
        for (let index = 1; index < times.length; index++) {
          const dwell = (times[index]! - times[index - 1]!) / HOUR
          expect(dwell).toBeGreaterThanOrEqual(2 - 1e-5)
          expect(dwell).toBeLessThanOrEqual(6 + 1e-5)
        }
      }
    }
  })

  it('walks only the chain of the climate', () => {
    const climate = CLIMATES.find((entry) => entry.id === 'temperate')!
    const timeline = createTimeline({ seed: 3, climate: 'temperate', hours: 240 })
    for (const entry of timeline.transitions) expect(climate.transitions[entry.from]![entry.to]).toBeGreaterThan(0)
  })

  it('is the same for the same seed and different for another', () => {
    const a = createTimeline({ seed: 5, climate: 'tropical', hours: 72 })
    const b = createTimeline({ seed: 5, climate: 'tropical', hours: 72 })
    const c = createTimeline({ seed: 6, climate: 'tropical', hours: 72 })
    expect(a).toEqual(b)
    expect(a.transitions).not.toEqual(c.transitions)
  })

  it('does not depend on how the time is cut into steps', () => {
    const run = (stepSeconds: number) => {
      const weather = createWeather({ seed: 9, climate: 'tropical', start: 'storm' })
      const transitions: Array<[string, number]> = []
      const strikes: Strike[] = []
      weather.on('transition', (event) => transitions.push([event.to, Math.round(event.gameSeconds * 1000) / 1000]))
      weather.on('strike', (strike) => strikes.push(strike))
      for (let elapsed = 0; elapsed < 3000; elapsed += stepSeconds) weather.advance(stepSeconds)
      return { transitions, strikes: strikes.map((strike) => [strike.id, Math.round(strike.time * 1e6), Math.round(strike.distance * 1e6)]) }
    }
    expect(run(0.5)).toEqual(run(7.5))
  })

  it('keeps the state while the schedule is off, and starts a new dwell when it is back on', () => {
    const weather = createWeather({ seed: 1, autoSchedule: false })
    weather.advance(100_000)
    expect(weather.state()).toBe('clear')
    weather.setAutoSchedule(true)
    weather.advance(REAL_SECONDS_PER_GAME_MINUTE * 60)
    expect(weather.state()).toBe('clear')
  })

  it('draws the dwell and the next state from the schedule stream, so lightning never moves it', () => {
    const quiet = createTimeline({ seed: 2, climate: 'tropical', hours: 96 })
    const stormy = createTimeline({ seed: 2, climate: 'tropical', hours: 96, patch: { states: { clear: { lightning: { interval: [1, 2], first: [1, 2], distance: [10, 20], reveal: 0.2 } } } } })
    expect(stormy.transitions).toEqual(quiet.transitions)
    expect(stormy.strikes.length).toBeGreaterThan(quiet.strikes.length)
  })
})

describe('transitions and force', () => {
  it('blends over blendMinutes of game time and reports the state it leaves', () => {
    const weather = createWeather({ seed: 1, autoSchedule: false })
    weather.force('heavy_rain')
    expect(weather.sample().rain).toBe(15)
    expect(weather.sample().blend).toBe(1)
    const calm = createWeather({ seed: 1, autoSchedule: false })
    calm.force('storm', 10)
    calm.advance(5)
    const middle = calm.sample()
    expect(middle.state).toBe('storm')
    expect(middle.previous).toBe('clear')
    expect(middle.blend).toBeCloseTo(0.5, 9)
    expect(middle.rain).toBeCloseTo(30, 9)
    expect(middle.windX).toBeCloseTo((3.5 + 4.5) / 2, 9)
    expect(middle.front).toEqual({ direction: [1, 0], progress: middle.blend })
    calm.advance(5)
    expect(calm.sample().previous).toBeUndefined()
    expect(calm.sample().rain).toBe(60)
  })

  it('blends a forced change from where the blend of the last one had got to', () => {
    const weather = createWeather({ seed: 1, autoSchedule: false })
    weather.force('storm', 10)
    weather.advance(5)
    weather.force('clear', 10)
    expect(weather.sample().rain).toBeCloseTo(30, 9)
    weather.advance(5)
    expect(weather.sample().rain).toBeCloseTo(15, 9)
  })

  it('rejects a state or climate it does not have', () => {
    expect(() => createWeather({ climate: 'polar' })).toThrow(/unknown climate "polar"/)
    expect(() => createWeather({ start: 'hail' })).toThrow(/unknown state "hail"/)
    expect(() => createWeather({ autoSchedule: false }).force('hail')).toThrow(/unknown state "hail"/)
    expect(() => createWeather().setTimeScale(0)).toThrow(/timeScale/)
  })

  it('tells listeners about each change', () => {
    const weather = createWeather({ seed: 1 })
    const heard: string[] = []
    const off = weather.on('transition', (event) => heard.push(`${event.from}>${event.to}`))
    weather.force('fog')
    off()
    weather.force('clear')
    expect(heard).toEqual(['clear>fog'])
  })

  it('moves the sun on game time and starts at the hour asked', () => {
    const weather = createWeather({ startHour: 6 })
    expect(weather.sample().hour).toBeCloseTo(6, 9)
    weather.advance(3600 / 72)
    expect(weather.sample().hour).toBeCloseTo(7, 9)
  })
})

describe('lightning', () => {
  const strikesOf = (options: Parameters<typeof createWeather>[0], seconds: number) => {
    const weather = createWeather({ autoSchedule: false, ...options })
    const strikes: Strike[] = []
    const thunders: Array<{ strike: Strike; at: number }> = []
    let now = 0
    weather.on('strike', (strike) => strikes.push(strike))
    weather.on('thunder', (strike) => thunders.push({ strike, at: now }))
    for (let step = 0; step < seconds * 10; step++) {
      now += 0.1
      weather.advance(0.1)
    }
    return { weather, strikes, thunders }
  }

  it('only strikes in states that have lightning', () => {
    expect(strikesOf({ start: 'heavy_rain' }, 120).strikes).toHaveLength(0)
    expect(strikesOf({ start: 'storm' }, 120).strikes.length).toBeGreaterThan(10)
  })

  it('starts 2 to 4 s after the storm begins and then every 3.5 to 6 s', () => {
    const { strikes } = strikesOf({ start: 'storm', seed: 4 }, 200)
    expect(strikes[0]!.time).toBeGreaterThanOrEqual(2)
    expect(strikes[0]!.time).toBeLessThanOrEqual(4)
    for (let index = 1; index < strikes.length; index++) {
      const gap = strikes[index]!.time - strikes[index - 1]!.time
      expect(gap).toBeGreaterThanOrEqual(3.5 - 1e-9)
      expect(gap).toBeLessThanOrEqual(6 + 1e-9)
    }
  })

  it('delays the thunder by distance over 343', () => {
    const { strikes, thunders } = strikesOf({ start: 'storm', seed: 4 }, 60)
    for (const strike of strikes) {
      expect(strike.thunderDelay).toBeCloseTo(strike.distance / 343, 9)
      expect(strike.distance).toBeGreaterThanOrEqual(200)
      expect(strike.distance).toBeLessThanOrEqual(4000)
      expect(strike.bearing).toBeGreaterThanOrEqual(0)
      expect(strike.bearing).toBeLessThan(360)
    }
    const first = thunders[0]!
    expect(first.at).toBeGreaterThanOrEqual(first.strike.time + first.strike.thunderDelay - 1e-9)
    expect(first.at).toBeLessThan(first.strike.time + first.strike.thunderDelay + 0.11)
  })

  it('draws from its own stream: the same seed gives the same strikes in any climate', () => {
    const temperate = strikesOf({ start: 'storm', seed: 11, climate: 'temperate' }, 100).strikes
    const tropical = strikesOf({ start: 'storm', seed: 11, climate: 'tropical' }, 100).strikes
    expect(temperate.map((strike) => [strike.time, strike.distance, strike.bearing])).toEqual(tropical.map((strike) => [strike.time, strike.distance, strike.bearing]))
    const other = strikesOf({ start: 'storm', seed: 12 }, 100).strikes
    expect(other.map((strike) => strike.distance)).not.toEqual(temperate.map((strike) => strike.distance))
  })

  it('flashes with the Workshop envelope and ends at 0.4 s', () => {
    const weather = createWeather({ autoSchedule: false, start: 'storm', seed: 4 })
    let strikeTime: number | undefined
    weather.on('strike', (strike) => {
      if (strikeTime === undefined) strikeTime = strike.time
    })
    const seen = new Map<string, number>()
    let now = 0
    for (let step = 0; step < 400; step++) {
      weather.advance(0.01)
      now += 0.01
      if (strikeTime === undefined) continue
      const elapsed = now - strikeTime
      if (elapsed > 0.005 && elapsed < 0.075) seen.set('first', weather.sample().flash)
      if (elapsed > 0.085 && elapsed < 0.155) seen.set('dip', weather.sample().flash)
      if (elapsed > 0.165 && elapsed < 0.255) seen.set('second', weather.sample().flash)
      if (elapsed > 0.265 && elapsed < 0.395) seen.set('dark', weather.sample().flash)
      if (elapsed > 0.405 && elapsed < 0.8) seen.set('after', weather.sample().flash)
    }
    expect(Object.fromEntries(seen)).toEqual({ first: 1, dip: 0.2, second: 0.8, dark: 0, after: 0 })
  })

  it('stops when the storm ends and starts again with the next one', () => {
    const weather = createWeather({ autoSchedule: false, start: 'storm', seed: 4 })
    const strikes: Strike[] = []
    weather.on('strike', (strike) => strikes.push(strike))
    weather.advance(20)
    const during = strikes.length
    weather.force('clear')
    weather.advance(60)
    expect(strikes).toHaveLength(during)
    weather.force('storm')
    weather.advance(10)
    expect(strikes.length).toBeGreaterThan(during)
  })
})
