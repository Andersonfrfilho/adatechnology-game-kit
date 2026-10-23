import { describe, expect, it } from 'vitest'
import { installDeterminism, withDeterminism } from '../src'
import type { DeterminismTarget } from '../src'

function createTarget(): DeterminismTarget {
  return { Math: { random: () => 0.5 }, Date: { now: () => 123 }, performance: { now: () => 456 } }
}

describe('installDeterminism', () => {
  it('replaces Math.random with the seeded sequence', () => {
    const target = createTarget()
    installDeterminism({ seed: 9, target })
    const first = [target.Math.random(), target.Math.random()]
    installDeterminism({ seed: 9, target })
    expect([target.Math.random(), target.Math.random()]).toEqual(first)
  })

  it('freezes the clocks until they are advanced', () => {
    const target = createTarget()
    const environment = installDeterminism({ seed: 1, startTimeMs: 1000, target })
    expect(target.Date.now()).toBe(1000)
    expect(target.performance.now()).toBe(0)
    environment.advance(250)
    expect(target.Date.now()).toBe(1250)
    expect(target.performance.now()).toBe(250)
  })

  it('steps animation frames with fake timestamps, one generation per frame', () => {
    const target = createTarget()
    const environment = installDeterminism({ seed: 1, target })
    const timestamps: number[] = []
    const loop = (timestamp: number): void => {
      timestamps.push(timestamp)
      target.requestAnimationFrame?.(loop)
    }
    target.requestAnimationFrame?.(loop)
    environment.stepFrames(3, 10)
    expect(timestamps).toEqual([10, 20, 30])
  })

  it('does not run cancelled frames', () => {
    const target = createTarget()
    const environment = installDeterminism({ seed: 1, target })
    let calls = 0
    const handle = target.requestAnimationFrame?.(() => calls++)
    target.cancelAnimationFrame?.(handle as number)
    environment.stepFrames(2)
    expect(calls).toBe(0)
  })

  it('restores everything it replaced', () => {
    const target = createTarget()
    const originalRandom = target.Math.random
    const environment = installDeterminism({ seed: 1, target })
    environment.restore()
    expect(target.Math.random).toBe(originalRandom)
    expect(target.Date.now()).toBe(123)
    expect(target.performance.now()).toBe(456)
    expect(target.requestAnimationFrame).toBeUndefined()
  })
})

describe('withDeterminism', () => {
  it('restores the real Math.random even when the callback throws', () => {
    const realRandom = Math.random
    expect(() =>
      withDeterminism({ seed: 3 }, () => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(Math.random).toBe(realRandom)
  })
})
