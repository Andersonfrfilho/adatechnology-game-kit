import { describe, expect, it } from 'vitest'
import { lcg, lehmer, streamFor } from '../src'

describe('random streams', () => {
  it('lehmer is the Lab generator: seed * 16807 mod 2^31 - 1, scaled to [0, 1)', () => {
    const stream = lehmer(1)
    expect(stream.next()).toBe((16807 - 1) / 2147483646)
    expect(stream.state).toBe(16807)
    const reference = lehmer(1000)
    let state = 1000
    for (let draw = 0; draw < 50; draw++) {
      state = (state * 16807) % 2147483647
      expect(reference.next()).toBe((state - 1) / 2147483646)
    }
  })

  it('between is one draw scaled, and direction is a unit vector made with two draws', () => {
    const a = lehmer(77)
    const b = lehmer(77)
    expect(a.between(2, 6)).toBe(2 + (6 - 2) * b.next())
    const out = { x: 0, y: 0, z: 0 }
    const reference = lehmer(5)
    const u = reference.next() * 2 - 1
    const angle = reference.next() * Math.PI * 2
    lehmer(5).direction(out)
    expect(out.y).toBe(u)
    expect(out.x).toBe(Math.sqrt(1 - u * u) * Math.cos(angle))
    expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(1, 12)
  })

  it('a seed outside the valid range is folded into it', () => {
    expect(lehmer(0).state).toBe(1)
    expect(lehmer(-5).state).toBe(5)
    expect(lehmer(2147483646).state).toBe(1)
  })

  it('lcg is the Fluid Standard generator', () => {
    const stream = lcg(1)
    let state = 1
    for (let draw = 0; draw < 20; draw++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      expect(stream.next()).toBe(state / 4294967296)
    }
  })

  it('an event seed gives its own repeatable stream', () => {
    const first = streamFor(42)
    const again = streamFor(42)
    const other = streamFor(43)
    const drawn = [first.next(), first.next(), first.next()]
    expect([again.next(), again.next(), again.next()]).toEqual(drawn)
    expect(other.next()).not.toBe(drawn[0])
    for (const value of drawn) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})
