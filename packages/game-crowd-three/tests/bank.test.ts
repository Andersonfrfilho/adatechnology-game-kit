import { createSoundRegistry } from '@adatechnology/game-audio'
import { HERD_ROLES } from '@adatechnology/game-crowd'
import { describe, expect, it } from 'vitest'

import { CROWD_SOUND_BANK, HERD_SOUND_IDS } from '../src'

describe('CROWD_SOUND_BANK', () => {
  it('has the crowd voices and a recipe for every call of the herd roles', () => {
    const registry = createSoundRegistry([CROWD_SOUND_BANK])
    for (const id of ['groan', 'runner_groan', 'scream_hoarse']) expect(registry.sound(id)?.id).toBe(id)
    const calls = Object.values(HERD_ROLES).flatMap((role) => [role.fleeCall?.sound, role.alarm?.sound, role.call?.sound, role.guard?.sound].filter((s): s is string => !!s))
    expect(calls.length).toBeGreaterThan(0)
    for (const sound of calls) expect(registry.sound(HERD_SOUND_IDS[sound]!)).toBeDefined()
  })
})
