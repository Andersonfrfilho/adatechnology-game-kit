import { describe, expect, it } from 'vitest'

import type { Vec3 } from '@adatechnology/game-physics'

import { allAsleep, kit, sceneOf, seconds } from './lod-scenes'
import type { Scene } from './lod-scenes'

const CORPSES = 300

/** `count` corpses on a 3 m grid, run until every one lies asleep and has had its last change of rung. */
const sleepingScene = async (count: number, interest: { at: Vec3 }): Promise<Scene> => {
  const scene = await sceneOf({ lod: { ragdollsMax: 0 }, interest: () => [interest.at] })
  for (let id = 1; id <= count; id++) scene.corpses.add({ id, kit, position: [((id - 1) % 20) * 3 - 30, 0.05, Math.floor((id - 1) / 20) * 3 - 22], yaw: id })
  seconds(scene.loop, 14)
  return scene
}

const looksIn = (scene: Scene, steps: number): number => {
  const before = scene.corpses.looks()
  for (let step = 0; step < steps; step++) scene.loop.step(1 / 60)
  return scene.corpses.looks() - before
}

describe('sleepers cost the policy nothing (§15 of CLAUDE.md, review of PR 521, item 3)', () => {
  it('with 300 corpses asleep a step visits none, and the visits do not grow with how many sleep', { timeout: 120000 }, async () => {
    const still = { at: [0, 0, 0] as Vec3 }
    const small = await sleepingScene(100, still)
    const large = await sleepingScene(CORPSES, still)
    expect(allAsleep(large, Array.from({ length: CORPSES }, (_, i) => i + 1))).toBe(true)
    expect(looksIn(large, 1)).toBe(0)
    expect(looksIn(small, 180)).toBe(0)
    expect(looksIn(large, 180)).toBe(0)
    small.world.dispose()
    large.world.dispose()
  })

  it('the interest walking past visits only the corpses it comes near, not the sleepers', { timeout: 120000 }, async () => {
    const walker = { at: [-60, 0, 0] as Vec3 }
    const scene = await sleepingScene(CORPSES, walker)
    expect(looksIn(scene, 60)).toBe(0)
    let visits = 0
    for (let step = 0; step < 60; step++) {
      walker.at = [walker.at[0] + 0.1, 0, 0]
      visits += looksIn(scene, 1)
    }
    // 6 m of walking: a thin slice of the 300, never all of them in one step
    expect(visits).toBeLessThan(CORPSES)
    scene.world.dispose()
  })
})
