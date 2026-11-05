import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { GAME_SFX_BANK, LocalSoundPackError, applyLocalSoundPack, createAudioEngine, localPackSamples, parseLocalSoundPack } from '../src'
import { createSoundCheckModule } from '../src/testing'
import type { IdleScheduler, LocalSoundPack, SampleSound, VoiceStartEvent } from '../src'

const KIT_SHOT: SampleSound = { id: 'pistol_9mm', bus: 'weapons', close: [{ url: 'sdk/pistol_9mm_01.ogg' }], fallback: 'sfx_pistol', sources: ['sdk'] }

const PACK: LocalSoundPack = {
  version: 1,
  sounds: {
    pistol_9mm: { files: ['armas/tiro_a.wav', 'armas/tiro_b.wav'], license: 'unknown', score: 6 },
    // shares a file with pistol_9mm: it must be fetched and decoded once
    pistol_45: { files: ['armas/tiro_a.wav'], license: 'CC0' },
    door_creak: { files: ['portas/rangido.wav'], license: 'CC-BY' },
  },
}

// runs idle tasks only when the test says so, as a page between frames
const manualScheduler = (): { schedule: IdleScheduler; drain(): Promise<void> } => {
  const tasks: (() => void)[] = []
  return {
    schedule: (task) => {
      tasks.push(task)
      return () => tasks.splice(tasks.indexOf(task), 1)
    },
    async drain() {
      for (let guard = 0; guard < 50 && tasks.length > 0; guard++) {
        tasks.shift()?.()
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    },
  }
}

const engineWithPack = (failing: readonly string[] = []) => {
  const recorder = createAudioRecorder()
  const context = recorder.context as unknown as AudioContext
  let decodes = 0
  const fetched: string[] = []
  Object.assign(context, {
    createWaveShaper: () => context.createGain(),
    decodeAudioData: (_bytes: ArrayBuffer, done: (buffer: AudioBuffer) => void) => {
      decodes++
      const buffer = context.createBuffer(1, 4800, 48000)
      done(buffer)
      return Promise.resolve(buffer)
    },
  })
  const events: VoiceStartEvent[] = []
  const engine = createAudioEngine({
    banks: [GAME_SFX_BANK, { id: 'kit_samples', samples: [KIT_SHOT] }],
    createContext: () => context,
    samples: {
      loader: async (url) => {
        fetched.push(url)
        if (failing.includes(url)) throw new Error('404')
        return new ArrayBuffer(8)
      },
    },
    onVoiceStart: (event) => events.push(event),
  })
  return { engine, events, fetched, decodes: () => decodes }
}

describe('parseLocalSoundPack', () => {
  it('accepts a valid pack', () => {
    expect(parseLocalSoundPack(JSON.parse(JSON.stringify(PACK)))).toEqual(PACK)
  })

  it('reports every problem at once', () => {
    const invalid = { version: 2, sounds: { a: { files: [], license: 'mine' }, b: { files: ['x.wav'], license: 'CC0', score: 11, bus: 'radio' } } }
    expect(() => parseLocalSoundPack(invalid)).toThrow(LocalSoundPackError)
    try {
      parseLocalSoundPack(invalid)
    } catch (error) {
      expect((error as LocalSoundPackError).problems).toHaveLength(5)
    }
  })
})

describe('localPackSamples', () => {
  it('puts every file under the base the consumer chooses, with the bus of the catalogue and the synthesized fallback', () => {
    const samples = localPackSamples(PACK, { baseUrl: 'https://cdn.example/sfx/' })
    const shot = samples.find((sample) => sample.id === 'pistol_9mm')
    expect(shot?.close.map((ref) => ref.url)).toEqual(['https://cdn.example/sfx/armas/tiro_a.wav', 'https://cdn.example/sfx/armas/tiro_b.wav'])
    expect(shot).toMatchObject({ bus: 'weapons', fallback: 'sfx_pistol', license: 'unknown' })
    expect(samples.find((sample) => sample.id === 'door_creak')?.bus).toBe('world')
  })
})

describe('applyLocalSoundPack', () => {
  it('keeps the SDK recording until the files decode in idle time, then plays the pack', async () => {
    const { engine, events } = engineWithPack()
    await engine.loadSamples(['pistol_9mm'])
    const idle = manualScheduler()
    const pack = applyLocalSoundPack(engine, PACK, { schedule: idle.schedule })
    engine.play('pistol_9mm', { distance: 0 })
    expect(events.at(-1)?.layers?.[0]?.url).toBe('sdk/pistol_9mm_01.ogg')
    expect(pack.status('pistol_9mm')).toBe('pending')
    await idle.drain()
    expect(pack.status('pistol_9mm')).toBe('file')
    engine.play('pistol_9mm', { distance: 0 })
    expect(events.at(-1)?.layers?.[0]?.url).toMatch(/^armas\/tiro_[ab]\.wav$/)
    expect(pack.unlicensed()).toEqual(['pistol_9mm'])
  })

  it('fetches and decodes each file once, and never on a play', async () => {
    const { engine, fetched, decodes } = engineWithPack()
    const idle = manualScheduler()
    const pack = applyLocalSoundPack(engine, PACK, { schedule: idle.schedule })
    await idle.drain()
    const report = await pack.done
    expect(report.file).toEqual(['pistol_9mm', 'pistol_45', 'door_creak'])
    expect(fetched.filter((url) => url === 'armas/tiro_a.wav')).toHaveLength(1)
    const before = { fetches: fetched.length, decodes: decodes() }
    for (let index = 0; index < 50; index++) engine.play(index % 2 ? 'pistol_9mm' : 'pistol_45', { distance: 0 })
    expect({ fetches: fetched.length, decodes: decodes() }).toEqual(before)
    expect(before.decodes).toBe(3)
  })

  it('leaves an id whose file fails on the SDK sound for good, without fetching again', async () => {
    const { engine, events, fetched } = engineWithPack(['portas/rangido.wav'])
    const idle = manualScheduler()
    const pack = applyLocalSoundPack(engine, PACK, { schedule: idle.schedule })
    await idle.drain()
    expect(pack.status('door_creak')).toBe('fallback')
    expect((await pack.done).fallback[0]?.id).toBe('door_creak')
    const fetches = fetched.length
    engine.play('door_creak', { distance: 0 })
    engine.play('door_creak', { distance: 0 })
    expect(fetched.length).toBe(fetches)
    expect(engine.registry.sample('door_creak')).toBeUndefined()
    expect(events.every((event) => !event.layers?.some((layer) => layer.url.includes('rangido')))).toBe(true)
  })

  it('gives every id back its sound on dispose and stops loading', async () => {
    const { engine } = engineWithPack()
    const idle = manualScheduler()
    const pack = applyLocalSoundPack(engine, PACK, { schedule: idle.schedule })
    await idle.drain()
    pack.dispose()
    expect(engine.registry.sample('pistol_9mm')).toEqual(KIT_SHOT)
    expect(engine.registry.sample('pistol_45')).toBeUndefined()
    expect(engine.registry.sound('sfx_pistol')).toBeDefined()
    expect(engine.registry.sampleIds().some((id) => id.startsWith('local_pack_staging'))).toBe(false)
  })

  it('keeps the SDK recording, without fetching the pack, for an id that prefers it; uses the pack where the SDK has none', async () => {
    const preferring: LocalSoundPack = { version: 1, sounds: { pistol_9mm: { ...PACK.sounds.pistol_9mm, prefer: 'sdk' } as LocalSoundPack['sounds'][string], pistol_45: { files: ['armas/tiro_45.wav'], license: 'unknown', prefer: 'sdk' } } }
    const { engine, fetched } = engineWithPack()
    const idle = manualScheduler()
    const pack = applyLocalSoundPack(engine, preferring, { schedule: idle.schedule })
    await idle.drain()
    expect(pack.status('pistol_9mm')).toBe('sdk')
    expect(engine.registry.sample('pistol_9mm')).toEqual(KIT_SHOT)
    expect(fetched.some((url) => url.startsWith('armas/tiro_a'))).toBe(false)
    expect(pack.status('pistol_45')).toBe('file')
    expect((await pack.done).sdk).toEqual(['pistol_9mm'])
  })

  it('shows on the sound panel which ids play a file without licence', async () => {
    const { engine } = engineWithPack()
    const idle = manualScheduler()
    applyLocalSoundPack(engine, PACK, { schedule: idle.schedule })
    await idle.drain()
    const panel = createSoundCheckModule({ engine })
    const metric = panel.metrics?.('pt-BR').find((entry) => entry.id === 'unlicensed')
    expect(metric?.read()).toBe('1: pistol_9mm')
  })
})
