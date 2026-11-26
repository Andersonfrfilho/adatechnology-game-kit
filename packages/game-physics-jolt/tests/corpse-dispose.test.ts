import { describe, expect, it } from 'vitest'

import { createCorpseBodies } from '@adatechnology/game-physics'
import type { Quat } from '@adatechnology/game-physics'

import { kit, sceneOf, seconds } from './lod-scenes'

const FLAT: Quat = [Math.SQRT1_2, 0, 0, Math.SQRT1_2]

describe('createCorpseBodies().dispose (review of PR 521, item 5)', () => {
  it('takes every corpse body and every pile compound out: the body count is zero and the heap is what it was after the first cycle', { timeout: 60000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 1 } })
    const bodiesBefore = scene.world.readActiveBodies([])
    const cycle = (): void => {
      const corpses = createCorpseBodies(scene.loop, { lod: { ragdollsMax: 1 } })
      corpses.add({ id: 1, kit, position: [-12, 0.05, 0], yaw: 0 })
      corpses.add({ id: 2, kit, position: [-6, 0.05, 0], yaw: 0 })
      corpses.addLying({ id: 3, kit, torso: { position: [0, 0.17, 0], rotation: FLAT }, rung: 'r2' })
      corpses.addLying({ id: 4, kit, torso: { position: [6, 0.17, 0], rotation: FLAT }, rung: 'r2' })
      corpses.changeRung(4, 'r2f')
      seconds(scene.loop, 3)
      expect(corpses.counts()).toMatchObject({ r0: 1, r1: 1, r2: 1, r2f: 1, piles: 1 })
      corpses.dispose()
      expect(corpses.counts().rigidBodies).toBe(0)
    }
    cycle()
    const heapAfterFirst = scene.world.memoryInUse()
    for (let round = 0; round < 3; round++) cycle()
    expect(scene.world.readActiveBodies([])).toBe(bodiesBefore)
    expect(scene.world.memoryInUse()).toBe(heapAfterFirst)
    scene.world.dispose()
  })
})
