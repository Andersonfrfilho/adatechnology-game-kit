import { Color } from 'three'
import { describe, expect, it } from 'vitest'

import { HEMISPHERE_GROUND, HEMISPHERE_INTENSITY, HEMISPHERE_SKY } from '../src/arena'

const CONCRETE = 0x9c9890
const PREVIOUS_SKY = { color: 0xcfe3ff, intensity: 0.85 }
const linear = (hex: number): Color => new Color(hex)
const toByte = (value: number): number => Math.round(255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055))

/** What a Lambert surface of `albedo` shows under a hemisphere's term: albedo * colour * intensity / pi (three.js lights are not pre-multiplied by pi). */
function shownByte(albedo: number, term: number, channel: 'r' | 'g' | 'b'): number {
  return toByte((linear(albedo)[channel] * term * HEMISPHERE_INTENSITY) / Math.PI)
}

describe('the ambient fill under a slab', () => {
  it('shows a concrete underside (no sun on it, only the ground bounce) as light grey, never near black', () => {
    const ground = linear(HEMISPHERE_GROUND)
    const shown = (['r', 'g', 'b'] as const).map((channel) => shownByte(CONCRETE, ground[channel], channel))
    for (const byte of shown) expect(byte).toBeGreaterThan(110)
  })

  it('keeps what the sky gives an upward face: the sky term is not brighter than before the ground bounce was raised', () => {
    const sky = linear(HEMISPHERE_SKY)
    const before = linear(PREVIOUS_SKY.color)
    for (const channel of ['r', 'g', 'b'] as const) {
      expect(sky[channel] * HEMISPHERE_INTENSITY).toBeLessThanOrEqual(before[channel] * PREVIOUS_SKY.intensity * 1.02)
    }
  })

  it('has a ground bounce that is a real share of the sky term', () => {
    const luminance = (hex: number): number => 0.2126 * linear(hex).r + 0.7152 * linear(hex).g + 0.0722 * linear(hex).b
    expect(luminance(HEMISPHERE_GROUND) / luminance(HEMISPHERE_SKY)).toBeGreaterThan(0.4)
  })
})
