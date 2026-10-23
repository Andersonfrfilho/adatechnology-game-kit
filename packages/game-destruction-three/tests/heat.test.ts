import { describe, expect, it } from 'vitest'
import { heatColor } from '../src/heat'

const lum = (c: number) => 0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)

describe('heatColor', () => {
  it('is black below 450 C and white from 1400 C', () => {
    expect(heatColor(20)).toBe(0)
    expect(heatColor(450)).toBe(0)
    expect(heatColor(1400)).toBe(0xffffff)
    expect(heatColor(2500)).toBe(0xffffff)
  })

  it('goes dark red, orange, yellow and never gets dimmer as it heats', () => {
    let last = -1
    for (let t = 400; t <= 1600; t += 10) {
      const l = lum(heatColor(t))
      expect(l).toBeGreaterThanOrEqual(last)
      last = l
    }
    const red = heatColor(520)
    expect((red >> 16) & 255).toBeGreaterThan((red >> 8) & 255)
    const yellow = heatColor(1100)
    expect((yellow >> 8) & 255).toBeGreaterThan(150)
    expect(yellow & 255).toBeLessThan(120)
  })
})
