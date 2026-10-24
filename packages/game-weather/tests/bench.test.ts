import { checkBench, createEnvironmentBus } from '@adatechnology/game-contracts'
import type { BenchChange, ModuleHost } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { createWeatherTestModule } from '../src'

// The weather bench module against a stand-in host: it declares a valid bench, writes the environment bus and its scenarios pass.
function fakeHost(extra: Partial<ModuleHost> = {}) {
  const listeners: Array<(change: BenchChange) => void> = []
  const frames: Array<(dt: number) => void> = []
  const environment = createEnvironmentBus()
  class Fog {
    constructor(
      readonly color: number,
      readonly near: number,
      public far: number,
    ) {}
  }
  const scene: { fog?: Fog } = {}
  const host = {
    THREE: { Fog },
    scene,
    camera: {},
    locale: 'en',
    groundAt: () => 0,
    tool: () => ({}),
    on: () => () => undefined,
    onFrame: (update: (dt: number) => void) => {
      frames.push(update)
      return () => undefined
    },
    log: () => undefined,
    environment,
    bench: {
      value: () => undefined,
      layer: () => true,
      onChange: (listener: (change: BenchChange) => void) => {
        listeners.push(listener)
        return () => undefined
      },
      patch: () => undefined,
      look: () => undefined,
    },
    ...extra,
  } as unknown as ModuleHost
  const frame = (seconds: number): void => {
    for (let elapsed = 0; elapsed < seconds; elapsed += 0.5) frames.forEach((update) => update(0.5))
  }
  return { host, environment, scene, send: (change: BenchChange) => listeners.forEach((listener) => listener(change)), frame }
}

const read = (module: ReturnType<typeof createWeatherTestModule>, id: string): number | string => module.metrics?.('en').find((metric) => metric.id === id)?.read() ?? Number.NaN

describe('the weather bench module', () => {
  it('declares a valid bench in both languages and no items', () => {
    const module = createWeatherTestModule({ locale: 'en' })
    expect(checkBench({ controls: module.controls?.('en'), layers: module.layers?.('en'), metrics: module.metrics?.('en') }).problems).toEqual([])
    expect(module.items('en')).toEqual([])
    expect(module.group).toBe('Weather')
    expect(createWeatherTestModule({ locale: 'pt-BR' }).group).toBe('Clima')
    const state = module.controls?.('en').find((control) => control.id === 'state')
    expect(state?.kind === 'choice' && state.options.map((option) => option.id)).toEqual(expect.arrayContaining(['clear', 'storm', 'typhoon']))
  })

  it('writes the weather into host.environment and the scene fog, frame by frame', () => {
    const module = createWeatherTestModule({ locale: 'en', seed: 3 })
    const { host, environment, scene, send, frame } = fakeHost()
    module.attach?.(host)
    expect(environment.get().rain).toBe(0)
    send({ kind: 'control', id: 'state', value: 'storm' })
    frame(30)
    expect(environment.get().rain).toBeGreaterThan(10)
    expect(environment.get().visibility).toBeLessThan(120)
    expect(scene.fog?.far).toBe(environment.get().fogFar)
    expect(read(module, 'rain')).toBe(environment.get().rain)
    expect(Number(read(module, 'strikes'))).toBeGreaterThan(0)
    send({ kind: 'layer', id: 'environment', on: false })
    send({ kind: 'control', id: 'state', value: 'clear' })
    frame(5)
    expect(environment.get().rain).toBeGreaterThan(10)
  })

  it('blends over ten seconds, moves the hour and restarts on another seed', () => {
    const module = createWeatherTestModule({ locale: 'en', seed: 3 })
    const { host, send, frame } = fakeHost()
    module.attach?.(host)
    send({ kind: 'control', id: 'transition', value: 'ten_seconds' })
    send({ kind: 'control', id: 'state', value: 'heavy_rain' })
    frame(5)
    expect(Number(read(module, 'blend'))).toBeGreaterThan(0)
    expect(Number(read(module, 'blend'))).toBeLessThan(1)
    send({ kind: 'control', id: 'time_of_day', value: 22 })
    expect(module.weather.state()).toBe('heavy_rain')
    expect(Math.round(Number(read(module, 'hour')))).toBe(22)
    send({ kind: 'control', id: 'auto_schedule', value: true })
    send({ kind: 'control', id: 'seed', value: 9 })
    expect(module.weather.state()).toBe('heavy_rain')
  })

  it('leaves the scene without fog when the room asks for the fog layer off', () => {
    const module = createWeatherTestModule({ locale: 'en', fog: false })
    expect(module.layers?.('en').find((layer) => layer.id === 'fog')?.default).toBe(false)
    const { host, scene, frame } = fakeHost()
    module.attach?.(host)
    frame(2)
    expect(scene.fog).toBeUndefined()
  })

  it('stays silent about the host when none lends the environment or a scene', () => {
    const module = createWeatherTestModule({ locale: 'en' })
    const { host, frame } = fakeHost({ environment: undefined, scene: undefined, THREE: undefined } as Partial<ModuleHost>)
    module.attach?.(host)
    expect(() => frame(2)).not.toThrow()
  })

  it('passes its four scenarios', () => {
    const module = createWeatherTestModule({ locale: 'en' })
    const scenarios = module.scenarios?.('en') ?? []
    expect(scenarios.map((scenario) => scenario.id)).toEqual(['storm', 'blend', 'determinism', 'dry_ground'])
    for (const scenario of scenarios) {
      const failures: string[] = []
      scenario.run({ expect: (ok: boolean, label: string) => void (ok || failures.push(label)) } as never)
      expect(failures, scenario.id).toEqual([])
    }
  })
})
