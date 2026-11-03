import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { GAME_SFX_BANK, LIBRARY_BANK, createAudioEngine } from '../src'

const engineOn = (options: Parameters<typeof createAudioEngine>[0] = {}) => {
  const recorder = createAudioRecorder()
  return { recorder, engine: createAudioEngine({ banks: [GAME_SFX_BANK, LIBRARY_BANK], createContext: () => recorder.context, ...options }) }
}

describe('the audio engine', () => {
  it('does nothing without a context, but still plans', () => {
    const engine = createAudioEngine({ banks: [GAME_SFX_BANK], createContext: () => null })
    expect(engine.play('sfx_pistol', { distance: 0 })).toBeNull()
    expect(engine.plan('sfx_pistol', { distance: 0 })?.id).toBe('sfx_pistol')
    expect(engine.stats().context).toBe('none')
    engine.unlock()
    engine.dispose()
  })

  it('is lazy: no context until the first sound or unlock', () => {
    const { recorder, engine } = engineOn({ mix: 'game' })
    expect(recorder.trace().entries).toEqual([])
    engine.play('sfx_pistol', { distance: 0 })
    expect(recorder.trace().entries.length).toBeGreaterThan(0)
    expect(engine.stats().voices).toBe(1)
  })

  it('plans the same sound from the same seed, and another from another seed', () => {
    const { engine } = engineOn()
    expect(engine.plan('sfx_pistol', { seed: 5 })).toEqual(engine.plan('sfx_pistol', { seed: 5 }))
    expect(engine.plan('sfx_pistol', { seed: 5 })).not.toEqual(engine.plan('sfx_pistol', { seed: 6 }))
  })

  it('is silent past the distance floor and muted buses play nothing', () => {
    const { engine } = engineOn({ mix: 'game' })
    expect(engine.play('sfx_pistol', { distance: 1000 })).toBeNull()
    engine.setBus('weapons', { muted: true })
    expect(engine.play('sfx_pistol', { distance: 0 })).toBeNull()
    engine.setBus('weapons', { muted: false })
    expect(engine.play('sfx_pistol', { distance: 0 })).not.toBeNull()
  })

  it('a channel keeps its own stream: another subject playing in between does not shift it', () => {
    const first = engineOn({ mix: 'game' }).engine.channel({ seed: 3 })
    const solo = first.plan('sfx_pistol', { seed: 9 })
    const { engine } = engineOn({ mix: 'game' })
    const channel = engine.channel({ seed: 3 })
    engine.play('sfx_glass', { distance: 0 })
    expect(channel.plan('sfx_pistol', { seed: 9 })).toEqual(solo)
  })

  it('switches the mix chain while running', () => {
    const { engine } = engineOn({ mix: 'game' })
    engine.unlock()
    engine.setMix('art_scene')
    expect(engine.play('sfx_pistol', { distance: 0 })).not.toBeNull()
  })

  it('places a loop with a falloff: quieter and duller far from the listener, panned to its side; a loop without one is heard at the listener', () => {
    const { recorder, engine } = engineOn()
    const placed = { id: 'placed', bus: 'world', order: 'game_loop', source: { kind: 'osc', wave: 'sawtooth', loop: true }, filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 400 } }] }, falloff: { model: 'inverse_square', k: 0.004, cutoffK: 0.01 }, pan: true, sources: ['test'] } as const
    engine.register({ id: 'test', loops: [placed] })
    engine.setListener({ position: [0, 0, 0], yaw: 0 })
    const targets = (param: string): number[] =>
      recorder
        .trace()
        .entries.filter((e) => e.op === 'param' && (e as { param: string }).param === param && (e as { method: string }).method === 'setTargetAtTime')
        .map((e) => (e as unknown as { args: number[] }).args[0] as number)
    const loop = engine.loop('placed')
    loop.set({ volume: 0.5, frequency: 30, cutoff: 800, position: [0, 0, 0] })
    loop.set({ volume: 0.5, frequency: 30, cutoff: 800, position: [30, 0, 0] })
    const [near, far] = targets('gain')
    expect(near).toBeCloseTo(0.5)
    expect(far).toBeCloseTo(0.5 / (1 + 900 * 0.004))
    const [, nearCut, , farCut] = targets('frequency')
    expect(nearCut).toBeCloseTo(800)
    expect(farCut).toBeCloseTo(800 / (1 + 30 * 0.01))
    // to the listener's right (+x at yaw 0)
    expect(targets('pan').at(-1)).toBeGreaterThan(0.5)
    const plain = engine.loop('engine_saw')
    plain.set({ volume: 0.3, position: [30, 0, 0] })
    expect(targets('gain').at(-1)).toBeCloseTo(0.3)
  })

  it('stops loops and clears on dispose', () => {
    const { engine } = engineOn({ mix: 'game' })
    const loop = engine.loop('rotor_blades')
    loop.set({ volume: 0.3 })
    expect(engine.stats().loops).toBe(1)
    engine.dispose()
    expect(engine.stats().loops).toBe(0)
  })
})

describe('warming the engine', () => {
  const countOf = (recorder: ReturnType<typeof createAudioRecorder>, name: string): number => JSON.stringify(recorder.trace().entries).split(`"${name}"`).length - 1

  it('makes the context, the reverb impulse and the noise buffer up front, and the first sound makes none of them', () => {
    const { recorder, engine } = engineOn({ mix: 'art_scene' })
    expect(engine.warmUp()).toBe(true)
    const buffers = countOf(recorder, 'createBuffer')
    expect(buffers).toBeGreaterThan(0)
    engine.play('sfx_pistol', { distance: 0 })
    engine.play('sfx_pistol', { distance: 0 })
    expect(countOf(recorder, 'createBuffer')).toBe(buffers)
  })

  it('reports false without a context', () => {
    expect(createAudioEngine({ createContext: () => null }).warmUp()).toBe(false)
  })
})

describe('deferred start', () => {
  const sourcesOf = (recorder: ReturnType<typeof createAudioRecorder>): number => JSON.stringify(recorder.trace().entries).split('"op":"start"').length - 1
  const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20))

  it('builds nothing inside play, then every queued voice in later tasks', async () => {
    const { recorder, engine } = engineOn({ mix: 'game', deferredStart: { budgetMs: 0 } })
    engine.warmUp()
    const before = sourcesOf(recorder)
    for (let index = 0; index < 5; index++) expect(engine.play('sfx_pistol', { distance: 0 })).not.toBeNull()
    expect(sourcesOf(recorder)).toBe(before)
    await nextTask()
    expect(sourcesOf(recorder)).toBeGreaterThan(before)
  })

  it('a voice stopped while queued is never built', async () => {
    const { recorder, engine } = engineOn({ mix: 'game', deferredStart: {} })
    engine.warmUp()
    const before = sourcesOf(recorder)
    engine.play('sfx_pistol', { distance: 0 })?.stop()
    await nextTask()
    expect(sourcesOf(recorder)).toBe(before)
  })

  it('drops a voice that waited past the latency limit', async () => {
    const { recorder, engine } = engineOn({ mix: 'game', deferredStart: { maxLatencyMs: -1 } })
    engine.warmUp()
    const before = sourcesOf(recorder)
    engine.play('sfx_pistol', { distance: 0 })
    await nextTask()
    expect(sourcesOf(recorder)).toBe(before)
    expect(engine.stats().voices).toBe(0)
  })
})
