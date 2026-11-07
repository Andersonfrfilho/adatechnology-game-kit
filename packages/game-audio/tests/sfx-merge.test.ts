import { describe, expect, it } from 'vitest'

import { mergeUserSfxManifests } from '../scripts/sfx-merge.mjs'

describe('the game sounds and the sfx:user sounds served together', () => {
  const game = { version: 1, sounds: [{ id: 'masonry_bullet', layers: { body: [{ file: 'armas/audio/a.ogg' }] } }] }
  const user = {
    version: 1,
    sounds: [
      { id: 'masonry_bullet', layers: { body: [{ file: 'impacto/x.ogg' }] } },
      { id: 'ricochet_stone', layers: { body: [{ file: 'impacto/r1.ogg' }, { file: 'impacto/r2.ogg' }], tail: [{ file: 'impacto/t.ogg' }] } },
    ],
  }

  it('keeps every game sound as it is and adds only the ids it lacks', () => {
    const { manifest, added } = mergeUserSfxManifests(game, user, '_sfx-user/')
    expect(added).toEqual(['ricochet_stone'])
    expect(manifest.sounds.map((s) => s.id)).toEqual(['masonry_bullet', 'ricochet_stone'])
    expect(manifest.sounds[0]).toBe(game.sounds[0])
    expect(manifest.version).toBe(1)
  })

  it('points the added files at the folder .sfx-local is linked to', () => {
    const ricochet = mergeUserSfxManifests(game, user, '_sfx-user/').manifest.sounds[1]
    expect(ricochet?.layers?.body?.map((f) => f.file)).toEqual(['_sfx-user/impacto/r1.ogg', '_sfx-user/impacto/r2.ogg'])
    expect(ricochet?.layers?.tail?.map((f) => f.file)).toEqual(['_sfx-user/impacto/t.ogg'])
  })
})
