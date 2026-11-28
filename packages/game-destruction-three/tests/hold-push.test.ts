import { describe, expect, it } from 'vitest'

import { holdPush } from '../src/engine-pieces'

const g = 9.81
/** The moment of inertia per kilogram of a box about an axis through its centre: a third of the squares of its two half sizes across that axis. */
const turningOf = (a: number, b: number): number => (a * a + b * b) / 3

// the strong push of the balancing rule is for what stands on a narrow support; on what lies flat it was thousands of rad/s² (boards doing pirouettes under a burst)
describe('the push that ends a balancing act (holdPush)', () => {
  it('a 5 cm leg 74 cm tall standing on its end is pushed as before: 4 times the point-mass bound, over the 3 times that tips it in the engine', () => {
    const push = holdPush({ edge: 0.03, height: 0.37, gravity: g, turning: turningOf(0.37, 0.03) })
    const point = (g * 0.03) / (0.37 * 0.37 + 0.03 * 0.03)
    expect(push).toBeCloseTo(4 * point, 6)
    expect(push).toBeGreaterThan(3 * point)
  })

  it('a board 4.4 m long lying flat, touching by one point 5 mm off its centre for an instant, is hardly pushed: under 1 rad/s², where the point-mass bound gave 3 900', () => {
    const lying = { edge: 0.005, height: 0.005, gravity: g }
    expect((4 * g * lying.edge) / (lying.height ** 2 + lying.edge ** 2)).toBeGreaterThan(3000)
    // about the horizontal axis across its length
    expect(holdPush({ ...lying, turning: turningOf(2.2, 0.02) })).toBeLessThan(1)
  })

  it('a table leg lying on the floor is not spun up either: one update at 60 Hz gives it under 0.2 rad/s about the axis across it, where it gave 30', () => {
    const push = holdPush({ edge: 0.005, height: 0.03, gravity: g, turning: turningOf(0.37, 0.03) })
    expect(push / 60).toBeLessThan(0.2)
  })

  it('it is never more than 6 times what gravity gives the body about that edge, whatever the edge and the height', () => {
    for (const edge of [0.001, 0.01, 0.1, 0.5]) for (const height of [0.001, 0.02, 0.4, 1.5]) for (const turning of [1e-4, 0.01, 0.5, 2]) {
      const gravityGives = (g * edge) / (turning + height * height + edge * edge)
      expect(holdPush({ edge, height, gravity: g, turning })).toBeLessThanOrEqual(6 * gravityGives + 1e-9)
    }
  })

  it('with no arm at all there is nothing to push about', () => {
    expect(holdPush({ edge: 0, height: 0, gravity: g, turning: 0.1 })).toBe(0)
  })
})
