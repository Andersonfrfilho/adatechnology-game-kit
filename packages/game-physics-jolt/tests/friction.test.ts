import { describe, expect, it } from 'vitest'

import type { Material, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'

const G = 9.81
const SLOPE = (25 * Math.PI) / 180
/** Down the slope (the ramp falls toward +x). */
const DOWN: Vec3 = [Math.cos(SLOPE), -Math.sin(SLOPE), 0]

/**
 * A 25 degree ramp and a 20 cm box resting on it, both of `material`; the box's offset along the slope each step for `seconds`. The box may not sleep: at the
 * room's sleep speed (0.08 m/s over 0.5 s) Jolt puts a slide that starts from rest to sleep before it averages 0.16 m/s, and the friction is what is measured.
 */
const onRamp = async (material: Material, seconds: number, upSlope = 0): Promise<{ along: number[]; world: PhysicsWorld }> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08 })
  const q: [number, number, number, number] = [0, 0, -Math.sin(SLOPE / 2), Math.cos(SLOPE / 2)]
  world.createBody({ shape: { kind: 'box', half: [3, 0.25, 1] }, motion: 'static', position: [0, 0, 0], rotation: q, material, user: 0 })
  // the box's centre 0.25 + 0.1 above the ramp's mid-plane, along the ramp's normal
  const normal: Vec3 = [Math.sin(SLOPE), Math.cos(SLOPE), 0]
  const at: Vec3 = [normal[0] * 0.351, normal[1] * 0.351, 0]
  const box = world.createBody({
    shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 2, position: at, rotation: q, material, user: 1, allowSleep: false,
    linearVelocity: [-DOWN[0] * upSlope, -DOWN[1] * upSlope, 0],
  })
  const pose = new Float64Array(7)
  const along: number[] = []
  for (let i = 0; i < seconds * 120; i++) {
    world.step(1 / 120)
    world.readPose(box, pose, 0)
    along.push((pose[0] - at[0]) * DOWN[0] + (pose[1] - at[1]) * DOWN[1])
  }
  return { along, world }
}

describe('Coulomb friction by body: static while it holds, dynamic while it slides (spec 008 D1.1)', () => {
  it('mu static 0.5 holds a box on 25 degrees (tan 25 = 0.47), though its dynamic 0.4 would not', async () => {
    const { along, world } = await onRamp({ frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0 }, 1)
    expect(Math.abs(along.at(-1)!)).toBeLessThan(0.005)
    world.dispose()
  })

  it('mu 0.4 lets it slide g (sin 25 - 0.4 cos 25) t^2 / 2 = 0.295 m in 1 s', async () => {
    const { along, world } = await onRamp({ frictionStatic: 0.4, frictionDynamic: 0.4, restitution: 0 }, 1)
    const expected = 0.5 * G * (Math.sin(SLOPE) - 0.4 * Math.cos(SLOPE))
    expect(along.at(-1)!).toBeGreaterThan(expected - 0.05)
    expect(along.at(-1)!).toBeLessThan(expected + 0.05)
    world.dispose()
  })

  it('a box sent up the slope slides by its dynamic 0.4, stops, and then holds by its static 0.5', async () => {
    const { along, world } = await onRamp({ frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0 }, 2, 1)
    // up the slope it slows by g (sin 25 + 0.4 cos 25): it stops 1 / (2 a) up
    const stop = -1 / (2 * G * (Math.sin(SLOPE) + 0.4 * Math.cos(SLOPE)))
    const highest = Math.min(...along)
    expect(highest).toBeGreaterThan(stop - 0.02)
    expect(highest).toBeLessThan(stop + 0.02)
    // back to sticking where it stopped: in the last second it does not come down (by its dynamic 0.4 it would, 0.3 m)
    expect(along.at(-1)! - along[120]!).toBeLessThan(0.01)
    world.dispose()
  })
})
