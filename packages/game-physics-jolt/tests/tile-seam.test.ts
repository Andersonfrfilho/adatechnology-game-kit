import { describe, expect, it } from 'vitest'

import type { Material } from '@adatechnology/game-physics'

import { createJoltEngine } from '../src/index'

const STEEL: Material = { id: 'steel', density: 7850, frictionStatic: 0.5, frictionDynamic: 0.4, restitution: 0.1, rolling: 0.002 } as Material
const CAN_RADIUS = 0.033
const FLOOR_TILES: readonly (readonly [number, number])[] = [[-1, 1], [1, 1]]
const ONE_SLAB: readonly (readonly [number, number])[] = [[0, 2]]

/** The speed (m/s) a can launched at 2 m/s has left after rolling from x = -1.4 to past x = 0, over slabs given as [centre x, half x]. */
const speedAfterRolling = async (slabs: readonly (readonly [number, number])[], body: 'can' | 'box'): Promise<{ speed: number; peakLift: number }> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 32, positionIterations: 2, penetrationSlop: 0.002, maxPushOut: 0.002, sleepSpeed: 0.08 })
  for (const [centre, half] of slabs) world.createBody({ shape: { kind: 'box', half: [half, 0.5, 1], convexRadius: 0 }, motion: 'static', position: [centre, -0.5, 0], material: STEEL, user: 0 })
  const shape = body === 'can'
    ? { kind: 'compound' as const, children: [{ shape: { kind: 'cylinder' as const, halfHeight: 0.06, radius: CAN_RADIUS }, position: [0, 0, 0] as const, rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] as const }] }
    : { kind: 'box' as const, half: [0.1, 0.05, 0.1] as const }
  const rest = body === 'can' ? CAN_RADIUS : 0.05
  const id = world.createBody({
    shape, motion: 'dynamic', mass: 0.41, position: [-1.4, rest + 0.001, 0], linearVelocity: [2, 0, 0], angularVelocity: body === 'can' ? [0, 0, -2 / CAN_RADIUS] : [0, 0, 0],
    material: STEEL, user: 1, allowSleep: false,
  } as never)
  const pose = new Float64Array(7)
  const velocity = new Float64Array(6)
  let peakLift = 0
  for (let i = 0; i < 300; i++) {
    world.step(1 / 120)
    world.readPose(id, pose, 0)
    peakLift = Math.max(peakLift, (pose[1] as number) - rest)
    if ((pose[0] as number) > 0.6) break
  }
  world.readVelocity(id, velocity, 0)
  return { speed: velocity[0] as number, peakLift }
}

describe('seam between two static ground slabs', () => {
  it('a can rolling at 2 m/s over the seam keeps 90% of the speed it keeps on one slab', async () => {
    const seam = await speedAfterRolling(FLOOR_TILES, 'can')
    const single = await speedAfterRolling(ONE_SLAB, 'can')
    expect(seam.speed).toBeGreaterThanOrEqual(0.9 * single.speed)
  })

  it('a box sliding over the seam crosses it without jumping', async () => {
    const seam = await speedAfterRolling(FLOOR_TILES, 'box')
    const single = await speedAfterRolling(ONE_SLAB, 'box')
    expect(seam.peakLift).toBeLessThan(0.005)
    expect(seam.speed).toBeGreaterThanOrEqual(0.9 * single.speed)
  })
})
