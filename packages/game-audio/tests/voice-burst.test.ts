import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { GAME_SFX_BANK, VOICE_GROUPS, createAudioEngine, createVoiceManager } from '../src'
import type { VoiceGroup, VoiceStartEvent } from '../src'

const LIMIT = 4
const GROUPS: Readonly<Record<string, VoiceGroup>> = {
  crowd: { maxPerBurst: LIMIT },
  boosted: { maxPerBurst: LIMIT, burstBoost: 1.5 },
  other: { maxPerBurst: LIMIT },
}

const setup = (options: Parameters<typeof createAudioEngine>[0] = {}) => {
  const recorder = createAudioRecorder()
  const started: VoiceStartEvent[] = []
  const engine = createAudioEngine({
    banks: [GAME_SFX_BANK],
    mix: 'game',
    maxVoices: 500,
    groups: GROUPS,
    deferredStart: {},
    createContext: () => recorder.context,
    onVoiceStart: (event) => started.push(event),
    ...options,
  })
  engine.warmUp()
  const nodes = (): number => ['createGain', 'createBiquadFilter', 'createBufferSource', 'createOscillator'].reduce((sum, name) => sum + JSON.stringify(recorder.trace().entries).split(`"${name}"`).length - 1, 0)
  const flush = (): void => engine.deferredQueue?.()?.flush?.()
  return { engine, recorder, started, nodes, flush }
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
    expect(capped.nodes() - before).toBe(reference.nodes() - referenceBefore)
    expect(capped.engine.stats().capped).toBe(276 - LIMIT)
  })

  it('keeps the loudest, whatever order they were asked in', () => {
    const { engine, started, flush } = setup()
    const distances = Array.from({ length: 40 }, (_, index) => ((index * 17) % 40) + 1)
    for (const distance of distances) engine.play('sfx_pistol', { distance, group: 'crowd' })
    flush()
    expect(started.map((event) => event.distance).sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('breaks a tie by the order the sounds were asked in', () => {
    const { engine, started, flush } = setup()
    for (let index = 0; index < 12; index++) engine.play('sfx_pistol', { distance: 5, delay: index, group: 'crowd' })
    flush()
    const delays = started.map((event) => event.startAt - (started[0] as VoiceStartEvent).startAt).sort((a, b) => a - b)
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
    for (let index = 0; index < 50; index++) plain.engine.play('sfx_pistol', { distance: 1 })
    plain.flush()
    expect(plain.started).toHaveLength(50)
    expect(plain.engine.stats().capped).toBe(0)

    const withoutQueue = setup({ deferredStart: undefined })
    for (let index = 0; index < 50; index++) withoutQueue.engine.play('sfx_pistol', { distance: 1 + index * 0.3, group: 'crowd' })
    expect(withoutQueue.started).toHaveLength(50)
  })

  it('an urgent play is never held', () => {
    const { engine, started } = setup()
    for (let index = 0; index < 10; index++) expect(engine.play('sfx_pistol', { distance: 1, group: 'crowd', urgent: true })).not.toBeNull()
    expect(started).toHaveLength(10)
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

  it('adds no wait of its own: the kept voices are built by the same drain that settles the burst', () => {
    const { engine, started, flush } = setup()
    for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    expect(started).toHaveLength(0)
    flush()
    expect(started).toHaveLength(LIMIT)
    expect(engine.deferredQueue?.()?.pending()).toBe(0)
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

  it('drops what is held when the engine closes', () => {
    const { engine, started, flush } = setup()
    for (let index = 0; index < 10; index++) engine.play('sfx_pistol', { distance: 1 + index, group: 'crowd' })
    engine.dispose()
    flush()
    expect(started).toHaveLength(0)
  })
})

describe('the shipped impact group and the manager', () => {
  it('names the group of impacts, with a cap below the global one', () => {
    expect(VOICE_GROUPS.impact_burst?.maxPerBurst).toBe(16)
    expect(VOICE_GROUPS.impact_burst?.burstBoost).toBeGreaterThan(1)
    expect(createVoiceManager().stats().maxVoices).toBeGreaterThan(VOICE_GROUPS.impact_burst?.maxPerBurst ?? Infinity)
  })

  it('the manager hands out the rule of a group', () => {
    const manager = createVoiceManager({ groups: GROUPS })
    expect(manager.groupRule('crowd')).toEqual({ maxPerBurst: LIMIT })
    expect(manager.groupRule('none')).toBeUndefined()
  })
})
