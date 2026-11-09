import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { GAME_SFX_BANK, createAudioEngine } from '../src'
import type { SampleSound } from '../src'

const sample = (id: string, takes: number): SampleSound => ({
  id,
  bus: 'world',
  close: Array.from({ length: takes }, (_, take) => ({ url: `${id}_${take + 1}.ogg` })),
  sources: ['sdk: test'],
})

// the recorder context of the golden tool, with a decode that counts what it decodes
const engineWithFiles = () => {
  const recorder = createAudioRecorder()
  const context = recorder.context as unknown as AudioContext & { decodeAudioData?: unknown }
  const decoded: number[] = []
  Object.assign(context, {
    createWaveShaper: () => context.createGain(),
    decodeAudioData: (bytes: ArrayBuffer, done: (buffer: AudioBuffer) => void) => {
      decoded.push(bytes.byteLength)
      const buffer = context.createBuffer(1, 24000, 48000)
      done(buffer)
      return Promise.resolve(buffer)
    },
  })
  const fetched: string[] = []
  const engine = createAudioEngine({
    banks: [GAME_SFX_BANK, { id: 'files', samples: [sample('blast', 3), sample('splash', 2), sample('debris_a', 1), sample('debris_b', 1)], sets: [{ id: 'debris', variants: ['debris_a', 'debris_b'] }] }],
    createContext: () => context,
    samples: {
      loader: async (url) => {
        fetched.push(url)
        return new ArrayBuffer(8)
      },
    },
  })
  return { engine, decoded, fetched }
}

describe('AudioEngine.preload', () => {
  it('decodes every take of the given sounds once, and the takes of each variant of a set', async () => {
    const { engine, decoded, fetched } = engineWithFiles()
    const report = await engine.preload(['blast', 'debris'])
    expect(decoded).toHaveLength(5)
    expect(new Set(fetched)).toEqual(new Set(['blast_1.ogg', 'blast_2.ogg', 'blast_3.ogg', 'debris_a_1.ogg', 'debris_b_1.ogg']))
    expect(report.failed).toEqual([])
    for (const id of ['blast', 'debris_a', 'debris_b']) expect(engine.sampleStatus(id)).toBe('ready')
    expect(engine.sampleStatus('splash')).toBe('none')
  })

  it('skips what is already decoded and what is still loading', async () => {
    const { engine, decoded } = engineWithFiles()
    await engine.preload(['blast'])
    expect(decoded).toHaveLength(3)
    await engine.preload(['blast', 'splash'])
    expect(decoded).toHaveLength(5)
    await Promise.all([engine.preload(['debris_a']), engine.preload(['debris_a'])])
    expect(decoded).toHaveLength(6)
  })

  it('a preloaded sound plays its recording the first time', async () => {
    const { engine } = engineWithFiles()
    await engine.preload(['blast'])
    expect(engine.play('blast', { distance: 0 })?.kind).toBe('sample')
  })

  it('loads an id with no files yet as soon as a bank that resolves it registers', async () => {
    const { engine, decoded } = engineWithFiles()
    await engine.preload(['late'])
    expect(decoded).toHaveLength(0)
    engine.register({ id: 'later', samples: [sample('late', 2)] })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(engine.sampleStatus('late')).toBe('ready')
    expect(decoded).toHaveLength(2)
  })
})
