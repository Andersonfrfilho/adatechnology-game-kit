import { describe, expect, it } from 'vitest'

import { seatLights } from '../src/lights/sticky-slots'

const key = (name: string): string => name

describe('seating room lights in the budget slots', () => {
  it('keeps a light in the slot it had when the order of distance changes', () => {
    const first = seatLights(['a', 'b', 'c'], key, [], 4, 2)
    expect(first.slice(0, 3)).toEqual(['a', 'b', 'c'])
    const swapped = seatLights(['b', 'a', 'c'], key, first, 4, 2)
    expect(swapped).toEqual(['a', 'b', 'c', undefined])
  })

  it('does not move a shadow-casting light into a slot without shadow, nor the reverse', () => {
    const previous = ['a', 'b', 'c', undefined]
    const seats = seatLights(['c', 'a', 'b'], key, previous, 4, 2)
    expect(seats.slice(0, 2).sort()).toEqual(['a', 'c'])
    expect(seats[2]).toBe('b')
  })

  it('gives a new light a free slot of its kind and drops the one that left', () => {
    const seats = seatLights(['a', 'd'], key, ['a', 'b', undefined, undefined], 4, 2)
    expect(seats[0]).toBe('a')
    expect(seats[1]).toBe('d')
  })
})
