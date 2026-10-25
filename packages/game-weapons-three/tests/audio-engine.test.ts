import { GAME_SFX_CLASSES, DISTANCE_CURVES, createAudioEngine, createAudioSink } from '@adatechnology/game-audio'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createWeaponAudio, GAME_DISTANCE_CURVE, GAME_SOUND_CLASSES } from '../src'

// The weapon audio runs on game-audio (T6.1e). The byte-for-byte trace is in audio-trace.test.ts; this file covers the engine option and the data both packages hold.
describe('weapon audio on game-audio', () => {
  it('keeps the game classes and distance curve equal to the ones game-audio ships', () => {
    for (const row of GAME_SFX_CLASSES) expect(GAME_SOUND_CLASSES[row.id as keyof typeof GAME_SOUND_CLASSES]).toEqual([row.cutoff, row.gain, row.seconds])
    const curve = DISTANCE_CURVES.game_sfx
    expect(GAME_DISTANCE_CURVE).toEqual({ gainFalloff: curve.k, cutoffFalloff: curve.cutoffK, minGain: curve.minGain })
  })

  it('plays on an engine the host lends, on the weapons bus, and leaves that engine open on dispose', () => {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: 4, mix: 'game', createContext: () => recorder.context })
    const audio = createWeaponAudio(0.6, { seed: 4, engine })
    audio.shot(500, 'pistol', { distance: 10 })
    audio.event({ type: 'empty', at: 0 })
    expect(engine.stats().voices).toBeGreaterThan(0)
    expect(recorder.trace().entries.filter((entry) => entry.op === 'start').length).toBeGreaterThan(3)
    const before = recorder.trace().entries.filter((entry) => entry.op === 'close').length
    audio.dispose()
    expect(recorder.trace().entries.filter((entry) => entry.op === 'close').length).toBe(before)
  })

  it('gives a module on a shared engine its own stream, whatever else plays on the engine', () => {
    const starts = (extra: boolean) => {
      const recorder = createAudioRecorder()
      const engine = createAudioEngine({ seed: 4, mix: 'game', createContext: () => recorder.context })
      const audio = createWeaponAudio(0.6, { seed: 9, engine })
      if (extra) {
        engine.register({ id: 'other', sounds: [{ id: 'blip', bus: 'world', order: 'weapon', duration: 0.1, layers: [{ source: { kind: 'noise', offset: 'fit' }, envelope: [[0, 1, 'set']] }], sources: ['test'] }] })
        engine.play('blip')
      }
      audio.play('glass', 1, 0)
      return recorder.trace().entries.filter((entry) => entry.op === 'start').map((entry) => entry.args)
    }
    expect(starts(true).slice(-1)).toEqual(starts(false).slice(-1))
  })

  it('works through a host sink that carries the engine', () => {
    const engine = createAudioEngine({ mix: 'game', createContext: () => null })
    expect(createAudioSink(engine).engine).toBe(engine)
    expect(() => createWeaponAudio(0.6, { engine }).shot(500, 'pistol')).not.toThrow()
  })
})
