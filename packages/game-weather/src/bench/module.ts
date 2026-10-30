import type { BenchChange, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ModuleScenario, TestableModule } from '@adatechnology/game-contracts'

import { createWeatherBridges, environmentOf } from '../bridges'
import type { WeatherBridges, WeatherTargets } from '../bridges'
import type { WeatherSoundOptions } from '../audio/sound'
import { createWeather } from '../weather'
import type { Weather, WeatherOptions } from '../weather'
import type { Strike, WeatherSample } from '../types'
import { weatherBenchTextOf } from './locale'
import type { WeatherBenchText } from './locale'

/** What a renderer of the weather (game-weather-three) gives the bench: its layers, a step per frame and the switch of each layer. */
export type WeatherVisual = {
  update(dt: number): void
  setLayer(id: string, on: boolean): void
  dispose(): void
}

/** The bench hands a visual the weather it shows (always the live one, even after the bench restarts it) and what the room lends. */
export type WeatherVisualContext = { readonly host: ModuleHost; readonly locale: string; readonly weather: { sample(): WeatherSample } }

/** The bench declares its layers before the room lends anything, so the factory tells them first (`fog` is the bench's own layer and reaches the visual through `setLayer` too). */
export type WeatherVisualFactory = {
  layers(locale: string): readonly ModuleLayer[]
  create(context: WeatherVisualContext): WeatherVisual
}

export type WeatherTestModuleOptions = WeatherOptions & {
  locale?: string
  /** Text of a state id in the game's words; without it the bench uses its own names, then the id. */
  translate?: (key: string, locale: string) => string | undefined
  /** The weather to test (default a new one built from the other options). */
  weather?: Weather
  /** Whether the scene fog follows the weather at first (default true; the layer can be switched either way). A room that is not about weather starts it off. */
  fog?: boolean
  /** The packages the weather drives besides the host's environment bus and sound (fluids film, interactables, vegetation, vfx), from the example. */
  targets?: Omit<WeatherTargets, 'environment' | 'audio'>
  /** The rain, wind and thunder on the host's `audio`; `false` keeps the area silent. */
  sound?: WeatherSoundOptions | false
  /** The picture of the weather (rain, fog, sky, lightning, headlights, haze), from `@adatechnology/game-weather-three`. With it the bench leaves the scene fog to the visual. */
  visual?: WeatherVisualFactory
}

/** What the scenarios use of the context the test room passes. */
export interface WeatherScenarioLike {
  expect(condition: boolean, label: string, data?: Record<string, unknown>): void
}

export type WeatherTestModule = TestableModule<WeatherScenarioLike> & {
  /** The weather in use (replaced when the bench changes the seed or the hour). */
  readonly weather: Weather
}

const FAST_SCALE = 600
const NORMAL_SCALE = 72
const BLEND_SECONDS = 10
const HOURS_PER_DAY = 24
const FOG_NEAR = 1

type FogLike = new (color: number, near: number, far: number) => { far: number }
type SceneLike = { fog?: unknown }
type ThreeLike = { Fog?: FogLike }

/**
 * The weather area of a test room, written against the generic contracts only: it drives a `createWeather` world, writes the result into the host's
 * environment bus (`host.environment`) every frame and shows the numbers a game reads from it. It also sets the scene fog from the weather's render fog.
 * Pure: no three.js beyond the host's own `Fog`, and the sky, rain, lightning and sound wait for the packages that draw and play them.
 */
export function createWeatherTestModule(options: WeatherTestModuleOptions = {}): WeatherTestModule {
  const locale = options.locale ?? 'pt-BR'
  const text: WeatherBenchText = weatherBenchTextOf(locale)
  const { locale: _locale, translate, weather: given, fog: _fog, targets: _targets, sound: _sound, visual: _visual, ...weatherOptions } = options
  void _locale
  void _fog
  void _targets
  void _sound
  void _visual
  const state = {
    seed: options.seed ?? 1,
    hour: options.startHour ?? 8,
    transition: 0,
    auto: options.autoSchedule ?? false,
    environment: true,
    fog: options.fog ?? true,
  }
  let host: ModuleHost | null = null
  let strikes = 0
  let offStrike: (() => void) | undefined
  let bridges: WeatherBridges | undefined
  let visual: WeatherVisual | undefined
  let weather: Weather = given ?? createWeather({ ...weatherOptions, autoSchedule: state.auto, ...(state.auto ? { timeScale: FAST_SCALE } : {}) })

  const watch = (): void => {
    offStrike?.()
    offStrike = weather.on('strike', (_strike: Strike) => void (strikes += 1))
  }
  watch()

  const nameOf = (id: string): string => translate?.(`weather.${id}`, locale) ?? text.states[id] ?? id

  // the world restarts with the new seed or hour and keeps the weather it was in
  const rebuild = (): void => {
    const current = weather.state()
    weather = createWeather({ ...weatherOptions, seed: state.seed, start: current, startHour: state.hour, autoSchedule: state.auto, timeScale: state.auto ? FAST_SCALE : NORMAL_SCALE })
    strikes = 0
    watch()
    bridges?.bind(weather)
  }

  const applyFog = (far: number): void => {
    const scene = host?.scene as SceneLike | undefined
    const Fog = (host?.THREE as ThreeLike | undefined)?.Fog
    if (!scene || typeof Fog !== 'function') return
    const fog = scene.fog as { far: number } | undefined | null
    if (fog && typeof fog.far === 'number') fog.far = far
    else scene.fog = new Fog(0xa8b4c0, FOG_NEAR, far)
  }

  const publish = (): void => {
    const sample = weather.sample()
    if (state.environment) host?.environment?.set(environmentOf(sample))
    if (state.fog && !visual) applyFog(sample.fogFar)
  }

  const onChange = (change: BenchChange): void => {
    if (change.kind === 'layer') {
      if (change.id === 'environment' || change.id === 'fog') state[change.id] = change.on
      visual?.setLayer(change.id, change.on)
      return
    }
    if (change.kind === 'action') return
    const { id, value } = change
    if (id === 'state' && typeof value === 'string') weather.force(value, state.transition)
    else if (id === 'transition' && typeof value === 'string') state.transition = value === 'instant' ? 0 : BLEND_SECONDS
    else if (id === 'time_of_day' && typeof value === 'number') {
      state.hour = value
      rebuild()
    } else if (id === 'auto_schedule' && typeof value === 'boolean') {
      state.auto = value
      weather.setAutoSchedule(value)
      weather.setTimeScale(value ? FAST_SCALE : NORMAL_SCALE)
    } else if (id === 'seed' && typeof value === 'number') {
      state.seed = value
      rebuild()
    }
  }

  const controls = (): ModuleControl[] => [
    { kind: 'choice', id: 'state', name: text.controls.state, options: weather.registry.stateIds().map((id) => ({ id, name: nameOf(id) })), default: weather.state() },
    {
      kind: 'choice',
      id: 'transition',
      name: text.controls.transition,
      hint: text.hints.transition,
      options: [
        { id: 'instant', name: text.options.instant },
        { id: 'ten_seconds', name: text.options.ten_seconds },
      ],
      default: 'instant',
    },
    { kind: 'number', id: 'time_of_day', name: text.controls.time_of_day, hint: text.hints.time_of_day, unit: 'h', min: 0, max: HOURS_PER_DAY - 1, step: 1, default: state.hour },
    { kind: 'boolean', id: 'auto_schedule', name: text.controls.auto_schedule, hint: text.hints.auto_schedule, default: state.auto },
    { kind: 'number', id: 'seed', name: text.controls.seed, hint: text.hints.seed, min: 1, max: 9999, step: 1, default: state.seed },
  ]

  const layers = (): ModuleLayer[] => [
    { id: 'environment', name: text.layers.environment },
    { id: 'fog', name: text.layers.fog, default: state.fog },
    ...(options.visual?.layers(locale) ?? []),
  ]

  const metrics = (): ModuleMetric[] => [
    { id: 'current_state', name: text.metrics.state, read: () => nameOf(weather.state()) },
    { id: 'hour', name: text.metrics.hour, unit: 'h', digits: 1, read: () => weather.sample().hour },
    { id: 'blend', name: text.metrics.blend, digits: 2, read: () => weather.sample().blend },
    { id: 'rain', name: text.metrics.rain, unit: 'mm/h', digits: 1, read: () => weather.sample().rain },
    { id: 'visibility', name: text.metrics.visibility, unit: 'm', digits: 0, read: () => weather.sample().effects.visibility },
    { id: 'sight', name: text.metrics.sight, digits: 2, read: () => weather.sample().effects.sightScale },
    { id: 'hearing', name: text.metrics.hearing, digits: 2, read: () => weather.sample().effects.hearingScale },
    { id: 'wind', name: text.metrics.wind, unit: 'm/s', digits: 1, read: () => weather.sample().windSpeed },
    { id: 'temperature', name: text.metrics.temperature, unit: '°C', digits: 1, read: () => weather.sample().temperatureC },
    { id: 'heat_index', name: text.metrics.heat_index, unit: '°C', digits: 1, read: () => weather.sample().effects.heatIndexC },
    { id: 'wetness', name: text.metrics.wetness, digits: 2, read: () => weather.sample().groundWetness },
    { id: 'strikes', name: text.metrics.strikes, digits: 0, read: () => strikes },
  ]

  // each scenario runs its own worlds, so the bench's live one is not touched
  const fresh = (extra: WeatherOptions = {}): Weather => createWeather({ ...weatherOptions, autoSchedule: false, ...extra })
  const run = (world: Weather, seconds: number): void => {
    for (let elapsed = 0; elapsed < seconds; elapsed += 0.5) world.advance(0.5)
  }

  const scenarios = (): Array<ModuleScenario<WeatherScenarioLike>> => [
    {
      id: 'storm',
      name: text.scenarios.storm,
      run: ({ expect }) => {
        const clear = fresh({ seed: 3, start: 'clear' })
        const storm = fresh({ seed: 3, start: 'storm' })
        let hits = 0
        storm.on('strike', () => void (hits += 1))
        run(storm, 120)
        const calm = clear.sample().effects
        const rough = storm.sample().effects
        expect(rough.visibility < calm.visibility, 'a storm sees less far', { storm: rough.visibility, clear: calm.visibility })
        expect(rough.hearingScale < calm.hearingScale, 'rain masks sound', { storm: rough.hearingScale, clear: calm.hearingScale })
        expect(hits > 0, 'a storm strikes lightning', { strikes: hits })
      },
    },
    {
      id: 'blend',
      name: text.scenarios.blend,
      run: ({ expect }) => {
        const world = fresh({ seed: 3, start: 'clear' })
        world.force('heavy_rain', 10)
        run(world, 5)
        const middle = world.sample()
        expect(middle.blend > 0 && middle.blend < 1, 'halfway through the change it is still blending', { blend: middle.blend })
        expect(middle.rain > 0 && middle.rain < 15, 'the rain is between the two weathers', { rain: middle.rain })
        run(world, 6)
        expect(world.sample().blend === 1 && world.sample().state === 'heavy_rain', 'after its time it has settled', { blend: world.sample().blend })
      },
    },
    {
      id: 'determinism',
      name: text.scenarios.determinism,
      run: ({ expect }) => {
        const day = (seed: number): string => JSON.stringify(createWeather({ ...weatherOptions, seed }).timeline(48).samples)
        expect(day(5) === day(5), 'the same seed gives the same two days')
        expect(day(5) !== day(6), 'another seed gives another one')
      },
    },
    {
      id: 'dry_ground',
      name: text.scenarios.dry_ground,
      run: ({ expect }) => {
        const world = fresh({ seed: 3, start: 'heavy_rain' })
        run(world, 60)
        const wet = world.sample().groundWetness
        expect(wet > 0.3, 'rain wets the ground', { wetness: wet })
        world.force('clear', 0)
        run(world, 600)
        expect(world.sample().groundWetness < wet, 'it dries after the rain stops', { wet, after: world.sample().groundWetness })
      },
    },
  ]

  const module: WeatherTestModule = {
    id: 'weather_area',
    name: text.name,
    ground: { surface: 'lawn' },
    group: text.group,
    get weather() {
      return weather
    },
    items: () => [],
    controls: () => controls(),
    layers: () => layers(),
    metrics: () => metrics(),
    scenarios: () => scenarios(),
    attach(lent) {
      host = lent
      const off = lent.bench?.onChange(onChange)
      bridges = createWeatherBridges({ ...options.targets, ...(lent.audio ? { audio: lent.audio } : {}) }, { sound: options.sound ?? {} })
      bridges.bind(weather)
      visual = options.visual?.create({ host: lent, locale, weather: { sample: () => weather.sample() } })
      if (visual && !state.fog) visual.setLayer('fog', false)
      publish()
      const offFrame = lent.onFrame((dt) => {
        weather.advance(dt)
        publish()
        bridges?.update(dt)
        visual?.update(dt)
      })
      return () => {
        visual?.dispose()
        visual = undefined
        off?.()
        offFrame()
        bridges?.dispose()
        bridges = undefined
        host = null
      }
    },
  }
  return module
}
