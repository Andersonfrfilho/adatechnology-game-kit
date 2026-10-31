import { describe, expect, it } from 'vitest'

import { TWIST_LIFT, twistStroke } from '../src'

describe('a hand turning a part round in strokes', () => {
  it('turns the part only while it holds it, and ends with every stroke turned', () => {
    let last = -1
    const samples = Array.from({ length: 301 }, (_, i) => twistStroke(i / 300))
    for (const s of samples) {
      expect(s.turned).toBeGreaterThanOrEqual(last - 1e-9)
      last = s.turned
    }
    expect(samples[0]!.turned).toBe(0)
    expect(samples.at(-1)!.turned).toBeCloseTo(3 * 1.6, 9)
    for (let i = 1; i < samples.length; i++) {
      // the part never turns while the fingers are open
      if (samples[i]!.grip < 1 && samples[i - 1]!.grip < 1) expect(samples[i]!.turned).toBeCloseTo(samples[i - 1]!.turned, 9)
    }
  })

  it('turns the wrist with the part, then lets go, rises and turns back before the next stroke', () => {
    const holding = twistStroke(0.2)
    expect(holding.grip).toBe(1)
    expect(holding.lift).toBe(0)
    // a third of the way is the end of the first stroke: the wrist is back across its range, the hand open and up
    const back = twistStroke(0.3)
    expect(back.grip).toBeLessThan(0.5)
    expect(back.lift).toBeGreaterThan(0.5)
    expect(twistStroke(0).angle).toBeCloseTo(-0.8, 9)
    expect(twistStroke(0.7 / 3).angle).toBeCloseTo(0.8, 9)
    expect(TWIST_LIFT).toBeGreaterThan(0)
  })

  it('takes the number of strokes and the turn of each one', () => {
    const end = twistStroke(1, { strokes: 5, reach: 1 })
    expect(end.turned).toBeCloseTo(5, 9)
    expect(twistStroke(0.5, { strokes: 1, reach: 2 }).turned).toBeGreaterThan(0.5)
  })
})
