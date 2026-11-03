import { createAudioRecorder } from '@adatechnology/golden-tool'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CROSSFADE_STEPS, LIBRARY_BANK, createAudioEngine, equalPowerIn, loopCrossfade } from '../src'
import type { SampleSound } from '../src'

// three 0.5 s takes, crossed in 0.1 s; while the files load the library's crowd rumble loop stands in
const FIRE: SampleSound = {
  id: 'test_fire',
  bus: 'ambience',
  close: [{ url: 'fire1.ogg' }, { url: 'fire2.ogg' }, { url: 'fire3.ogg' }],
  loop: { crossfade: 0.1 },
  fallback: 'crowd_rumble',
  sources: ['sdk: test'],
}

const engineWithLoop = (sound: SampleSound = FIRE) => {
  const recorder = createAudioRecorder()
  const context = recorder.context as unknown as AudioContext
  Object.assign(context, {
    createWaveShaper: () => context.createGain(),
    decodeAudioData: (_bytes: ArrayBuffer, done: (buffer: AudioBuffer) => void) => {
      const buffer = context.createBuffer(1, 24000, 48000)
      done(buffer)
      return Promise.resolve(buffer)
    },
  })
  const engine = createAudioEngine({
    banks: [LIBRARY_BANK, { id: 'files', samples: [sound] }],
    createContext: () => context,
    samples: { loader: async () => new ArrayBuffer(8) },
  })
  return { engine, recorder }
}

type Entry = { readonly op: string; readonly node?: string; readonly kind?: string; readonly prop?: string; readonly value?: unknown; readonly args?: readonly unknown[]; readonly method?: string }
const entriesOf = (recorder: ReturnType<typeof createAudioRecorder>): Entry[] => recorder.trace().entries as unknown as Entry[]
// the buffer sources of the files (the fallback loop plays a noise buffer of its own, created before the files load)
const fileStarts = (entries: Entry[], buffers: ReadonlySet<unknown>) => {
  const bufferOf = new Map(entries.filter((entry) => entry.op === 'set' && entry.prop === 'buffer').map((entry) => [entry.node, entry.value]))
  return entries
    .filter((entry) => entry.op === 'start' && buffers.has(bufferOf.get(entry.node)))
    .map((entry) => ({ node: entry.node as string, at: entry.args?.[0] as number, buffer: bufferOf.get(entry.node) }))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('looping sample sounds', () => {
  it('reads the crossfade and draws equal-power ramps', () => {
    expect(loopCrossfade(FIRE)).toBe(0.1)
    expect(loopCrossfade({ ...FIRE, loop: true })).toBe(0.25)
    expect(loopCrossfade({ ...FIRE, loop: undefined })).toBeUndefined()
    // equal power: the two gains squared add to 1 all along the crossfade
    for (let step = 0; step <= 10; step++) expect(equalPowerIn(step / 10) ** 2 + equalPowerIn(1 - step / 10) ** 2).toBeCloseTo(1)
  })

  it('plays the recipe loop while the files load, then chains the takes with a crossfade and never the same take twice in a row', async () => {
    vi.useFakeTimers()
    const { engine, recorder } = engineWithLoop()
    const loop = engine.loop('test_fire')
    loop.set({ volume: 0.6 })
    // the fallback: the library's crowd rumble loop is running
    expect(engine.stats().loops).toBe(1)
    await vi.waitFor(() => expect(engine.sampleStatus('test_fire')).toBe('ready'))
    const buffers = new Set(entriesOf(recorder).filter((entry) => entry.op === 'createBuffer' && (entry as { length?: number }).length === 24000).map((entry) => (entry as { buffer?: string }).buffer))
    expect(buffers.size).toBe(3)
    // the files took over: three takes scheduled as the clock runs, each 0.1 s before the last one ends
    for (let tick = 1; tick <= 12; tick++) {
      recorder.setTime(tick * 0.1)
      vi.advanceTimersByTime(100)
    }
    const starts = fileStarts(entriesOf(recorder), buffers)
    expect(starts.length).toBeGreaterThanOrEqual(3)
    const first = starts[0]?.at ?? 0
    starts.forEach((start, index) => expect(start.at).toBeCloseTo(first + index * 0.4, 5))
    for (let index = 1; index < starts.length; index++) expect(starts[index]?.buffer).not.toBe(starts[index - 1]?.buffer)
    // each take after the first comes in on an equal-power ramp and every take goes out on one
    const ramps = entriesOf(recorder).filter((entry) => entry.op === 'param' && entry.method === 'linearRampToValueAtTime')
    expect(ramps.length).toBeGreaterThanOrEqual(CROSSFADE_STEPS * (2 * starts.length - 1))
    // the fallback was faded out and stopped
    vi.advanceTimersByTime(1000)
    expect(engine.stats().loops).toBe(1)
    loop.stop()
    expect(engine.stats().loops).toBe(0)
    const before = fileStarts(entriesOf(recorder), buffers).length
    recorder.setTime(5)
    vi.advanceTimersByTime(5000)
    expect(fileStarts(entriesOf(recorder), buffers).length).toBe(before)
  })

  it('a single take loops on itself', async () => {
    const { engine, recorder } = engineWithLoop({ ...FIRE, close: [{ url: 'fire1.ogg' }] })
    await engine.loadSamples(['test_fire'])
    const loop = engine.loop('test_fire', { volume: 0.5 })
    const loops = entriesOf(recorder).filter((entry) => entry.op === 'set' && entry.prop === 'loop' && entry.value === true)
    expect(loops.length).toBe(1)
    loop.stop()
  })

  it('a sample without loop still plays the recipe loop of its id', () => {
    const { engine } = engineWithLoop({ ...FIRE, id: 'crowd_rumble', loop: undefined })
    const loop = engine.loop('crowd_rumble')
    loop.set({ volume: 0.5 })
    expect(engine.stats().loops).toBe(1)
    loop.stop()
  })
})
