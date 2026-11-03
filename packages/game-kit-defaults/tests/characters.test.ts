import { ATTACK_CLIPS, FIRST_PERSON_CLIPS } from '@adatechnology/game-characters-people'
import { describe, expect, it } from 'vitest'

import { defaultCharacterClips } from '../src'

describe('defaultCharacterClips', () => {
  it('hands over the clips of the people pack', () => {
    const clips = defaultCharacterClips()
    expect(clips.strikeClips).toBe(ATTACK_CLIPS)
    expect(clips.firstPersonClips).toBe(FIRST_PERSON_CLIPS)
    expect(clips.strikeClips.length).toBeGreaterThan(0)
  })
})
