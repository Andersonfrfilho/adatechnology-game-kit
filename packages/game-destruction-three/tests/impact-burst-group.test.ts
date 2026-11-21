import { createAudioEngine } from '@adatechnology/game-audio'
import type { VoiceStartEvent } from '@adatechnology/game-audio'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { DESTRUCTION_SOUND_BANK, DESTRUCTION_VOICE_GROUPS, IMPACT_BURST_GROUP, createDestructionSound } from '../src'

const HITS = 200
const CAP = DESTRUCTION_VOICE_GROUPS[IMPACT_BURST_GROUP]?.maxPerBurst as number

function burst(withGroups: boolean): { started: VoiceStartEvent[]; capped: number } {
  const recorder = createAudioRecorder()
  const started: VoiceStartEvent[] = []
  const engine = createAudioEngine({
    mix: 'art_scene',
    banks: [DESTRUCTION_SOUND_BANK],
    createContext: () => recorder.context,
    onVoiceStart: (event) => started.push(event),
    deferredStart: {},
    ...(withGroups ? { groups: DESTRUCTION_VOICE_GROUPS } : {}),
  })
  engine.warmUp()
  const sound = createDestructionSound(engine, {})
  for (let index = 0; index < HITS; index++) sound.onSound('impact_metal_ballistic', [1 + (index % 20), 0, 1], 1, { keys: ['impact_metal_ballistic'] })
  engine.deferredQueue?.()?.flush?.()
  return { started, capped: engine.stats().capped }
}

describe('impacts share one capped voice group', () => {
  it('a burst of impacts builds only the cap of voices, the loudest ones', () => {
    const { started, capped } = burst(true)
    expect(CAP).toBe(16)
    expect(started).toHaveLength(CAP)
    expect(capped).toBe(HITS - CAP)
    expect(Math.max(...started.map((event) => event.distance))).toBeLessThan(5)
  })

  it('an engine built without the groups plays every impact, as before', () => {
    const { started, capped } = burst(false)
    expect(started.length).toBeGreaterThan(CAP)
    expect(capped).toBe(0)
  })
})
