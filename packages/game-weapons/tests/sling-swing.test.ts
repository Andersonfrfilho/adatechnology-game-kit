import { describe, expect, it } from 'vitest'

import { SLING_SWING_DEFAULTS, createSlingSwing } from '../src'

const run = (swing: ReturnType<typeof createSlingSwing>, seconds: number, acceleration: readonly [number, number, number]): void => {
  for (let t = 0; t < seconds; t += 1 / 60) swing.step(1 / 60, acceleration)
}

describe('a rifle hanging on its sling', () => {
  it('hangs still with nothing moving it', () => {
    const swing = createSlingSwing()
    run(swing, 2, [0, 0, 0])
    expect(swing.state).toEqual({ forward: 0, side: 0 })
  })

  it('a body that stops short throws it forward off the body, and it settles back', () => {
    const swing = createSlingSwing()
    run(swing, 0.15, [0, 0, -8])
    expect(swing.state.forward).toBeGreaterThan(0.1)
    expect(swing.state.forward).toBeLessThanOrEqual(SLING_SWING_DEFAULTS.limits.forward)
    run(swing, 4, [0, 0, 0])
    expect(swing.state.forward).toBeLessThan(0.01)
  })

  it('a body that speeds up never swings it back into the body', () => {
    const swing = createSlingSwing()
    for (let t = 0; t < 1; t += 1 / 60) expect(swing.step(1 / 60, [0, 0, 12]).forward).toBeGreaterThanOrEqual(0)
  })

  it('a turn swings it to the side, the other way from the push, within its limit', () => {
    const swing = createSlingSwing()
    run(swing, 0.2, [6, 0, 0])
    expect(swing.state.side).toBeLessThan(-0.05)
    run(swing, 0.5, [-60, 0, 0])
    expect(swing.state.side).toBeLessThanOrEqual(SLING_SWING_DEFAULTS.limits.side)
  })

  it('a long frame gives the same swing as the same time in short ones', () => {
    const long = createSlingSwing()
    const short = createSlingSwing()
    long.step(0.1, [0, 0, -5])
    for (let i = 0; i < 24; i++) short.step(0.1 / 24, [0, 0, -5])
    expect(long.state.forward).toBeCloseTo(short.state.forward, 4)
  })

  it('reset hangs it still again', () => {
    const swing = createSlingSwing()
    run(swing, 0.2, [3, 0, -6])
    swing.reset()
    expect(swing.state).toEqual({ forward: 0, side: 0 })
  })
})
