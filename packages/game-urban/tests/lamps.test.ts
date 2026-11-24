import { describe, expect, it } from 'vitest'

import { lampStateOf } from '../src'

const spots = Array.from({ length: 2000 }, (_, index) => ({ x: (index % 50) * 32.5, z: Math.floor(index / 50) * 17.25 }))

describe('lampStateOf', () => {
  it('keeps the lit and flickering shares over a long street', () => {
    const states = spots.map((spot) => lampStateOf({ seed: 7, ...spot, shares: { lit: 0.8, flicker: 0.15 } }))
    const on = states.filter((state) => state.on).length / states.length
    const flicker = states.filter((state) => state.flicker).length / states.length
    expect(on).toBeGreaterThan(0.75)
    expect(on).toBeLessThan(0.85)
    expect(flicker).toBeGreaterThan(0.11)
    expect(flicker).toBeLessThan(0.19)
    expect(states.every((state) => state.on || !state.flicker)).toBe(true)
  })

  it('gives the same lamps for the same seed and other lamps for another seed', () => {
    const of = (seed: number) => spots.map((spot) => lampStateOf({ seed, ...spot, shares: { lit: 0.7, flicker: 0.2 } }))
    expect(of(11)).toEqual(of(11))
    expect(of(11)).not.toEqual(of(12))
  })

  it('lights every lamp at lit 1 and none at lit 0', () => {
    expect(spots.every((spot) => lampStateOf({ seed: 3, ...spot, shares: { lit: 1, flicker: 0 } }).on)).toBe(true)
    expect(spots.some((spot) => lampStateOf({ seed: 3, ...spot, shares: { lit: 0, flicker: 0 } }).on)).toBe(false)
  })

  it('refuses a flicker share above the lit one', () => {
    expect(() => lampStateOf({ seed: 1, x: 0, z: 0, shares: { lit: 0.5, flicker: 0.6 } })).toThrow(RangeError)
    expect(() => lampStateOf({ seed: 1, x: 0, z: 0, shares: { lit: 1.2, flicker: 0 } })).toThrow(RangeError)
  })
})
