import { describe, expect, it } from 'vitest'

import { createJoltEngine } from '../src/index'

/** A sphere of restitution `ball` dropped `drop` m onto a fixed slab of restitution `ground`: how high its centre gets back above where it rests, the first time it rises. */
const reboundHeight = async (ball: number, ground: number, drop: number): Promise<number> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20 })
  world.createBody({ shape: { kind: 'box', half: [5, 0.5, 5] }, motion: 'static', position: [0, -0.5, 0], material: { frictionStatic: 0.5, frictionDynamic: 0.4, restitution: ground }, user: 0 })
  const radius = 0.1
  const sphere = world.createBody({ shape: { kind: 'sphere', radius }, motion: 'dynamic', mass: 1, position: [0, radius + drop, 0], material: { frictionStatic: 0.5, frictionDynamic: 0.4, restitution: ball }, user: 1, allowSleep: false })
  const pose = new Float64Array(7)
  let lowest = Infinity
  let apex = 0
  for (let i = 0; i < 400; i++) {
    world.step(1 / 120)
    world.readPose(sphere, pose, 0)
    const y = pose[1] as number
    lowest = Math.min(lowest, y)
    if (lowest < radius + 0.02) apex = Math.max(apex, y - radius)
  }
  world.dispose()
  return apex
}

describe('restitution is mixed as the kit mixes it: by geometric mean, at every contact, not only the first (spec 008, T3.10)', () => {
  it('a ball of 0.6 dropped 0.5 m onto a surface of 0.4 rises to e^2 h, e = sqrt(0.24)', async () => {
    expect(await reboundHeight(0.6, 0.4, 0.5)).toBeCloseTo(0.12, 2)
  })

  it('a ball that reaches a surface of 0.4 at 1.4 m/s, in a contact Jolt saw before they touched, rises to the mean (about 0.03), not to the larger of the two (0.042)', async () => {
    expect(await reboundHeight(0.6, 0.4, 0.1)).toBeLessThan(0.036)
  })

  it('a ball of 0.6 on a surface of 0 does not bounce, however it arrives', async () => {
    expect(await reboundHeight(0.6, 0, 0.5)).toBeLessThan(0.01)
    // what is left at 1.4 m/s is the push out of the speculative margin, not a bounce: the larger of the two would give 0.042
    expect(await reboundHeight(0.6, 0, 0.1)).toBeLessThan(0.025)
  })

  it('equal restitutions mix to themselves: 0.5 on 0.5 rises to a quarter of the drop', async () => {
    expect(await reboundHeight(0.5, 0.5, 0.5)).toBeCloseTo(0.125, 2)
  })
})
