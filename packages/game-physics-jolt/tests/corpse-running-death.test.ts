import { describe, expect, it } from 'vitest'

import type { SettledCorpse } from '@adatechnology/game-physics'

import { kit, sceneOf, seconds } from './lod-scenes'

const RUNNING = 5
const SPRINTING = 7

describe('a zombie that dies running is not a corpse that was pushed (review of PR 521, item 7)', () => {
  it.each([[0, RUNNING], [1, RUNNING], [0, SPRINTING], [1, SPRINTING]])('ragdollsMax %i, %f m/s, no push: it slides to rest and `onSettled` is not told', { timeout: 60000 }, async (ragdollsMax, speed) => {
    const told: SettledCorpse[] = []
    const scene = await sceneOf({ lod: { ragdollsMax }, onSettled: (corpse) => told.push(corpse) })
    for (const [id, yaw] of [[1, 0], [2, 1.3], [3, 2.9]] as const) {
      scene.corpses.add({ id, kit, position: [id * 20, 0.02, 0], yaw, velocity: [speed * Math.cos(yaw + 0.4), 0, speed * Math.sin(yaw + 0.4)] })
    }
    seconds(scene.loop, 10)
    expect(told).toEqual([])
    scene.world.dispose()
  })

  it('a corpse pushed after it landed is still told, from where its own slide took it', { timeout: 60000 }, async () => {
    const told: SettledCorpse[] = []
    const scene = await sceneOf({ lod: { ragdollsMax: 0 }, onSettled: (corpse) => told.push(corpse) })
    scene.corpses.add({ id: 1, kit, position: [0, 0.02, 0], yaw: 0, velocity: [RUNNING, 0, 0] })
    seconds(scene.loop, 8)
    expect(told).toEqual([])
    for (const body of scene.corpses.partsOf(1)) scene.world.setVelocity(body, [8, 0, 0], [0, 0, 0])
    seconds(scene.loop, 8)
    expect(told).toHaveLength(1)
    expect(told[0]?.id).toBe(1)
    scene.world.dispose()
  })
})
