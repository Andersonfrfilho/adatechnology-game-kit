import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { GAME_SFX_BANK, createAudioEngine, createRng, crossGains, farMixAt, parseSfxName, pickTake, planSample, sampleBankFromManifest, sampleCutoff } from '../src'
import type { SampleSound, SfxManifest, VoiceStartEvent } from '../src'

const SHOT: SampleSound = {
  id: 'test_shot',
  bus: 'weapons',
  close: [{ url: 'c1.ogg' }, { url: 'c2.ogg' }, { url: 'c3.ogg' }, { url: 'c4.ogg' }],
  far: [{ url: 'f1.ogg' }, { url: 'f2.ogg' }],
  tail: { indoor: [{ url: 'ti.ogg' }], outdoor: [{ url: 'to.ogg' }] },
  fallback: 'sfx_pistol',
  sources: ['sdk: test'],
}

describe('round-robin', () => {
  it('never plays the same take twice in a row and reaches every take', () => {
    const random = createRng(3)
    let last: number | undefined
    const seen = new Set<number>()
    for (let index = 0; index < 200; index++) {
      const take = pickTake(4, last, random)
      expect(take).not.toBe(last)
      expect(take).toBeGreaterThanOrEqual(0)
      expect(take).toBeLessThan(4)
      seen.add(take)
      last = take
    }
    expect(seen.size).toBe(4)
  })

  it('one take is always take 0', () => {
    expect(pickTake(1, 0, () => 0.99)).toBe(0)
  })
})

describe('planSample', () => {
  it('draws the pitch inside ± the fraction and keeps it on every layer', () => {
    for (let seed = 1; seed < 50; seed++) {
      const plan = planSample(SHOT, { random: createRng(seed), distance: 50 })
      expect(plan).not.toBeNull()
      expect(Math.abs((plan?.rate ?? 0) - 1)).toBeLessThanOrEqual(0.04 + 1e-9)
      for (const layer of plan?.layers ?? []) expect(layer.rate).toBe(plan?.rate)
    }
  })

  it('a memory makes ten plays in a row never repeat the near take', () => {
    const memory = new Map<string, number>()
    const random = createRng(11)
    const takes = Array.from({ length: 10 }, () => planSample(SHOT, { random, memory })?.layers.find((layer) => layer.role === 'close')?.take)
    for (let index = 1; index < takes.length; index++) expect(takes[index]).not.toBe(takes[index - 1])
    expect(new Set(takes).size).toBeGreaterThanOrEqual(3)
  })

  it('crosses from the near take to the far one with the distance, equal power', () => {
    const roles = (distance: number) => planSample(SHOT, { random: createRng(1), distance })?.layers.map((layer) => layer.role)
    expect(roles(5)).toEqual(['close', 'tail'])
    expect(roles(55)).toEqual(['close', 'far', 'tail'])
    expect(roles(200)).toEqual(['far', 'tail'])
    expect(farMixAt({ from: 30, to: 80 }, 55)).toBeCloseTo(0.5)
    const half = crossGains(0.5)
    expect(half.close ** 2 + half.far ** 2).toBeCloseTo(1)
  })

  it('plays the tail of the place: indoor or outdoor', () => {
    const tail = (environment: 'indoor' | 'outdoor') => planSample(SHOT, { random: createRng(1), environment })?.layers.find((layer) => layer.role === 'tail')?.url
    expect(tail('indoor')).toBe('ti.ogg')
    expect(tail('outdoor')).toBe('to.ogg')
  })

  it('gets quieter and darker with distance and behind a wall', () => {
    const at = (distance: number, occlusion = 0) => planSample(SHOT, { random: createRng(1), distance, occlusion })
    const levels = [1, 10, 50, 200].map((distance) => at(distance)?.level ?? 0)
    const cutoffs = [1, 10, 50, 200].map((distance) => at(distance)?.cutoff ?? 0)
    for (let index = 1; index < 4; index++) {
      expect(levels[index]).toBeLessThan(levels[index - 1] as number)
      expect(cutoffs[index]).toBeLessThan(cutoffs[index - 1] as number)
    }
    expect(at(10, 1)?.cutoff ?? 0).toBeLessThan((at(10)?.cutoff ?? 0) / 5)
    expect(at(10, 1)?.level ?? 0).toBeLessThan(at(10)?.level ?? 0)
    expect(sampleCutoff(0, 100)).toBe(20000)
  })

  it('pans to the side the sound is on', () => {
    expect(planSample(SHOT, { random: createRng(1), position: [10, 0, 0] })?.pan).toBeGreaterThan(0.3)
    expect(planSample(SHOT, { random: createRng(1), position: [-10, 0, 0] })?.pan).toBeLessThan(-0.3)
  })

  it('is silent too far away', () => {
    expect(planSample(SHOT, { random: createRng(1), distance: 5000 })).toBeNull()
  })
})

describe('the manifest', () => {
  it('reads the id, layer and take of a file name', () => {
    expect(parseSfxName('pistol_9mm_close_01')).toEqual({ id: 'pistol_9mm', layer: 'close', take: 1 })
    expect(parseSfxName('gunshot_tail_out_02')).toEqual({ id: 'gunshot', layer: 'tail_out', take: 2 })
    expect(parseSfxName('impact_concrete_bullet_03')).toEqual({ id: 'impact_concrete_bullet', layer: 'close', take: 3 })
    expect(parseSfxName('door_creak')).toEqual({ id: 'door_creak', layer: 'close', take: 1 })
  })

  it('makes a bank with the urls under the base and leaves out sounds without numbers', () => {
    const entry = (file: string) => ({ file, sampleRate: 48000, channels: 1, peak: -1, seconds: 0.5, source: 'sdk', author: 'kit', license: 'CC0' as const })
    const manifest: SfxManifest = {
      version: 1,
      format: { codec: 'vorbis', sampleRate: 48000, channels: 1, peakDb: -1 },
      sounds: [
        { id: 'a', category: 'armas', layers: { close: [entry('armas/a_close_01.ogg')], far: [entry('armas/a_far_01.ogg')], tail_in: [entry('armas/a_tail_in_01.ogg')] } },
        { id: 'b', category: 'armas', layers: { close: [entry('armas/b_01.ogg')] } },
      ],
    }
    const bank = sampleBankFromManifest(manifest, { id: 'test', baseUrl: '/sfx/', sounds: { a: { bus: 'weapons', fallback: 'sfx_pistol' } } })
    expect(bank.samples?.map((sample) => sample.id)).toEqual(['a'])
    expect(bank.samples?.[0]?.close[0]?.url).toBe('/sfx/armas/a_close_01.ogg')
    expect(bank.samples?.[0]?.tail?.indoor?.[0]?.url).toBe('/sfx/armas/a_tail_in_01.ogg')
  })
})

// the recorder context of the golden tool, with a decode that makes a 0.5 s buffer of any bytes
const engineWithFiles = (events: VoiceStartEvent[], failing: readonly string[] = []) => {
  const recorder = createAudioRecorder()
  const context = recorder.context as unknown as AudioContext & { decodeAudioData?: unknown }
  Object.assign(context, {
    // the recorder has no waveshaper (the sample limiter's): a recorded gain node stands in for it
    createWaveShaper: () => context.createGain(),
    decodeAudioData: (_bytes: ArrayBuffer, done: (buffer: AudioBuffer) => void) => {
      const buffer = context.createBuffer(1, 24000, 48000)
      done(buffer)
      return Promise.resolve(buffer)
    },
  })
  const engine = createAudioEngine({
    banks: [GAME_SFX_BANK, { id: 'files', samples: [SHOT] }],
    createContext: () => context,
    samples: { loader: async (url) => (failing.includes(url) ? Promise.reject(new Error('404')) : new ArrayBuffer(8)) },
    onVoiceStart: (event) => events.push(event),
  })
  return { engine, recorder }
}

describe('the engine with sample sounds', () => {
  it('plays the fallback recipe until the files are loaded, then the files', async () => {
    const events: VoiceStartEvent[] = []
    const { engine } = engineWithFiles(events)
    expect(engine.sampleStatus('test_shot')).toBe('none')
    const first = engine.play('test_shot', { distance: 0 })
    expect(first?.kind).toBe('recipe')
    expect(events[0]).toMatchObject({ id: 'sfx_pistol', kind: 'recipe', fallbackOf: 'test_shot' })
    await engine.loadSamples()
    expect(engine.sampleStatus('test_shot')).toBe('ready')
    const second = engine.play('test_shot', { distance: 0 })
    expect(second?.kind).toBe('sample')
    expect(events[1]).toMatchObject({ id: 'test_shot', kind: 'sample' })
    expect(events[1]?.layers?.map((layer) => layer.role)).toEqual(['close', 'tail'])
    expect(events[1]?.startAt).toBe(events[1]?.requestedAt)
  })

  it('round-robins across plays and switches the tail with the environment', async () => {
    const events: VoiceStartEvent[] = []
    const { engine } = engineWithFiles(events)
    await engine.loadSamples(['test_shot'])
    for (let index = 0; index < 10; index++) engine.play('test_shot', { distance: 0, environment: index < 5 ? 'indoor' : 'outdoor' })
    const takes = events.map((event) => event.layers?.find((layer) => layer.role === 'close')?.take)
    for (let index = 1; index < takes.length; index++) expect(takes[index]).not.toBe(takes[index - 1])
    expect(events[0]?.layers?.find((layer) => layer.role === 'tail')?.url).toBe('ti.ogg')
    engine.setEnvironment('indoor')
    engine.play('test_shot', { distance: 0 })
    expect(events.at(-1)?.layers?.find((layer) => layer.role === 'tail')?.url).toBe('ti.ogg')
  })

  it('reports a file that fails and keeps the fallback', async () => {
    const events: VoiceStartEvent[] = []
    const { engine } = engineWithFiles(events, ['c3.ogg'])
    const report = await engine.loadSamples()
    expect(report.failed.map((entry) => entry.url)).toEqual(['c3.ogg'])
    expect(engine.sampleStatus('test_shot')).toBe('failed')
    expect(engine.play('test_shot', { distance: 0 })?.kind).toBe('recipe')
  })

  it('plans without touching the round-robin memory', async () => {
    const { engine } = engineWithFiles([])
    expect(engine.planSample('test_shot', { seed: 4 })).toEqual(engine.planSample('test_shot', { seed: 4 }))
    expect(engine.planSample('nope')).toBeNull()
  })
})
