import { describe, expect, it } from 'vitest'

import type { Quat, RayHit } from '@adatechnology/game-physics'

import { kit, sceneOf, seconds, torsoOf } from './lod-scenes'
import type { Scene } from './lod-scenes'

const FLAT: Quat = [Math.SQRT1_2, 0, 0, Math.SQRT1_2]

/** The hit of a ray from 5 m above the torso, straight down. */
const shotAt = (scene: Scene, id: number): RayHit => {
  const [x, , z] = torsoOf(scene, id)
  const hit = scene.world.rayFirst([x, 5, z], [0, -1, 0], 10)
  expect(hit).not.toBeNull()
  return hit as RayHit
}

describe('whose body a shot hit (review of PR 521, item 1)', () => {
  it('a ray on a body of R0, R1, R2 and R2f gives the same corpse id', { timeout: 60000 }, async () => {
    const scene = await sceneOf({ lod: { ragdollsMax: 1 } })
    scene.corpses.add({ id: 7, kit, position: [-12, 0.05, 0], yaw: 0 })
    expect(scene.corpses.rungOf(7)).toBe('r0')
    scene.corpses.add({ id: 8, kit, position: [-6, 0.05, 0], yaw: 0 })
    expect(scene.corpses.rungOf(8)).toBe('r1')
    scene.corpses.addLying({ id: 9, kit, torso: { position: [0, 0.17, 0], rotation: FLAT }, rung: 'r2' })
    scene.corpses.addLying({ id: 10, kit, torso: { position: [6, 0.17, 0], rotation: FLAT }, rung: 'r2' })
    scene.corpses.changeRung(10, 'r2f')
    seconds(scene.loop, 4)
    for (const [id, rung] of [[7, 'r0'], [8, 'r1'], [9, 'r2'], [10, 'r2f']] as const) {
      expect(scene.corpses.rungOf(id)).toBe(rung)
      const hit = shotAt(scene, id)
      expect(scene.corpses.corpseOfBody(hit.body, hit.tag), rung).toBe(id)
    }
    // R0 and R1 say it in `user` too, as R2 does
    expect(Math.floor(shotAt(scene, 7).user / 32)).toBe(7)
    expect(shotAt(scene, 8).user).toBe(8)
    expect(shotAt(scene, 9).user).toBe(9)
    expect(scene.corpses.corpseOfBody(scene.world.rayFirst([30, 5, 30], [0, -1, 0], 10)?.body ?? (-1 as never))).toBeUndefined()
    scene.world.dispose()
  })
})
