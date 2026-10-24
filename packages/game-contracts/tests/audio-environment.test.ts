import { describe, expect, it } from 'vitest'

import { DEFAULT_ENVIRONMENT, createEnvironmentBus } from '../src'
import type { AudioSink, EnvironmentKey, EnvironmentState, ModuleHost, SoundHandle, SoundRequest } from '../src'

describe('environment bus', () => {
  it('starts as the normal dry world and merges patches', () => {
    const bus = createEnvironmentBus()
    expect(bus.get()).toEqual(DEFAULT_ENVIRONMENT)
    expect(DEFAULT_ENVIRONMENT.rain).toBe(0)
    expect(DEFAULT_ENVIRONMENT.nightFactor).toBe(0)
    bus.set({ rain: 15, wetness: 0.4 })
    expect(bus.get()).toMatchObject({ rain: 15, wetness: 0.4, fogFar: 220 })
  })

  it('takes the start values over the defaults', () => {
    expect(createEnvironmentBus({ temperatureC: 38 }).get().temperatureC).toBe(38)
  })

  it('tells listeners only what changed, and stays quiet when nothing did', () => {
    const bus = createEnvironmentBus()
    const heard: Array<{ state: EnvironmentState; changed: readonly EnvironmentKey[] }> = []
    const off = bus.on((state, changed) => heard.push({ state, changed }))
    bus.set({ rain: 0 })
    bus.set({})
    expect(heard).toHaveLength(0)
    bus.set({ rain: 2.5, windSpeed: 3.5, visibility: undefined })
    expect(heard).toHaveLength(1)
    expect(heard[0]!.changed).toEqual(['rain', 'windSpeed'])
    expect(heard[0]!.state.rain).toBe(2.5)
    expect(bus.get().visibility).toBe(DEFAULT_ENVIRONMENT.visibility)
    off()
    bus.set({ rain: 5 })
    expect(heard).toHaveLength(1)
  })

  it('does not let a listener that unsubscribes while being told break the others', () => {
    const bus = createEnvironmentBus()
    const calls: string[] = []
    const offFirst = bus.on(() => {
      calls.push('first')
      offFirst()
    })
    bus.on(() => calls.push('second'))
    bus.set({ rain: 1 })
    bus.set({ rain: 2 })
    expect(calls).toEqual(['first', 'second', 'second'])
  })
})

describe('audio sink and module host', () => {
  it('lets a host lend a sink and an environment, both optional', () => {
    const requests: SoundRequest[] = []
    const sink: AudioSink = {
      play(request): SoundHandle {
        requests.push(request)
        return { id: requests.length }
      },
      stop() {},
    }
    const bare: Pick<ModuleHost, 'audio' | 'environment'> = {}
    const lent: Pick<ModuleHost, 'audio' | 'environment'> = { audio: sink, environment: createEnvironmentBus() }
    expect(bare.audio?.play({ sound: 'glass_break' })).toBeUndefined()
    expect(lent.audio?.play({ sound: 'glass_break', position: [1, 0, 2], volume: 0.5, params: { size: 2 }, seed: 7 })).toEqual({ id: 1 })
    expect(requests[0]).toEqual({ sound: 'glass_break', position: [1, 0, 2], volume: 0.5, params: { size: 2 }, seed: 7 })
    expect(lent.audio?.loop).toBeUndefined()
  })
})
