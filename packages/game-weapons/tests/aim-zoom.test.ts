import { describe, expect, it } from 'vitest'

import { aimZoomOf, createArsenal } from '../src'

describe('aimZoomOf', () => {
  const arsenal = createArsenal()

  it('takes the magnification of the optic fitted: the AUG\'s integral 1.5x, an ACOG 4x', () => {
    expect(aimZoomOf(arsenal, 'steyr_aug_a1')).toBe(1.5)
    expect(aimZoomOf(arsenal, 'colt_m4a1', ['acog_4x'])).toBe(4)
  })

  it('closes the view in by the iron sights of the category on a gun with no optic, and not at all for what does not aim', () => {
    expect(aimZoomOf(arsenal, 'ak_47')).toBe(arsenal.rules.aim.ironSightZoom.rifle)
    expect(aimZoomOf(arsenal, 'glock_17')).toBe(arsenal.rules.aim.ironSightZoom.pistol)
    expect(aimZoomOf(arsenal, 'ak_47')).toBeGreaterThan(aimZoomOf(arsenal, 'glock_17'))
    expect(aimZoomOf(arsenal, 'machete')).toBe(1)
    expect(aimZoomOf(arsenal, 'no_such_weapon')).toBe(1)
  })

  it('follows the rules of the game', () => {
    const custom = createArsenal({ rules: { aim: { ironSightZoom: { rifle: 2 } } } })
    expect(aimZoomOf(custom, 'ak_47')).toBe(2)
  })
})
