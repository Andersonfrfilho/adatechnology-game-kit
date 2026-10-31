import { describe, expect, it } from 'vitest'
import { createDoorUse, swingSecondsFor } from '../src'

const run = (use: ReturnType<typeof createDoorUse>, isFree: (from: number, to: number) => boolean = () => true, seconds = 5) => {
  const steps = []
  for (let t = 0; t < seconds && (steps.length === 0 || use.phase !== 'idle'); t += 1 / 60) steps.push(use.step(1 / 60, isFree))
  return steps
}

describe('door use', () => {
  it('reaches the handle, swings the leaf open and lets go', () => {
    const use = createDoorUse()
    expect(use.begin({ opening: 0, massKg: 10 })).toBe(1)
    const steps = run(use)
    expect(steps[0]?.phase).toBe('reach')
    expect(steps.some((s) => s.phase === 'swing')).toBe(true)
    expect(steps.some((s) => s.arrived)).toBe(true)
    expect(use.opening).toBe(1)
    expect(use.phase).toBe('idle')
  })

  it('closes an open leaf', () => {
    const use = createDoorUse()
    expect(use.begin({ opening: 1, massKg: 10 })).toBe(0)
    run(use)
    expect(use.opening).toBe(0)
  })

  it('a heavier leaf swings slower', () => {
    expect(swingSecondsFor(25)).toBeGreaterThan(swingSecondsFor(5))
    expect(swingSecondsFor(1000)).toBe(1.6)
  })

  it('stops at the first thing in the way', () => {
    const use = createDoorUse()
    use.begin({ opening: 0, massKg: 10 })
    const steps = run(use, (_from, to) => to <= 0.42)
    expect(steps.some((s) => s.block === 'obstacle')).toBe(true)
    expect(use.opening).toBeLessThanOrEqual(0.42)
    expect(use.opening).toBeGreaterThan(0.35)
  })

  it('a locked leaf rattles and does not move', () => {
    const use = createDoorUse()
    expect(use.begin({ opening: 0, massKg: 10, locked: true })).toBeNull()
    const steps = run(use)
    expect(steps.every((s) => s.phase === 'rattle' || s.phase === 'idle')).toBe(true)
    expect(steps[0]?.block).toBe('locked')
    expect(use.opening).toBe(0)
  })

  it('a leaf left half open goes the other way from the last use: a door blocked while opening closes', () => {
    const use = createDoorUse()
    expect(use.begin({ opening: 0.17, massKg: 20, lastGoal: 1 })).toBe(0)
    use.cancel()
    expect(use.begin({ opening: 0.6, massKg: 20, lastGoal: 0 })).toBe(1)
    use.cancel()
    // with no last use, a half-open leaf opens as before
    expect(use.begin({ opening: 0.17, massKg: 20 })).toBe(1)
  })

  it('at an end the last use does not count: a leaf put back closed (a reset) opens', () => {
    const use = createDoorUse()
    expect(use.begin({ opening: 0, massKg: 20, lastGoal: 1 })).toBe(1)
    use.cancel()
    expect(use.begin({ opening: 1, massKg: 20, lastGoal: 0 })).toBe(0)
  })

  it('a second use in the middle of the swing turns it round', () => {
    const use = createDoorUse()
    use.begin({ opening: 0, massKg: 10 })
    for (let i = 0; i < 30; i++) use.step(1 / 60, () => true)
    expect(use.phase).toBe('swing')
    expect(use.begin({ opening: use.opening, massKg: 10 })).toBe(0)
    run(use)
    expect(use.opening).toBe(0)
  })
})
