import { createAudioEngine } from '@adatechnology/game-audio'
import { describe, expect, it } from 'vitest'

import { BLAST_KIND_OF, DESTRUCTION_SOUND_KEYS, blastSoundIds, createDestructionSound, impactSoundIds } from '../src'

describe('blastSoundIds', () => {
  it('holds the sound every named explosion plays (the P13, the barrel, the car tank and the rockets included), the far rumble, the indoor tail, the fire and the debris', () => {
    const ids = blastSoundIds()
    const sound = createDestructionSound(createAudioEngine({ createContext: () => null }))
    for (const effect of Object.keys(BLAST_KIND_OF)) expect(ids).toContain(sound.blastSound([0, 0, 0], 1, { effect }))
    for (const id of ['explosion_fuel', 'explosion_car', 'explosion_rocket', 'explosion_far', 'explosion_indoor_tail', 'fire_loop', 'fire_loop_gas', 'fire_crackle', 'fire_pop']) expect(ids).toContain(id)
    for (const id of impactSoundIds(DESTRUCTION_SOUND_KEYS.art_scene)) expect(ids).toContain(id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
