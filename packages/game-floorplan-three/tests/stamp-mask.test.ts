import { describe, expect, it } from 'vitest'

import { stampMask } from '../src/destruction/stamp-mask'

const gridOf = (w: number, h: number) => ({ data: new Uint8Array(w * h), w, h, len: 1, y0: 0, height: 1 })

describe('the stamp of a hole on a wall mask', () => {
  it('marks the texels whose centre is inside the box and nothing else', () => {
    const grid = gridOf(10, 10)
    stampMask(grid, { s0: 0.2, s1: 0.4, y0: 0.2, y1: 0.4, reach: 0 }, (s, y) => s >= 0.2 && s <= 0.4 && y >= 0.2 && y <= 0.4)
    expect(grid.data.filter((value) => value === 255).length).toBe(4)
  })

  it('never asks again about a texel an earlier hole already put through: overlapping holes cost their new texels only', () => {
    const grid = gridOf(100, 100)
    let asked = 0
    const everywhere = (): boolean => (asked++, true)
    stampMask(grid, { s0: 0, s1: 1, y0: 0, y1: 1, reach: 0 }, everywhere)
    expect(asked).toBe(10000)
    asked = 0
    stampMask(grid, { s0: 0.2, s1: 0.6, y0: 0.2, y1: 0.6, reach: 0.05 }, everywhere)
    expect(asked).toBe(0)
  })
})
