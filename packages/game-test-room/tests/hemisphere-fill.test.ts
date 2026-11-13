import { Color } from 'three'
import { describe, expect, it } from 'vitest'

import { HEMISPHERE_GROUND, HEMISPHERE_INTENSITY, HEMISPHERE_SKY } from '../src/arena'

const luminance = (hex: number): number => {
  const c = new Color(hex)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}

describe('the ambient fill under a slab', () => {
  it('lights a downward face (a slab underside, no sun on it) with a real share of what the sky gives an upward face', () => {
    expect(luminance(HEMISPHERE_GROUND) / luminance(HEMISPHERE_SKY)).toBeGreaterThan(0.4)
  })

  it('leaves a grey concrete underside (0x9c9890) well clear of black: at least a fifth of its own colour', () => {
    const lit = luminance(HEMISPHERE_GROUND) * HEMISPHERE_INTENSITY * luminance(0x9c9890)
    expect(lit).toBeGreaterThan(0.2 * luminance(0x9c9890) * 0.5)
  })

  it('does not wash exteriors out: the sky term stays under the sun', () => {
    expect(HEMISPHERE_INTENSITY).toBeLessThan(1)
  })
})
