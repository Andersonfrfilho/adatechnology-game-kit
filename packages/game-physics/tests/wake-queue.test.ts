import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CHIP_SIZE,
  DEFAULT_MAX_PHYSICS_PIECES,
  DEFAULT_MIN_PHYSICS_PIECES,
  DEFAULT_PHYSICS_COST_TARGET_MS,
  DEFAULT_MAX_QUEUED_WAKES,
  DEFAULT_MAX_WAKE_DELAY,
  DEFAULT_MIN_WAKES_PER_FRAME,
  DEFAULT_PHYSICS_COST_PER_BODY_MS,
  DEFAULT_WAKE_COST_PER_BODY_MS,
  DEFAULT_WAKE_COST_TARGET_MS,
  KIT_WORLD,
  PhysicsCostMeter,
  WakeQueue,
} from '../src/index'

const FRAME = 1 / 60

describe('the measured defaults (spec 008, evidence T3.6d)', () => {
  it('are the numbers the B6 production bench was tuned with', () => {
    expect(KIT_WORLD.velocityIterations).toBe(32)
    expect(DEFAULT_WAKE_COST_TARGET_MS).toBe(4)
    expect(DEFAULT_MAX_WAKE_DELAY).toBe(0.08)
    expect(DEFAULT_MAX_QUEUED_WAKES).toBe(2048)
    expect(DEFAULT_MIN_WAKES_PER_FRAME).toBe(8)
    expect(DEFAULT_PHYSICS_COST_PER_BODY_MS).toBe(0.0022)
    expect(DEFAULT_WAKE_COST_PER_BODY_MS).toBe(0.02)
    expect(DEFAULT_MIN_PHYSICS_PIECES).toBe(24)
    expect(DEFAULT_MAX_PHYSICS_PIECES).toBe(300)
    expect(DEFAULT_PHYSICS_COST_TARGET_MS).toBe(5)
    expect(DEFAULT_CHIP_SIZE).toBe(0.15)
  })
})

describe('WakeQueue', () => {
  const fill = (queue: WakeQueue<number>, count: number): void => {
    for (let i = 0; i < count; i++) queue.push(count - i, i)
  }

  it('lets out the lowest priority number first, as many as the cost leaves room for', () => {
    const queue = new WakeQueue<number>()
    fill(queue, 1000)
    // room = (4 ms target - 1 ms last step) / 0.0022 ms per body = 1363 > 1000: everything at once; a heavier last frame leaves less
    const first = new WakeQueue<number>()
    fill(first, 1000)
    const out = first.release(FRAME, 3, 0.0022)
    expect(out).toHaveLength(454)
    expect(out[0]).toBe(999)
    expect(out[1]).toBe(998)
    expect(first.size).toBe(546)
    expect(queue.release(FRAME, 1, 0.0022)).toHaveLength(1000)
  })

  it('keeps letting out the minimum per frame behind a frame over the target', () => {
    const queue = new WakeQueue<number>()
    fill(queue, 100)
    expect(queue.release(FRAME, 12, 0.0022)).toHaveLength(DEFAULT_MIN_WAKES_PER_FRAME)
  })

  it('lets out what waited its maximum, whatever the cost', () => {
    const queue = new WakeQueue<number>()
    fill(queue, 100)
    queue.release(FRAME, 12, 0.0022)
    let total = DEFAULT_MIN_WAKES_PER_FRAME
    for (let t = FRAME; t < DEFAULT_MAX_WAKE_DELAY + 1e-9; t += FRAME) total += queue.release(FRAME, 12, 0.0022).length
    expect(queue.size).toBe(0)
    expect(total).toBe(100)
  })

  it('stays bounded: over the bound the lowest priority go at once', () => {
    const queue = new WakeQueue<number>({ maxQueued: 10, minPerFrame: 2 })
    fill(queue, 50)
    expect(queue.release(FRAME, 50, 1)).toHaveLength(40)
    expect(queue.size).toBe(10)
  })

  it('takes its numbers from the options', () => {
    const queue = new WakeQueue<number>({ costTargetMs: 1, maxDelay: 0.01, minPerFrame: 1 })
    fill(queue, 10)
    expect(queue.release(0.005, 0.5, 0.1)).toHaveLength(5)
    expect(queue.release(0.01, 0.5, 0.1)).toHaveLength(5)
  })

  it('an entry can carry its own maximum wait', () => {
    const queue = new WakeQueue<string>({ minPerFrame: 1 })
    queue.push(1, 'first')
    queue.push(2, 'urgent', 0.001)
    expect(queue.release(0.002, 100, 1)).toEqual(['first', 'urgent'])
  })
})

describe('PhysicsCostMeter', () => {
  it('starts at the priors and follows the aggregate cost per awake body, ignoring frames with few bodies', () => {
    const meter = new PhysicsCostMeter(0.002, 0.02)
    meter.observe(5, 3)
    expect(meter.costPerBodyMs).toBe(0.002)
    meter.observe(2, 200)
    // 200 bodies woke at once: that frame is the wake reading, not the steady one
    expect(meter.costPerBodyMs).toBe(0.002)
    expect(meter.wakeCostPerBodyMs).toBeCloseTo(0.02 + 0.1 * (0.01 - 0.02), 6)
    for (let i = 0; i < 300; i++) meter.observe(2, 200)
    expect(meter.costPerBodyMs).toBeCloseTo(0.01, 3)
  })
})
