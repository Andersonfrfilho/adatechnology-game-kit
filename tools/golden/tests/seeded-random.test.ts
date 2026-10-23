import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '../src'

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const first = createSeededRandom(42)
    const second = createSeededRandom(42)
    expect(Array.from({ length: 20 }, first)).toEqual(Array.from({ length: 20 }, second))
  })

  it('produces different sequences for different seeds', () => {
    expect(createSeededRandom(1)()).not.toBe(createSeededRandom(2)())
  })

  it('stays inside [0, 1) and spreads across the range', () => {
    const random = createSeededRandom(7)
    const samples = Array.from({ length: 2000 }, random)
    expect(samples.every((value) => value >= 0 && value < 1)).toBe(true)
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })

  it('is pinned to known values so a golden recorded today stays valid', () => {
    const random = createSeededRandom(1)
    expect([random(), random(), random()].map((value) => Math.round(value * 1e6) / 1e6)).toEqual([0.627074, 0.002736, 0.527447])
  })
})
