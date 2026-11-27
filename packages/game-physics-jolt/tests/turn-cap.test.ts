import { describe, expect, it } from 'vitest'

import { createJoltEngine } from '../src/index'
import { DEFAULT_MAX_TURN_RATE, MAX_EDGE_SPEED, MAX_TURN_PER_STEP } from '../src/constants'

const FIXED_STEP = 1 / 120

/** The turn rate (rad/s) a body of `half` extents has after one step started at `spin`. */
const spinAfterStep = async (half: number, spin: number): Promise<number> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: FIXED_STEP, gravity: [0, 0, 0] } as never)
  const id = world.createBody({ shape: { kind: 'box', half: [half, half, half] }, motion: 'dynamic', mass: 1, position: [0, 5, 0], angularVelocity: [0, 0, spin], user: 1, allowSleep: false })
  world.step(FIXED_STEP)
  const velocity = new Float64Array(6)
  world.readVelocity(id, velocity, 0)
  return Math.abs(velocity[5] as number)
}

describe('turn cap by size', () => {
  it('a small body turns faster than Jolt\'s own cap, up to its edge speed over its radius', async () => {
    const half = 0.03
    const radius = Math.sqrt(3) * half
    const cap = Math.min(MAX_TURN_PER_STEP / FIXED_STEP, MAX_EDGE_SPEED / radius)
    expect(cap).toBeGreaterThan(DEFAULT_MAX_TURN_RATE)
    expect(await spinAfterStep(half, 1000)).toBeCloseTo(cap, 1)
    expect(await spinAfterStep(half, 80)).toBeCloseTo(80, 1)
  })

  it('a large body keeps Jolt\'s own cap', async () => {
    expect(await spinAfterStep(1, 1000)).toBeCloseTo(DEFAULT_MAX_TURN_RATE, 1)
  })
})
