import { describe, expect, it } from 'vitest'

import { createSeededRandom } from '@adatechnology/golden-tool'

import {
  DISTANCE_CURVES,
  busGain,
  createLoopState,
  createRng,
  createSoundRegistry,
  createVoiceManager,
  cutoffDivisor,
  falloffGain,
  isSilent,
  listenerDistance,
  panFor,
  resolveMix,
  streamFor,
} from '../src'
import type { LoopRecipe, MixProfile, SoundRecipe } from '../src'

describe('rng', () => {
  it('is the golden tool generator, so recipes draw what Math.random gave the team code', () => {
    const ours = createRng(42)
    const golden = createSeededRandom(42)
    for (let index = 0; index < 100; index++) expect(ours()).toBe(golden())
  })

  it('gives each named stream its own sequence', () => {
    expect(streamFor(1, 'weapons')()).not.toBe(streamFor(1, 'voices')())
    expect(streamFor(1, 'weapons')()).toBe(streamFor(1, 'weapons')())
  })
})

describe('falloff', () => {
  it('follows the team curves', () => {
    expect(falloffGain(DISTANCE_CURVES.game_sfx, 1, 10)).toBeCloseTo(1 / 1.4, 12)
    expect(cutoffDivisor(DISTANCE_CURVES.game_sfx, 10)).toBeCloseTo(1.1, 12)
    expect(falloffGain(DISTANCE_CURVES.game_boom, 1, 20)).toBeCloseTo(1.4 / 1.8, 12)
    expect(falloffGain(DISTANCE_CURVES.art_scene, 0.9, 5)).toBeCloseTo(0.9 / 1.2, 12)
    expect(falloffGain(DISTANCE_CURVES.animals, 1, 35)).toBeCloseTo(0.125, 12)
    expect(falloffGain(undefined, 0.7, 100)).toBe(0.7)
  })

  it('silences below minGain, at or below for linear', () => {
    expect(isSilent(DISTANCE_CURVES.game_sfx, falloffGain(DISTANCE_CURVES.game_sfx, 1, 160))).toBe(true)
    expect(isSilent(DISTANCE_CURVES.game_sfx, falloffGain(DISTANCE_CURVES.game_sfx, 1, 120))).toBe(false)
    expect(isSilent(DISTANCE_CURVES.animals, 0.005)).toBe(true)
    expect(isSilent(DISTANCE_CURVES.game_sfx, 0.01)).toBe(false)
    expect(isSilent(DISTANCE_CURVES.art_scene, 0)).toBe(false)
  })
})

describe('listener', () => {
  it('pans like the art scene: right ear from yaw, ±0.85, at least 2 m', () => {
    const listener = { position: [0, 0, 0] as [number, number, number], yaw: 0.6 }
    const position: [number, number, number] = [3, 0, 2]
    const expected = (3 * Math.cos(0.6) + 2 * -Math.sin(0.6)) / Math.hypot(3, 2)
    expect(panFor(listener, position)).toBeCloseTo(expected, 12)
    expect(panFor(listener, [0, 0, 0])).toBe(0)
    expect(panFor({ position: [0, 0, 0], yaw: 0 }, [-50, 0, 0])).toBe(-0.85)
    expect(panFor({ position: [0, 0, 0], yaw: 0 }, [1, 0, 0])).toBe(0.5)
  })

  it('measures on the ground or in 3D', () => {
    const listener = { position: [0, 0, 0] as [number, number, number], yaw: 0 }
    expect(listenerDistance(listener, [3, 12, 4])).toBe(5)
    expect(listenerDistance(listener, [3, 12, 4], '3d')).toBe(13)
  })
})

describe('voice manager', () => {
  it('drops the lowest priority × gain when the global cap is full', () => {
    const manager = createVoiceManager({ maxVoices: 2 })
    const quiet = manager.request({ priority: 1, gain: 0.5, length: 1 })
    const loud = manager.request({ priority: 4, gain: 1, length: 1 })
    expect(quiet.accepted && loud.accepted).toBe(true)
    expect(manager.request({ priority: 1, gain: 0.1, length: 1 })).toEqual({ accepted: false, reason: 'global_full' })
    const weapon = manager.request({ priority: 4, gain: 0.9, length: 1 })
    expect(weapon).toMatchObject({ accepted: true, evicted: [quiet.accepted ? quiet.id : -1] })
    expect(manager.stats()).toEqual({ active: 2, peak: 2, dropped: 2, maxVoices: 2 })
  })

  it('applies group rules: distance, cooldown, concurrency and steal', () => {
    const manager = createVoiceManager({ groups: { undead_voice: { maxConcurrent: 1, cooldown: 0.25, maxDistance: 40 }, horde: { maxConcurrent: 1, steal: true } } })
    expect(manager.request({ group: 'undead_voice', priority: 3, gain: 1, distance: 40, length: 1 })).toEqual({ accepted: false, reason: 'distance' })
    expect(manager.request({ group: 'undead_voice', priority: 3, gain: 1, distance: 5, length: 1 }).accepted).toBe(true)
    expect(manager.request({ group: 'undead_voice', priority: 3, gain: 1, distance: 5, length: 1 })).toEqual({ accepted: false, reason: 'cooldown' })
    manager.advance(0.3)
    expect(manager.request({ group: 'undead_voice', priority: 3, gain: 1, distance: 5, length: 1 })).toEqual({ accepted: false, reason: 'group_full' })
    const first = manager.request({ group: 'horde', priority: 1, gain: 1, length: 5 })
    const second = manager.request({ group: 'horde', priority: 1, gain: 1, length: 5 })
    expect(second).toMatchObject({ accepted: true, evicted: [first.accepted ? first.id : -1] })
  })

  it('lets finished voices go', () => {
    const manager = createVoiceManager()
    const voice = manager.request({ priority: 1, gain: 1, length: 0.5 })
    expect(manager.advance(0.4)).toEqual([])
    expect(manager.advance(0.2)).toEqual([voice.accepted ? voice.id : -1])
    expect(manager.stats().active).toBe(0)
  })
})

describe('loop state', () => {
  const rain: LoopRecipe = { id: 'rain', bus: 'weather', source: { kind: 'noise', loop: true }, sources: ['test'] }
  const engine: LoopRecipe = { id: 'engine', bus: 'world', source: { kind: 'osc', wave: 'sawtooth', frequency: { set: 400 }, loop: true }, sources: ['test'] }

  it('creates the nodes only from 0.002 up, then glides', () => {
    const state = createLoopState(rain)
    expect(state.set({ volume: 0.001 })).toBeNull()
    expect(state.set({ volume: 0.035 })).toEqual({ create: true, volume: 0.035 })
    expect(state.set({ volume: 0 })).toEqual({ create: false, volume: 0 })
    state.reset()
    expect(state.set({ volume: 0 })).toBeNull()
  })

  it('glides the frequency of an oscillator only, and keeps the last volume', () => {
    const state = createLoopState(engine)
    expect(state.set({ volume: 0.04, frequency: 120 })).toEqual({ create: true, volume: 0.04, frequency: 120 })
    expect(state.set({ frequency: 90 })).toEqual({ create: false, volume: 0.04, frequency: 90 })
    expect(createLoopState(rain).set({ volume: 0.1, frequency: 90 })).toEqual({ create: true, volume: 0.1 })
  })

  it('opens with nodes for a chain loop', () => {
    expect(createLoopState({ ...rain, volume: 0 }, true).set({})).toEqual({ create: false, volume: 0 })
  })
})

describe('mix and bank', () => {
  const profile: MixProfile = { id: 'test', master: 0.5, noise: { seconds: 1.5, create: 'lazy' }, sources: ['test'] }

  it('resolves a profile by id or as given', () => {
    expect(resolveMix('test', { test: profile })).toBe(profile)
    expect(resolveMix(profile, {})).toBe(profile)
    expect(() => resolveMix('nope', { test: profile })).toThrow(/nope/)
    expect(busGain(undefined)).toBe(1)
    expect(busGain({ gain: 0.4, muted: true })).toBe(0)
  })

  it('registers, patches by id and removes', () => {
    const sound: SoundRecipe = { id: 'a', bus: 'world', duration: [0.1, 0.2], layers: [], sources: ['test'] }
    const registry = createSoundRegistry([{ id: 'first', sounds: [sound] }])
    registry.patch('a', { duration: 0.5, falloff: { model: 'none' } })
    expect(registry.sound('a')).toMatchObject({ duration: 0.5, falloff: { model: 'none' } })
    expect(Object.keys(registry.sound('a') ?? {})).toEqual(['id', 'bus', 'duration', 'layers', 'sources', 'falloff'])
    registry.register({ id: 'second', sounds: [{ ...sound, bus: 'ui' }] })
    expect(registry.sound('a')?.bus).toBe('ui')
    expect(registry.bankOf('a')).toBe('second')
    registry.remove('a')
    expect(registry.soundIds()).toEqual([])
  })
})
