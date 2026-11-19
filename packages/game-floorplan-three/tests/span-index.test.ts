import { describe, expect, it } from 'vitest'

import { indexSpansAlong } from '../src/destruction/span-index'
import { isCoreThrough } from '../src/destruction/stamp-mask'

describe('the holes of a wall bucketed along it', () => {
  it('gives every span within the pad of a point along the wall, for random spans and points', () => {
    let seed = 11
    const next = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    const spans = Array.from({ length: 300 }, () => {
      const a = next() * 12
      return { a, b: a + next() * 0.4 }
    })
    const pad = 0.17
    const at = indexSpansAlong(spans, pad)
    for (let k = 0; k < 2000; k++) {
      const s = next() * 13 - 0.5
      const near = spans.filter((span) => s >= span.a - pad && s <= span.b + pad)
      const offered = at(s)
      expect(near.every((span) => offered.includes(span))).toBe(true)
      expect(offered.length).toBeLessThan(spans.length / 4)
    }
  })
})

describe('the hole a shot breaks through a unit', () => {
  it('asks the noise only in the ring of its depth, and answers as asking it everywhere would', () => {
    const depth = 0.35 * 0.03
    let asked = 0
    for (let distance = -0.03; distance <= 0.01; distance += 0.0003) {
      for (const value of [0, 0.4, 1]) {
        const everywhere = distance <= -depth * value
        expect(isCoreThrough(distance, depth, () => (asked++, value))).toBe(everywhere)
      }
    }
    asked = 0
    isCoreThrough(0.002, depth, () => (asked++, 0.5))
    isCoreThrough(-0.02, depth, () => (asked++, 0.5))
    expect(asked).toBe(0)
  })
})
