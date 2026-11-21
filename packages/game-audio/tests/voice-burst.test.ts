import { createAudioRecorder } from '@adatechnology/golden-tool'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GAME_SFX_BANK, VOICE_GROUPS, createAudioEngine, createVoiceManager } from '../src'
import type { SampleSound, VoiceGroup, VoiceStartEvent } from '../src'

const LIMIT = 4
const GROUPS: Readonly<Record<string, VoiceGroup>> = {
  crowd: { maxPerBurst: LIMIT },
  boosted: { maxPerBurst: LIMIT, burstBoost: 1.5 },
  other: { maxPerBurst: LIMIT },
  wide: { maxPerBurst: 8 },
}
const SAMPLE: SampleSound = { id: 'hit_file', bus: 'world', close: [{ url: 'h1.ogg' }, { url: 'h2.ogg' }], sources: ['sdk: test'] }

const setup = (options: Parameters<typeof createAudioEngine>[0] = {}, contextProps: object = {}) => {
  const recorder = createAudioRecorder()
  const context = recorder.context as unknown as AudioContext
  for (const [key, value] of Object.entries(contextProps)) Object.defineProperty(context, key, { value, configurable: true })
  Object.assign(context, {
    createWaveShaper: () => context.createGain(),
    decodeAudioData: (_bytes: ArrayBuffer, done: (buffer: AudioBuffer) => void) => {
      const buffer = context.createBuffer(1, 24000, 48000)
      done(buffer)
      return Promise.resolve(buffer)
    },
  })
  const started: VoiceStartEvent[] = []
  const engine = createAudioEngine({
    banks: [GAME_SFX_BANK, { id: 'files', samples: [SAMPLE] }],
    mix: 'game',
    maxVoices: 500,
    groups: GROUPS,
    deferredStart: {},
    createContext: () => context,
    samples: { loader: async () => new ArrayBuffer(8) },
    onVoiceStart: (event) => started.push(event),
    ...options,
  })
  engine.warmUp()
  const trace = (): string => JSON.stringify(recorder.trace().entries)
  const count = (kind: string): number => trace().split(`"kind":"${kind}"`).length - 1
  const nodes = (): number => trace().split('"op":"create","node"').length - 1
  const flush = (): void => engine.deferredQueue?.()?.flush?.()
  return { engine, recorder, started, nodes, count, flush }
}

describe('the voice cap per burst', () => {
  it('builds no node for a request that is not kept: 276 requests are LIMIT voices', () => {
    const capped = setup()
    const before = capped.nodes()
    for (let index = 0; index < 276; index++) capped.engine.play('sfx_pistol', { distance: 1 + index * 0.3, group: 'crowd' })
    expect(capped.nodes()).toBe(before)
    capped.flush()
    expect(capped.started).toHaveLength(LIMIT)

    const reference = setup()
    const referenceBefore = reference.nodes()
    for (let index = 0; index < LIMIT; index++) reference.engine.play('sfx_pistol', { distance: 1 + index * 0.3 })
    reference.flush()
    expect(capped.nodes() - before).toBeGreaterThan(0)
    expect(capped.nodes() - before).toBe(reference.nodes() - referenceBefore)
    expect(capped.engine.stats().capped).toBe(276 - LIMIT)
  })

  it('keeps only what can win: the losers are counted at once and the queue holds one settle job, not 276', () => {
    const { engine } = setup()
    for (let index = 0; index < 276; index++) engine.play('sfx_pistol', { distance: 1 + index * 0.3, group: 'crowd' })
    expect(engine.stats().capped).toBe(276 - LIMIT)
    expect(engine.deferredQueue?.()?.pending()).toBe(1)
  })

  it('keeps the loudest, whatever order they were asked in', () => {
    const { engine, started, flush } = setup()
    const distances = Array.from({ length: 40 }, (_, index) => ((index * 17) % 40) + 1)
    for (const distance of distances) engine.play('sfx_pistol', { distance, group: 'crowd' })
    flush()
    expect(started.map((event) => event.distance).sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('breaks a tie by the order the sounds were asked in: a later request never evicts an earlier one', () => {
    const { engine, started, flush } = setup()
    for (let index = 0; index < 12; index++) engine.play('sfx_pistol', { distance: 5, delay: index, group: 'crowd' })
    flush()
    const delays = started.map((event) => event.startAt - (started[0] as VoiceStartEvent).startAt)
    expect(delays).toEqual([0, 1, 2, 3])
  })

  it('leaves other groups and sounds with no group alone', () => {
    const { engine, started, flush } = setup()
    for (let index = 0; index < 10; index++) {
      engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
      engine.play('sfx_pistol', { distance: 1 + index, group: 'other' })
      engine.play('sfx_pistol', { distance: 1 + index })
    }
    flush()
    expect(started).toHaveLength(LIMIT * 2 + 10)
  })

  it('changes nothing for a caller that does not opt in', () => {
    const plain = setup({ groups: undefined })
    for (let index = 0; index < 50; index++) plain.engine.play('sfx_pistol', { distance: 1, group: 'crowd' })
    plain.flush()
    expect(plain.started).toHaveLength(50)
    expect(plain.engine.stats().capped).toBe(0)
    expect(Object.values(VOICE_GROUPS).some((group) => group.maxPerBurst !== undefined)).toBe(false)
  })

  it('refuses a capped group on an engine with no start queue, rather than ignoring it', () => {
    expect(() => setup({ deferredStart: undefined })).toThrow(/maxPerBurst.*deferredStart/)
    expect(() => setup({ deferredStart: undefined, groups: { plain: { maxConcurrent: 2 } } })).not.toThrow()
  })

  it('an urgent play of a capped group is built now, while a normal one waits', () => {
    const { engine, started, flush } = setup()
    for (let index = 0; index < 10; index++) expect(engine.play('sfx_pistol', { distance: 1, group: 'crowd', urgent: true })).not.toBeNull()
    expect(started).toHaveLength(10)
    expect(engine.play('sfx_pistol', { distance: 1, group: 'crowd' })).toBeNull()
    expect(started).toHaveLength(10)
    flush()
    expect(started).toHaveLength(11)
  })

  it('flushing with nothing held is a no-op', () => {
    const { engine, recorder, started, flush } = setup()
    const before = JSON.stringify(recorder.trace().entries)
    flush()
    flush()
    expect(JSON.stringify(recorder.trace().entries)).toBe(before)
    expect(started).toHaveLength(0)
    expect(engine.deferredQueue?.()?.pending()).toBe(0)
    expect(engine.stats().capped).toBe(0)
  })

  it('gives a later burst a fresh budget', () => {
    const { engine, started, flush } = setup()
    for (let round = 1; round <= 3; round++) {
      for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
      flush()
      expect(started).toHaveLength(LIMIT * round)
    }
  })

  it('builds the kept voices ahead of a sound asked after them, under a budgeted drain', () => {
    const { engine, started } = setup()
    for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    engine.play('sfx_pistol', { distance: 1, delay: 100 })
    const queue = engine.deferredQueue?.() as NonNullable<ReturnType<NonNullable<typeof engine.deferredQueue>>>
    // a clock already past the deadline: one job per call, as a frame with no time left
    let calls = 0
    while (queue.pending() > 0 && calls++ < 50) queue.run(0, () => 1)
    expect(started).toHaveLength(LIMIT + 1)
    expect(started.slice(0, LIMIT).every((event) => event.startAt < 50)).toBe(true)
    expect((started[LIMIT] as VoiceStartEvent).startAt).toBeGreaterThan(50)
    expect(calls).toBeGreaterThan(LIMIT)
  })

  it('drops the held burst as late, not as capped, when the queue does not reach it in time', () => {
    const { engine, started, flush } = setup({ deferredStart: { maxLatencyMs: -1 } })
    for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    flush()
    expect(started).toHaveLength(0)
    const stats = engine.stats()
    expect(stats.capped).toBe(10 - LIMIT)
    expect(stats.dropped).toBe(LIMIT)
  })

  it('raises the kept voices only as far as others were dropped', () => {
    const levelOf = (asked: number, group: string): number => {
      const { engine, started, flush } = setup()
      for (let index = 0; index < asked; index++) engine.play('sfx_pistol', { distance: 5, group })
      flush()
      return (started[0] as VoiceStartEvent).level
    }
    const kept = levelOf(LIMIT, 'boosted')
    expect(levelOf(LIMIT, 'crowd')).toBeCloseTo(kept, 9)
    const dropped = levelOf(LIMIT * 4, 'boosted')
    expect(dropped).toBeGreaterThan(kept)
    expect(dropped).toBeLessThanOrEqual(kept * 1.5)
    expect(levelOf(LIMIT * 4, 'crowd')).toBeCloseTo(kept, 9)
  })

  it('a sound that names its own group keeps it over the play option', () => {
    const { engine, started, flush } = setup({ groups: { ...GROUPS, own: { maxPerBurst: 2 } }, banks: [{ ...GAME_SFX_BANK, sounds: GAME_SFX_BANK.sounds?.map((sound) => (sound.id === 'sfx_pistol' ? { ...sound, group: 'own' } : sound)) }] })
    for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    flush()
    expect(started).toHaveLength(2)
  })

  it('releases what is held when the engine closes, and builds nothing from a queue drained after', () => {
    const { engine, started, nodes, flush } = setup()
    for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    const before = nodes()
    engine.dispose()
    flush()
    expect(nodes()).toBe(before)
    expect(started).toHaveLength(0)
    expect(engine.stats().dropped).toBe(0)
    expect(engine.stats().capped).toBe(10 - LIMIT)
  })
})

describe('the voice cap with occlusion routes and with files', () => {
  it('makes no occlusion node for a request that is dropped, and the kept ones get theirs', () => {
    const at = (index: number) => ({ position: [1 + index * 0.3, 0, 0] as [number, number, number] })
    const capped = setup({ occlusion: { query: () => [] } })
    const before = capped.count('biquadFilter')
    for (let index = 0; index < 100; index++) capped.engine.play('sfx_pistol', { ...at(index), group: 'crowd' })
    expect(capped.count('biquadFilter')).toBe(before)
    capped.flush()

    const reference = setup({ occlusion: { query: () => [] } })
    const referenceBefore = reference.count('biquadFilter')
    for (let index = 0; index < LIMIT; index++) reference.engine.play('sfx_pistol', at(index))
    reference.flush()
    const made = capped.count('biquadFilter') - before
    expect(made).toBeGreaterThan(0)
    expect(made).toBe(reference.count('biquadFilter') - referenceBefore)
    expect(capped.engine.occludedVoices()).toHaveLength(LIMIT)
  })

  it('caps recorded sounds the same way: the loudest LIMIT are built, in the queue', async () => {
    const { engine, started, nodes, flush } = setup()
    await engine.loadSamples(['hit_file'])
    const before = nodes()
    for (let index = 0; index < 60; index++) engine.play('hit_file', { distance: 1 + ((index * 7) % 60), group: 'crowd' })
    expect(nodes()).toBe(before)
    flush()
    expect(started).toHaveLength(LIMIT)
    expect(started.every((event) => event.kind === 'sample')).toBe(true)
    expect(started.map((event) => event.distance).sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })
})

describe('the manager', () => {
  it('hands out the rule of a group', () => {
    const manager = createVoiceManager({ groups: GROUPS })
    expect(manager.groupRule('crowd')).toEqual({ maxPerBurst: LIMIT })
    expect(manager.groupRule('none')).toBeUndefined()
  })
})

describe('the voice cap and the queue clock', () => {
  let clock = 0
  const freezeTime = (): void => void vi.spyOn(performance, 'now').mockImplementation(() => clock)
  afterEach(() => {
    vi.restoreAllMocks()
    clock = 0
  })
  const budgeted = (engine: ReturnType<typeof setup>['engine'], builds: number): void => {
    const queue = engine.deferredQueue?.() as NonNullable<ReturnType<NonNullable<typeof engine.deferredQueue>>>
    let spent = 0
    queue.run(builds, () => ++spent)
  }

  it('resumes a suspended context inside play for a held sample, not in the queue', async () => {
    const resume = vi.fn(() => Promise.resolve())
    const { engine, flush } = setup({}, { state: 'suspended', resume, close: () => Promise.resolve() })
    await engine.loadSamples(['hit_file'])
    expect(resume).not.toHaveBeenCalled()
    engine.play('hit_file', { distance: 1, group: 'crowd' })
    expect(resume).toHaveBeenCalledTimes(1)
    flush()
  })

  it('under a barrage with a budget below the cap, an ordinary sound asked behind the first settle is built before the next bursts and is never dropped', () => {
    freezeTime()
    const { engine, started } = setup()
    const frames = 10
    let ordinaryAt = -1
    for (let frame = 0; frame < frames; frame++) {
      for (let index = 0; index < 100; index++) engine.play('sfx_pistol', { distance: 1 + index * 0.1, group: 'wide' })
      if (frame === 0) engine.play('sfx_pistol', { distance: 1, delay: 100 })
      budgeted(engine, 3)
      if (ordinaryAt < 0 && started.some((event) => event.startAt > 50)) ordinaryAt = frame
      clock += 16
    }
    expect(ordinaryAt).toBeGreaterThanOrEqual(0)
    expect(ordinaryAt).toBeLessThanOrEqual(3)
    expect(engine.stats().dropped).toBe(0)
    // the kept voices of the first burst were built ahead of the ordinary sound
    const order = started.map((event) => event.startAt > 50)
    expect(order.indexOf(true)).toBe(8)
  })

  it('a kept voice is as old as its settle job: it expires honestly instead of getting a fresh age', () => {
    freezeTime()
    const { engine, started } = setup({ deferredStart: { maxLatencyMs: 250 } })
    for (let index = 0; index < 20; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'wide' })
    clock = 200
    budgeted(engine, 1)
    expect(engine.deferredQueue?.()?.pending()).toBe(8)
    clock = 300
    budgeted(engine, 20)
    expect(started).toHaveLength(0)
    expect(engine.stats().dropped).toBe(8)
  })

  it('does not resume the context for a held sample too quiet to play', async () => {
    const resume = vi.fn(() => Promise.resolve())
    const { engine, started, flush } = setup({}, { state: 'suspended', resume, close: () => Promise.resolve() })
    await engine.loadSamples(['hit_file'])
    expect(engine.play('hit_file', { distance: 5000, group: 'crowd' })).toBeNull()
    flush()
    expect(resume).not.toHaveBeenCalled()
    expect(started).toHaveLength(0)
  })

  it('keeps the boost honest when a late settle drops some of the burst: the survivors still count the requests that lost to louder ones', () => {
    freezeTime()
    const level = (group: string, asked: number, expire: boolean): number => {
      const { engine, started, flush } = setup({ deferredStart: { maxLatencyMs: 100 } })
      for (let index = 0; index < asked; index++) engine.play('sfx_pistol', { distance: 20 + (index % 10), group })
      if (expire) clock = 150
      for (let index = 0; index < 2; index++) engine.play('sfx_pistol', { distance: 5, group })
      flush()
      clock = 0
      return (started.find((event) => event.distance === 5) as VoiceStartEvent).level
    }
    const plain = level('crowd', 100, false)
    const survivors = level('boosted', 100, true)
    // 102 asked, 2 played: the 100 that lost or came late are the share made up for
    expect(survivors).toBeCloseTo(plain * (1 + 0.5 * (100 / 102)), 6)
  })

  it('does not count a closed engine as late', () => {
    freezeTime()
    const { engine, flush } = setup()
    for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    budgeted(engine, 1)
    expect(engine.deferredQueue?.()?.pending()).toBe(LIMIT)
    engine.dispose()
    flush()
    expect(engine.stats().dropped).toBe(0)
  })

  it('drops a kept voice whose turn comes just past the limit, once, though its settle ran just under it', () => {
    freezeTime()
    const { engine, started } = setup({ deferredStart: { maxLatencyMs: 250 } })
    for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    clock = 249
    budgeted(engine, 1)
    expect(engine.deferredQueue?.()?.pending()).toBe(LIMIT)
    clock = 251
    budgeted(engine, 20)
    budgeted(engine, 20)
    expect(started).toHaveLength(0)
    expect(engine.stats().dropped).toBe(LIMIT)
    expect(engine.stats().capped).toBe(10 - LIMIT)
  })

  it('a late settle drops only the requests that are themselves late; the fresh ones get a new settle', () => {
    freezeTime()
    const { engine, started, flush } = setup({ deferredStart: { maxLatencyMs: 100 } })
    for (let index = 0; index < LIMIT; index++) engine.play('sfx_pistol', { distance: 20 + index, group: 'crowd' })
    clock = 150
    for (let index = 0; index < 2; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    flush()
    expect(started).toHaveLength(2)
    expect(started.every((event) => event.distance < 3)).toBe(true)
    expect(engine.stats().dropped).toBe(2)
    expect(engine.deferredQueue?.()?.pending()).toBe(0)
  })
})
