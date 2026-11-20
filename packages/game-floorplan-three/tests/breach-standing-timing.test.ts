import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'
import { physicsOption } from './setup-physics'

// What a body bumps into (`breach.standing`, read by `blocks`) is the world's damage, not the paint: a wall's repaint may wait in the deadline queue.

function setup(deferred: boolean) {
  const world = createDestruction({ seed: 5 })
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const houseRenderer = houseOf(planOf('sobrado', 3), { destruction: world, destructionRenderer: renderer })
  scene.add(houseRenderer.house.group)
  const d = houseRenderer.house.destruction
  d.activate()
  const cutQueue = houseRenderer.renderer.cutQueue!()
  const paintQueue = houseRenderer.renderer.deferredQueue!()
  if (deferred) {
    cutQueue.attach?.()
    paintQueue.attach?.()
  }
  return { world, d, house: houseRenderer.house, paintQueue }
}

type Scene = ReturnType<typeof setup>

const burst = (scene: Scene, id: string, rounds: number): void => {
  const part = scene.house.structure.byId.get(id)!
  const alongU = part.aabb[2] - part.aabb[0] > part.aabb[3] - part.aabb[1]
  for (let round = 0; round < rounds; round++) {
    const x = alongU ? part.aabb[0] + 0.6 + round * 0.25 : (part.aabb[0] + part.aabb[2]) / 2
    const z = alongU ? (part.aabb[1] + part.aabb[3]) / 2 : part.aabb[1] + 0.6 + round * 0.25
    scene.world.hitPart(scene.d.id!, id, { type: 'ballistic', point: [x, (part.y0 + part.y1) / 2, z], direction: alongU ? [0, 0, -1] : [-1, 0, 0], energy: 3500, caliber: 7.62 })
  }
}

const standingOf = (scene: Scene): string => JSON.stringify(scene.house.structure.parts.map((part) => scene.d.breach.standing(part.id)))

describe('what a body bumps into does not depend on when the wall is repainted (spec 017)', () => {
  it('the same rounds leave the same standing units at every tick, the repaint waiting or not', () => {
    const immediate = setup(false)
    const waiting = setup(true)
    const seen = new Set<string>()
    for (const scene of [immediate, waiting]) burst(scene, 'wall_0_0', 8)
    expect(waiting.paintQueue.pending()).toBeGreaterThan(0)
    for (let tick = 0; tick < 6; tick++) {
      expect(standingOf(waiting)).toBe(standingOf(immediate))
      seen.add(standingOf(immediate))
      for (const scene of [immediate, waiting]) scene.world.update(0.05)
    }
    expect(waiting.paintQueue.pending()).toBeGreaterThan(0)
    expect(seen.size).toBeGreaterThan(0)
    expect(standingOf(immediate)).toContain('"spans"')
  })
})
