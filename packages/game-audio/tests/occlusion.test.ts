import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { GAME_SFX_BANK, TRANSMISSION_LOSS, createAudioEngine, createOcclusionTracker, hitLossDb, occlusionState, totalLossDb } from '../src'
import type { OcclusionHit, OcclusionQuery } from '../src'

const BRICK: OcclusionHit = { material: 'brick', thickness: 0.12 }

describe('transmission loss', () => {
  it('a 12 cm brick wall cuts about 40 dB and closes the lowpass', () => {
    const loss = totalLossDb([BRICK])
    expect(loss).toBeGreaterThanOrEqual(40)
    expect(loss).toBeLessThanOrEqual(45)
    const state = occlusionState(loss)
    expect(state.gain).toBeCloseTo(10 ** (-loss / 20), 6)
    expect(state.gain).toBeLessThan(0.01)
    expect(state.cutoff).toBeLessThan(1500)
    expect(occlusionState(0)).toEqual({ lossDb: 0, gain: 1, cutoff: 20000 })
  })

  it('the table holds the real values: drywall, concrete, wooden door, glass', () => {
    const at = (material: string) => hitLossDb({ material, thickness: TRANSMISSION_LOSS[material]?.thickness as number })
    expect(at('drywall')).toBeGreaterThanOrEqual(30)
    expect(at('drywall')).toBeLessThanOrEqual(35)
    expect(at('concrete')).toBeGreaterThanOrEqual(45)
    expect(at('concrete')).toBeLessThanOrEqual(50)
    expect(at('wood_soft')).toBeGreaterThanOrEqual(20)
    expect(at('wood_soft')).toBeLessThanOrEqual(25)
    expect(at('glass')).toBeGreaterThanOrEqual(25)
    expect(at('glass')).toBeLessThanOrEqual(30)
  })

  it('a thicker wall cuts more by the mass law and a thinner one less', () => {
    expect(hitLossDb({ material: 'brick', thickness: 0.24 })).toBeCloseTo(hitLossDb(BRICK) + 6.02, 1)
    expect(hitLossDb({ material: 'brick', thickness: 0.06 })).toBeLessThan(hitLossDb(BRICK))
  })

  it('two walls add, and an open doorway adds nothing', () => {
    expect(totalLossDb([BRICK, BRICK], { maxLossDb: 100 })).toBeCloseTo(2 * totalLossDb([BRICK]), 6)
    expect(totalLossDb([BRICK, { material: 'open' }])).toBeCloseTo(totalLossDb([BRICK]), 6)
    expect(totalLossDb([])).toBe(0)
    expect(totalLossDb([{ lossDb: 0 }])).toBe(0)
  })

  it('the cap keeps a sound that gets around an edge from going silent, and is configurable', () => {
    const walls = [BRICK, BRICK, BRICK, BRICK]
    expect(totalLossDb(walls)).toBe(50)
    expect(totalLossDb(walls, { maxLossDb: 30 })).toBe(30)
    expect(occlusionState(totalLossDb(walls)).gain).toBeGreaterThan(0)
  })

  it('a game patches the table and a hit can carry its own loss', () => {
    expect(hitLossDb({ material: 'moss_wall', thickness: 0.1 }, { materials: { moss_wall: { lossDb: 18, thickness: 0.1 } } })).toBe(18)
    expect(hitLossDb({ material: 'brick', thickness: 0.12 }, { materials: { brick: { lossDb: 10, thickness: 0.12 } } })).toBe(10)
    expect(hitLossDb({ material: 'mystery' }, { unknownLossDb: 7 })).toBe(7)
    expect(hitLossDb({ lossDb: 12, material: 'brick' })).toBe(12)
  })

  it('the lowpass closes by one decade per cutoffDbPerDecade and never below the floor', () => {
    expect(occlusionState(30).cutoff).toBeCloseTo(2000, 3)
    expect(occlusionState(30, { cutoffDbPerDecade: 15, minCutoff: 100 }).cutoff).toBeCloseTo(200, 3)
    expect(occlusionState(30, { cutoffDbPerDecade: 15, minCutoff: 400 }).cutoff).toBe(400)
  })
})

describe('the occlusion tracker', () => {
  const wallAt = (x: number): OcclusionQuery => (from, to) => (Math.min(from[0], to[0]) < x && Math.max(from[0], to[0]) > x ? [BRICK] : [])

  it('queries when a voice is added and starts it at that state', () => {
    let queries = 0
    const query: OcclusionQuery = (from, to) => (queries++, wallAt(0)(from, to))
    const tracker = createOcclusionTracker({ query })
    const state = tracker.add({ id: 1, source: [-5, 0, 0], level: 1, listener: [5, 0, 0], now: 0 })
    expect(queries).toBe(1)
    expect(state.lossDb).toBeGreaterThanOrEqual(40)
  })

  it('re-queries at the interval, not every frame, and only when the listener moved', () => {
    let queries = 0
    const query: OcclusionQuery = (from, to) => (queries++, wallAt(0)(from, to))
    const tracker = createOcclusionTracker({ query, interval: 0.2 })
    tracker.add({ id: 1, source: [-5, 0, 0], level: 1, listener: [5, 0, 0], now: 0 })
    for (let frame = 1; frame <= 10; frame++) tracker.update([5 + frame, 0, 0], frame * 0.016)
    expect(queries).toBe(1)
    tracker.update([20, 0, 0], 0.25)
    expect(queries).toBe(2)
    tracker.update([20, 0, 0], 0.6)
    expect(queries).toBe(2)
  })

  it('reports the change when the listener walks through the wall, and the doorway opens it', () => {
    const tracker = createOcclusionTracker({ query: wallAt(0), interval: 0.1 })
    tracker.add({ id: 1, source: [-5, 0, 0], level: 1, listener: [5, 0, 0], now: 0 })
    const changes = tracker.update([-3, 0, 0], 0.2)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.state.lossDb).toBe(0)
    expect(changes[0]?.state.gain).toBe(1)
    expect(tracker.update([-3.001, 0, 0], 0.4)).toEqual([])
  })

  it('respects the per-update budget and serves the stalest voice first', () => {
    let queries = 0
    const query: OcclusionQuery = (from, to) => (queries++, wallAt(0)(from, to))
    const tracker = createOcclusionTracker({ query, interval: 0.1, budget: 2 })
    for (let id = 1; id <= 6; id++) tracker.add({ id, source: [-5, 0, 0], level: 1, listener: [5, 0, 0], now: id * 0.001 })
    queries = 0
    const first = tracker.update([-3, 0, 0], 1)
    expect(queries).toBe(2)
    expect(first.map((change) => change.id)).toEqual([1, 2])
    expect(tracker.update([-3, 0, 0], 1.0001).map((change) => change.id)).toEqual([3, 4])
    expect(tracker.update([-3, 0, 0], 1.0002).map((change) => change.id)).toEqual([5, 6])
    expect(tracker.update([-3, 0, 0], 1.0003)).toEqual([])
  })

  it('does not query a voice too quiet to hear, nor one that was removed', () => {
    let queries = 0
    const query: OcclusionQuery = () => (queries++, [])
    const tracker = createOcclusionTracker({ query, interval: 0.1 })
    tracker.add({ id: 1, source: [0, 0, 0], level: 0.0001, listener: [0, 0, 5], now: 0 })
    tracker.add({ id: 2, source: [0, 0, 0], level: 1, listener: [0, 0, 5], now: 0 })
    tracker.remove(2)
    queries = 0
    tracker.update([0, 0, 20], 1)
    expect(queries).toBe(0)
    expect(tracker.size).toBe(1)
  })
})

const filters = (recorder: ReturnType<typeof createAudioRecorder>): number => recorder.trace().entries.filter((entry) => entry.op === 'create' && entry.kind === 'biquadFilter').length

describe('the engine with an occlusion setup', () => {
  const engineWith = (query: OcclusionQuery, extra: Partial<Parameters<typeof createAudioEngine>[0]> = {}) => {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ banks: [GAME_SFX_BANK], createContext: () => recorder.context, occlusion: { query, interval: 0.05 }, ...extra })
    return { recorder, engine }
  }

  it('plays a positioned sound through a lowpass and a gain at the loss the query gave, and not a clear one', () => {
    const behind = engineWith(() => [BRICK])
    expect(behind.engine.play('sfx_pistol', { position: [10, 0, 0] })).not.toBeNull()
    const [voice] = behind.engine.occludedVoices()
    expect(voice?.lossDb).toBeGreaterThanOrEqual(40)
    expect(voice?.cutoff).toBeLessThan(1500)
    const clear = engineWith(() => [])
    clear.engine.play('sfx_pistol', { position: [10, 0, 0] })
    expect(clear.engine.occludedVoices()[0]?.gain).toBe(1)
    expect(filters(behind.recorder)).toBe(filters(clear.recorder))
    expect(clear.engine.occludedVoices()[0]?.cutoff).toBe(20000)
  })

  it('a sound without a position, and an engine without the setup, add no nodes', () => {
    const { engine, recorder } = engineWith(() => [BRICK])
    engine.play('sfx_pistol', { distance: 3 })
    expect(engine.occludedVoices()).toEqual([])
    const plain = createAudioRecorder()
    createAudioEngine({ banks: [GAME_SFX_BANK], createContext: () => plain.context }).play('sfx_pistol', { distance: 3 })
    expect(filters(recorder)).toBe(filters(plain))
  })

  it('ramps a change in the loss with a target approach, never a jump, and queries within the budget as the listener moves', () => {
    let walls: OcclusionHit[] = [BRICK]
    let queries = 0
    const { engine, recorder } = engineWith(() => (queries++, walls), { occlusion: { query: () => (queries++, walls), interval: 0, budget: 1 } })
    engine.play('sfx_pistol', { position: [10, 0, 0] })
    engine.play('sfx_pistol', { position: [11, 0, 0] })
    queries = 0
    walls = []
    engine.setListener({ position: [1, 0, 0], yaw: 0 })
    expect(queries).toBe(1)
    const text = JSON.stringify(recorder.trace().entries)
    expect(text).toContain('setTargetAtTime')
    engine.setListener({ position: [2, 0, 0], yaw: 0 })
    expect(queries).toBe(2)
    expect(engine.occludedVoices().map((voice) => voice.lossDb)).toEqual([0, 0])
  })
})
