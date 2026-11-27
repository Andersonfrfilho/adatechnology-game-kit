import { describe, expect, it } from 'vitest'

import { KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyDesc } from '@adatechnology/game-physics'

import { createJoltEngine } from '../src/index'

/** A shovel lying on its handle: a thin plate (the blade) 11.5 mm above the handle's underside, its centre of mass in the handle (as the kit measures it). */
const shovel = (keepPartContacts: boolean): BodyDesc => ({
  shape: {
    kind: 'compound',
    children: [
      { shape: { kind: 'box', half: [0.45, 0.0175, 0.0175] }, position: [-0.1, 0, 0], tag: 0 },
      { shape: { kind: 'box', half: [0.15, 0.006, 0.11] }, position: [0.4, 0, 0], tag: 1 },
    ],
  },
  motion: 'dynamic',
  position: [0, 0.0175, 0],
  mass: 7,
  centreAtOrigin: true,
  keepPartContacts,
  user: 1,
})

/** How far (m) the middle of the handle's underside ended under the floor after two seconds at rest. */
const sunkBy = async (keepPartContacts: boolean): Promise<number> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld({ ...KIT_WORLD })
  world.createBody({ shape: { kind: 'box', half: [5, 0.5, 5], convexRadius: 0 }, motion: 'static', position: [0, -0.5, 0], user: 0 })
  const id = world.createBody(shovel(keepPartContacts))
  for (let i = 0; i < 240; i++) world.step(1 / 120)
  const pose = new Float64Array(7)
  world.readPose(id, pose, 0)
  world.dispose()
  return 0.0175 - (pose[1] as number)
}

describe('a body of several parts keeps the contact points of each part (spec 008, T8.1)', () => {
  it('a plate hung 11.5 mm above the handle does not make the handle sink: it rests flat on the floor, under 0.5 mm', async () => {
    expect(Math.abs(await sunkBy(true))).toBeLessThan(0.0005)
  })

  it('the engine default (merged patches) is what sank it: the same shovel rests more than 4 mm into the floor', async () => {
    expect(await sunkBy(false)).toBeGreaterThan(0.004)
  })
})
