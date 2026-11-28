import { describe, expect, it } from 'vitest'
import { bodyworkValues, skinHitSound } from '../src/test-area/bodywork-effect'
import { defaultEffectIds, defaultSoundIds } from '../src/test-area/types'

describe('a round into the thin sheet of a car body', () => {
  it('asks the bodywork effect (sparks, flash, flakes, no mark of its own), not impact_metal and its decal in the air', () => {
    expect(defaultEffectIds.sparks).toBe('impact_bodywork')
  })

  it('hands the effect the hole, the round’s path and the paint', () => {
    expect(bodyworkValues({ type: 'hole', hole: { diameter: 0.009 }, direction: [1, 0, 0] }, 0x8a1c1c)).toEqual({ bore: 0.009, paint: 0x8a1c1c, dx: 1, dy: 0, dz: 0 })
  })

  it('rings the sheet by calibre: a pellet’s tick, a 9 mm, a rifle round, a slug on the heavier recording', () => {
    const pellet = skinHitSound(undefined, defaultSoundIds)
    const rifle = skinHitSound(0.0057, defaultSoundIds)
    const pistol = skinHitSound(0.009, defaultSoundIds)
    const slug = skinHitSound(0.0185, defaultSoundIds)
    expect([pellet.sound, rifle.sound, pistol.sound]).toEqual(['metal_thin', 'metal_thin', 'metal_thin'])
    expect(slug.sound).toBe('metal_bullet')
    expect(pellet.volume).toBeLessThan(pistol.volume)
    expect(rifle.volume).toBeLessThan(pistol.volume)
    expect(slug.volume).toBeGreaterThan(pistol.volume)
    for (const sound of [pellet, rifle, pistol, slug]) expect(sound.volume).toBeLessThanOrEqual(1)
  })
})
