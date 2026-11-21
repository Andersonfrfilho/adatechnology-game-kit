import { VOICE_GROUPS, createAudioEngine } from '@adatechnology/game-audio'
import type { VoiceStartEvent } from '@adatechnology/game-audio'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { DESTRUCTION_SOUND_BANK, createDestructionSound } from '../src'

const HITS = 200

function burst(deferredStart: boolean): { started: VoiceStartEvent[]; capped: number } {
  const recorder = createAudioRecorder()
  const started: VoiceStartEvent[] = []
  const engine = createAudioEngine({ mix: 'art_scene', banks: [DESTRUCTION_SOUND_BANK], createContext: () => recorder.context, onVoiceStart: (event) => started.push(event), ...(deferredStart ? { deferredStart: {} } : {}) })
  engine.warmUp()
  const sound = createDestructionSound(engine, {})
  for (let index = 0; index < HITS; index++) sound.onSound('impact_metal_ballistic', [1 + (index % 20), 0, 1], 1, { keys: ['impact_metal_ballistic'] })
  engine.deferredQueue?.()?.flush?.()
  return { started, capped: engine.stats().capped }
}

describe('impacts share one capped voice group', () => {
  it('a burst of impacts builds only the cap of voices, the loudest ones', () => {
    const { started, capped } = burst(true)
    const cap = VOICE_GROUPS.impact_burst?.maxPerBurst as number
    expect(started).toHaveLength(cap)
    expect(capped).toBe(HITS - cap)
    expect(Math.max(...started.map((event) => event.distance))).toBeLessThan(5)
  })

  it('without the deferred start queue nothing is held, as before', () => {
    expect(burst(false).started.length).toBeGreaterThan(VOICE_GROUPS.impact_burst?.maxPerBurst ?? 0)
  })
})
