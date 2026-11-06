import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it, vi } from 'vitest'

import { TRIM_FADE, createAudioEngine, createAudioSink, createSoundRegistry, loopRate } from '../src'
import type { LoopRecipe, SampleSound, SoundBank, SoundRecipe } from '../src'

// a manifest file id, and a package that plays it under its own ids: a loop that follows a frequency, and a one-shot cut out of the file
const FILE: SampleSound = { id: 'engine_loop_test_idle', bus: 'world', close: [{ url: 'idle.ogg' }], pitch: 0, sources: ['test file'] }
const START: SampleSound = { id: 'engine_start_run_stop_test', bus: 'world', close: [{ url: 'run.ogg' }], pitch: 0, sources: ['test file'] }
const LOOP: LoopRecipe = { id: 'engine_test_low', bus: 'world', order: 'game_loop', source: { kind: 'osc', wave: 'sawtooth', loop: true }, sources: ['test'] }
const START_RECIPE: SoundRecipe = { id: 'engine_test_start', bus: 'world', layers: [{ source: { kind: 'osc', wave: 'sine', frequency: { set: 100 } }, envelope: { attack: 0.01, decay: 0.1 } }], sources: ['test'] } as unknown as SoundRecipe
const PACKAGE: SoundBank = {
  id: 'package',
  loops: [LOOP],
  sounds: [START_RECIPE],
  sampleAliases: [
    { id: 'engine_test_low', file: FILE.id, loop: true, baseFrequency: 33 },
    { id: 'engine_test_start', file: START.id, offset: 0, duration: 1.2 },
  ],
}
const FILES: SoundBank = { id: 'files', samples: [FILE, START] }

const engineWith = (banks: readonly SoundBank[]) => {
  const recorder = createAudioRecorder()
  const context = recorder.context as unknown as AudioContext
  Object.assign(context, {
    createWaveShaper: () => context.createGain(),
    decodeAudioData: (_bytes: ArrayBuffer, done: (buffer: AudioBuffer) => void) => {
      const buffer = context.createBuffer(1, 48000 * 4, 48000)
      done(buffer)
      return Promise.resolve(buffer)
    },
  })
  const engine = createAudioEngine({ banks, createContext: () => context, samples: { loader: async () => new ArrayBuffer(8) } })
  return { engine, recorder }
}

type Entry = { readonly op: string; readonly node?: string; readonly param?: string; readonly prop?: string; readonly method?: string; readonly args?: readonly unknown[]; readonly value?: unknown }
const entriesOf = (recorder: ReturnType<typeof createAudioRecorder>): Entry[] => recorder.trace().entries as unknown as Entry[]

describe('sample aliases', () => {
  it('an alias plays the takes of the file it names, whichever bank registers first, and keeps its own recipe as the fallback', () => {
    for (const order of [
      [PACKAGE, FILES],
      [FILES, PACKAGE],
    ]) {
      const registry = createSoundRegistry(order)
      const low = registry.sample('engine_test_low')
      expect(low?.close).toEqual([{ url: 'idle.ogg' }])
      expect(low?.loop).toBe(true)
      expect(low?.baseFrequency).toBe(33)
      expect(low?.fallback).toBe('engine_test_low')
      expect(registry.sample('engine_test_start')?.close).toEqual([{ url: 'run.ogg', offset: 0, duration: 1.2 }])
      expect(registry.sampleIds()).toEqual(expect.arrayContaining(['engine_test_low', 'engine_test_start']))
      expect(registry.bankOf('engine_test_low')).toBe('package')
    }
  })

  it('without the file the alias is nothing, and a sample of its own id wins', () => {
    const registry = createSoundRegistry([PACKAGE])
    expect(registry.sample('engine_test_low')).toBeUndefined()
    expect(registry.sampleIds()).not.toContain('engine_test_low')
    registry.register({ id: 'game', samples: [{ ...FILE, id: 'engine_test_low', close: [{ url: 'own.ogg' }] }] })
    registry.register(FILES)
    expect(registry.sample('engine_test_low')?.close).toEqual([{ url: 'own.ogg' }])
  })

  it('a trimmed take starts at its offset, plays its duration and fades out at the cut', async () => {
    const { engine, recorder } = engineWith([FILES, PACKAGE])
    await engine.loadSamples(['engine_test_start'])
    const voice = engine.play('engine_test_start', { position: [0, 0, 0] })
    expect(voice?.kind).toBe('sample')
    const entries = entriesOf(recorder)
    const start = entries.find((entry) => entry.op === 'start' && entry.node?.startsWith('bufferSource'))
    const at = start?.args?.[0] as number
    expect(start?.args?.slice(1)).toEqual([0, 1.2])
    const ramp = entries.find((entry) => entry.op === 'param' && entry.param === 'gain' && entry.method === 'linearRampToValueAtTime' && entry.args?.[0] === 0)
    expect(ramp?.args?.[1]).toBeCloseTo(at + 1.2, 5)
    const hold = entries.find((entry) => entry.op === 'param' && entry.param === 'gain' && entry.method === 'setValueAtTime' && entry.node === ramp?.node)
    expect(hold?.args?.[1]).toBeCloseTo(at + 1.2 - TRIM_FADE, 5)
  })

  it('a loop with a base frequency follows set({ frequency }) with its rate, and a position places it', async () => {
    expect(loopRate({ ...FILE, baseFrequency: 33 }, 66)).toBe(2)
    expect(loopRate({ ...FILE, baseFrequency: 33 }, 1000)).toBe(4)
    expect(loopRate(FILE, 66)).toBe(1)
    const { engine, recorder } = engineWith([FILES, PACKAGE])
    engine.setListener({ position: [0, 0, 0], yaw: 0 })
    await engine.loadSamples(['engine_test_low'])
    const loop = engine.loop('engine_test_low')
    loop.set({ volume: 0.5, frequency: 26.4, position: [2, 0, 0] })
    let entries = entriesOf(recorder)
    const source = entries.find((entry) => entry.op === 'start' && entry.node?.startsWith('bufferSource'))?.node
    expect(entries.some((entry) => entry.op === 'param' && entry.node === source && entry.param === 'playbackRate' && entry.method === 'value' && Math.abs((entry.args?.[0] as number) - 0.8) < 1e-6)).toBe(true)
    // yaw 0: a loop at +x is heard on the right
    const pan = entries.find((entry) => entry.op === 'param' && entry.param === 'pan' && entry.method === 'value')
    expect(pan?.args?.[0] as number).toBeGreaterThan(0.5)
    loop.set({ volume: 0.5, frequency: 66, position: [0, 0, -40] })
    entries = entriesOf(recorder)
    const glide = entries.filter((entry) => entry.op === 'param' && entry.node === source && entry.param === 'playbackRate' && entry.method === 'setTargetAtTime')
    expect(glide.at(-1)?.args?.[0]).toBeCloseTo(2, 6)
    // 40 m away: quieter than at 2 m (the sample falloff, 1 / (1 + d² × 0.002))
    const levels = entries.filter((entry) => entry.op === 'param' && entry.param === 'gain' && entry.method === 'setTargetAtTime').map((entry) => entry.args?.[0] as number)
    expect(levels.at(-1)).toBeCloseTo(0.5 / (1 + 1600 * 0.002), 6)
    loop.stop()
  })
})

describe('the sink preloads', () => {
  it('preload decodes the files of the ids a module names, so their first play is the recording', async () => {
    const { engine } = engineWith([FILES, PACKAGE])
    const sink = createAudioSink(engine)
    expect(engine.sampleStatus('engine_test_start')).toBe('none')
    sink.preload?.(['engine_test_start', 'no_such_sound'])
    await vi.waitFor(() => expect(engine.sampleStatus('engine_test_start')).toBe('ready'))
    expect(engine.play('engine_test_start')?.kind).toBe('sample')
  })
})
