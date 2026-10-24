import { describe, expect, it } from 'vitest'
import { createArcadeDriver, defaultArcadeSpec, runOver } from '../src'

const open = { blocked: () => false }
const go = { throttle: 1, brake: 0, steer: 0, handbrake: false }

describe('arcade driver', () => {
  it('starts standing, accelerates to the top speed and no further', () => {
    const driver = createArcadeDriver()
    for (let i = 0; i < 600; i++) driver.step(go, 1 / 60, open)
    expect(driver.state.v).toBe(defaultArcadeSpec.maxForward)
    expect(driver.state.x).toBeGreaterThan(100)
  })

  it('takes every number as an option, so a heavier truck can differ without touching the core', () => {
    const truck = createArcadeDriver({ accel: 2, maxForward: 10, length: 9, runOver: { killSpeed: 6 } })
    for (let i = 0; i < 600; i++) truck.step(go, 1 / 60, open)
    expect(truck.state.v).toBe(10)
    expect(truck.spec.runOver.killSpeed).toBe(6)
    expect(truck.spec.runOver.knockSpeed).toBe(3)
    expect(defaultArcadeSpec.maxForward).toBe(17)
  })

  it('reverses from a stop and brakes hard against a forward move', () => {
    const driver = createArcadeDriver()
    driver.state.v = 10
    driver.step({ ...go, throttle: 0, brake: 1 }, 0.1, open)
    expect(driver.state.v).toBeCloseTo(10 - 1.2, 9)
    driver.state.v = 0
    for (let i = 0; i < 300; i++) driver.step({ ...go, throttle: 0, brake: 1 }, 1 / 60, open)
    expect(driver.state.v).toBe(defaultArcadeSpec.maxReverse)
  })

  it('emits a noise that grows with speed every half second and a horn on request', () => {
    const driver = createArcadeDriver()
    driver.state.v = 10
    const first = driver.step({ ...go, throttle: 0, horn: true }, 0.01, open)
    expect(first.events.filter((e) => e.type === 'noise').map((e) => (e.type === 'noise' ? [e.source, Math.round(e.radius)] : []))).toEqual([['engine', 45], ['horn', 120]])
    const second = driver.step({ ...go, throttle: 0 }, 0.01, open)
    expect(second.events).toEqual([])
  })

  it('bounces off a wall and reports the crash only above 4 m/s', () => {
    const wall = { blocked: () => true }
    const slow = createArcadeDriver()
    slow.state.v = 3
    expect(slow.step({ ...go, throttle: 0 }, 1 / 60, wall).events.some((e) => e.type === 'crash')).toBe(false)
    expect(slow.state.v).toBeCloseTo(-0.75 * Math.exp(-0.5 / 60) * 1, 1)
    const fast = createArcadeDriver()
    fast.state.v = 12
    const crash = fast.step({ ...go, throttle: 0 }, 1 / 60, wall).events.find((e) => e.type === 'crash')
    expect(crash).toMatchObject({ type: 'crash', hurtDriver: expect.any(Number) })
  })
})

describe('runOver', () => {
  it('pushes below 3 m/s, knocks down from 3 to 8 and kills above 8', () => {
    expect([2, 5, 10].map((v) => runOver(v))).toEqual(['push', 'knock', 'kill'])
    expect(runOver(-10)).toBe('kill')
    expect(runOver(5, { knockSpeed: 6 })).toBe('push')
  })
})
