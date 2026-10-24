import { blendValues, valuesOf } from './blend'
import { DEFAULT_TIME_SCALE, daylight, dayFractionAt } from './daylight'
import { deriveEffects } from './effects'
import { createLightningStream, flashIntensity, thunderDelay } from './lightning'
import { createWeatherRegistry } from './registry'
import type { RegistryOptions, WeatherRegistry } from './registry'
import { createScheduler } from './scheduler'
import type { Climate, StateValues, Strike, WeatherEventMap, WeatherSample, WeatherState } from './types'
import { createWetness } from './wetness'
import type { WetnessOptions } from './wetness'

export const DEFAULT_START_HOUR = 8
const SECONDS_PER_MINUTE = 60
const WETNESS_STEP_SECONDS = 1

export type WeatherOptions = RegistryOptions & {
  /** Seed of the schedule and of the lightning (each has its own stream). Default 1. */
  readonly seed?: number
  /** Climate id. Default `temperate`. */
  readonly climate?: string
  /** First state; default the climate's `start`, which is `clear`: the normal world comes first. */
  readonly start?: string
  /** Game seconds per real second. Default 72 (the 20-minute day). */
  readonly timeScale?: number
  /** Hour of the day the world starts at. Default 8. */
  readonly startHour?: number
  /** `false` keeps the state until `force` changes it. Default true. */
  readonly autoSchedule?: boolean
  readonly wetness?: WetnessOptions
  /** An existing registry, instead of building one from the registry options. */
  readonly registry?: WeatherRegistry
}

export type WeatherTimeline = {
  readonly seed: number
  readonly climate: string
  readonly start: string
  readonly hours: number
  readonly sampleMinutes: number
  readonly transitions: ReadonlyArray<{ readonly gameSeconds: number; readonly from: string; readonly to: string }>
  readonly strikes: readonly Strike[]
  readonly samples: ReadonlyArray<Readonly<Record<string, number | string>>>
}

export type Weather = {
  readonly registry: WeatherRegistry
  /** Moves the world forward by `dt` real seconds (game time moves `timeScale` times as fast). Events fire in order as they are crossed. */
  advance(dt: number): void
  sample(): WeatherSample
  /** The state being blended to, or settled in. */
  state(): string
  /** Changes state now, blending over `blendSeconds` real seconds (0 is at once); the new state then lasts a normal dwell. */
  force(id: string, blendSeconds?: number): void
  setTimeScale(timeScale: number): void
  setAutoSchedule(isOn: boolean): void
  /** What a fresh world with these options does over `hours` game hours; the live world is not touched. */
  timeline(hours: number, sampleMinutes?: number): WeatherTimeline
  on<TEvent extends keyof WeatherEventMap>(event: TEvent, listener: (payload: WeatherEventMap[TEvent]) => void): () => void
}

type Blend = { startedAt: number; duration: number }

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function requireClimate(registry: WeatherRegistry, id: string): Climate {
  const climate = registry.climate(id)
  if (!climate) throw new Error(`game-weather: unknown climate "${id}"`)
  return climate
}

function requireState(registry: WeatherRegistry, id: string): WeatherState {
  const state = registry.state(id)
  if (!state) throw new Error(`game-weather: unknown state "${id}"`)
  return state
}

export function createWeather(options: WeatherOptions = {}): Weather {
  const registry = options.registry ?? createWeatherRegistry(options)
  const seed = options.seed ?? 1
  const climateId = options.climate ?? 'temperate'
  const startClimate = requireClimate(registry, climateId)
  const startState = requireState(registry, options.start ?? startClimate.start)
  const startHour = options.startHour ?? DEFAULT_START_HOUR
  const scheduler = createScheduler(startClimate, seed, (id) => registry.state(id) !== undefined)
  const lightning = createLightningStream(seed)
  const wetness = createWetness(options.wetness)
  const listeners = new Map<keyof WeatherEventMap, Set<(payload: never) => void>>()

  let timeScale = options.timeScale ?? DEFAULT_TIME_SCALE
  let isAutoSchedule = options.autoSchedule ?? true
  let gameSeconds = 0
  let simSeconds = 0
  let target = startState
  let targetValues = valuesOf(startState)
  let fromValues: StateValues = targetValues
  let previousId: string | undefined
  let blend: Blend = { startedAt: 0, duration: 0 }
  let nextStrikeAt: number | undefined
  let strikeCount = 0
  let lastStrike: Strike | undefined
  const pendingThunder: Strike[] = []

  const climate = (): Climate => registry.climate(climateId) ?? startClimate

  const emit = <TEvent extends keyof WeatherEventMap>(event: TEvent, payload: WeatherEventMap[TEvent]): void => {
    for (const listener of [...(listeners.get(event) ?? [])]) (listener as (value: WeatherEventMap[TEvent]) => void)(payload)
  }

  const progressAt = (at: number): number => (blend.duration <= 0 ? 1 : clamp01((at - blend.startedAt) / blend.duration))
  const valuesAt = (at: number): StateValues => blendValues(fromValues, targetValues, progressAt(at))

  const scheduleFirstStrike = (atSim: number): void => {
    nextStrikeAt = target.lightning ? atSim + lightning.first(target.lightning) : undefined
  }

  const enter = (id: string, atGame: number, atSim: number, blendGameSeconds: number): void => {
    const next = requireState(registry, id)
    fromValues = valuesAt(atGame)
    previousId = target.id
    target = next
    targetValues = valuesOf(next)
    blend = { startedAt: atGame, duration: blendGameSeconds }
    scheduleFirstStrike(atSim)
    emit('transition', { from: previousId, to: id, gameSeconds: atGame })
  }

  const strikeAt = (atSim: number, startGame: number, startSim: number): void => {
    const config = target.lightning!
    const place = lightning.place(config)
    const strike: Strike = {
      id: strikeCount++,
      time: atSim,
      gameSeconds: startGame + (atSim - startSim) * timeScale,
      distance: place.distance,
      bearing: place.bearing,
      thunderDelay: thunderDelay(place.distance),
    }
    lastStrike = strike
    pendingThunder.push(strike)
    pendingThunder.sort((a, b) => a.time + a.thunderDelay - (b.time + b.thunderDelay))
    nextStrikeAt = atSim + lightning.interval(config)
    emit('strike', strike)
  }

  scheduleFirstStrike(0)

  const runEvents = (startGame: number, startSim: number, endSim: number): void => {
    for (;;) {
      const changeSim = isAutoSchedule ? Math.max(startSim, startSim + (scheduler.nextChangeAt() - startGame) / timeScale) : Infinity
      const strikeSim = nextStrikeAt ?? Infinity
      const thunder = pendingThunder[0]
      const thunderSim = thunder ? thunder.time + thunder.thunderDelay : Infinity
      const earliest = Math.min(changeSim, strikeSim, thunderSim)
      if (earliest > endSim) return
      if (earliest === changeSim) {
        const atGame = Math.max(startGame, scheduler.nextChangeAt())
        const next = scheduler.next(target.id, atGame)
        enter(next, atGame, changeSim, climate().blendMinutes * SECONDS_PER_MINUTE)
      } else if (earliest === strikeSim) strikeAt(strikeSim, startGame, startSim)
      else emit('thunder', pendingThunder.shift()!)
    }
  }

  const wet = (startGame: number, endGame: number, seconds: number): void => {
    const steps = Math.max(1, Math.ceil(seconds / WETNESS_STEP_SECONDS))
    for (let step = 1; step <= steps; step++) {
      const values = valuesAt(startGame + ((endGame - startGame) * step) / steps)
      wetness.update(seconds / steps, values.wetness, values.dryingScale)
    }
  }

  const api: Weather = {
    registry,
    advance(dt) {
      if (!(dt > 0)) return
      const startGame = gameSeconds
      const startSim = simSeconds
      const endGame = startGame + dt * timeScale
      runEvents(startGame, startSim, startSim + dt)
      gameSeconds = endGame
      simSeconds = startSim + dt
      wet(startGame, endGame, dt)
    },
    sample() {
      const values = valuesAt(gameSeconds)
      const dayFraction = dayFractionAt(startHour, gameSeconds)
      const { sun, nightFactor } = daylight(dayFraction)
      const current = climate()
      const temperatureC = current.temperatureC.mean + current.temperatureC.swing * (2 * sun - 1) + values.temperatureDeltaC
      const humidityPercent = clamp01(values.humidity + current.humidityOffset) * 100
      const progress = progressAt(gameSeconds)
      return {
        ...values,
        gameSeconds,
        dayFraction,
        hour: dayFraction * 24,
        nightFactor,
        sun,
        state: target.id,
        previous: progress < 1 ? previousId : undefined,
        blend: progress,
        front: { direction: current.frontDirection, progress },
        windSpeed: Math.sqrt(values.windX * values.windX + values.windZ * values.windZ),
        temperatureC,
        humidityPercent,
        groundWetness: wetness.value(),
        flash: lastStrike ? flashIntensity(simSeconds - lastStrike.time) : 0,
        effects: deriveEffects({ values, nightFactor, temperatureC, humidityPercent, lightningReveal: target.lightning?.reveal ?? 0 }),
      }
    },
    state: () => target.id,
    force(id, blendSeconds = 0) {
      enter(id, gameSeconds, simSeconds, blendSeconds * timeScale)
      scheduler.restart(gameSeconds)
    },
    setTimeScale(next) {
      if (!(next > 0)) throw new Error('game-weather: timeScale must be above 0')
      timeScale = next
    },
    setAutoSchedule(isOn) {
      if (isOn && !isAutoSchedule) scheduler.restart(gameSeconds)
      isAutoSchedule = isOn
    },
    timeline: (hours, sampleMinutes) => createTimeline({ ...options, registry, hours, ...(sampleMinutes === undefined ? {} : { sampleMinutes }) }),
    on(event, listener) {
      const set = listeners.get(event) ?? new Set()
      set.add(listener as (payload: never) => void)
      listeners.set(event, set)
      return () => void set.delete(listener as (payload: never) => void)
    },
  }
  return api
}

export type TimelineOptions = WeatherOptions & {
  readonly hours: number
  /** Game minutes between samples. Default 10. */
  readonly sampleMinutes?: number
}

const TIMELINE_DECIMALS = 6
const round = (value: number): number => Math.round(value * 10 ** TIMELINE_DECIMALS) / 10 ** TIMELINE_DECIMALS + 0

/**
 * What a fresh world does over `hours` game hours, stepping one game minute at a time: the state changes, the strikes (time, distance, bearing) and
 * a sample every `sampleMinutes`. Plain JSON, rounded to 6 decimals, so it can be a golden.
 */
export function createTimeline(options: TimelineOptions): WeatherTimeline {
  const weather = createWeather(options)
  const timeScale = options.timeScale ?? DEFAULT_TIME_SCALE
  const sampleMinutes = options.sampleMinutes ?? 10
  const transitions: Array<{ gameSeconds: number; from: string; to: string }> = []
  const strikes: Strike[] = []
  weather.on('transition', (event) => transitions.push({ gameSeconds: round(event.gameSeconds), from: event.from, to: event.to }))
  weather.on('strike', (strike) =>
    strikes.push({ id: strike.id, time: round(strike.time), gameSeconds: round(strike.gameSeconds), distance: round(strike.distance), bearing: round(strike.bearing), thunderDelay: round(strike.thunderDelay) }),
  )
  const samples: Array<Record<string, number | string>> = []
  const record = (minute: number): void => {
    const sample = weather.sample()
    samples.push({
      at: minute * SECONDS_PER_MINUTE,
      hour: round(sample.hour),
      state: sample.state,
      blend: round(sample.blend),
      rain: round(sample.rain),
      windSpeed: round(sample.windSpeed),
      gust: round(sample.gust),
      visibility: round(sample.effects.visibility),
      sightScale: round(sample.effects.sightScale),
      hearingScale: round(sample.effects.hearingScale),
      temperatureC: round(sample.temperatureC),
      heatIndexC: round(sample.effects.heatIndexC),
      heatStress: round(sample.effects.heatStress),
      wetness: round(sample.groundWetness),
      nightFactor: round(sample.nightFactor),
    })
  }
  record(0)
  const minutes = Math.round(options.hours * 60)
  for (let minute = 1; minute <= minutes; minute++) {
    weather.advance(SECONDS_PER_MINUTE / timeScale)
    if (minute % sampleMinutes === 0) record(minute)
  }
  return {
    seed: options.seed ?? 1,
    climate: options.climate ?? 'temperate',
    start: options.start ?? weather.registry.climate(options.climate ?? 'temperate')!.start,
    hours: options.hours,
    sampleMinutes,
    transitions,
    strikes,
    samples,
  }
}
