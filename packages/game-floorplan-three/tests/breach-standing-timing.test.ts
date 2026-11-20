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

const bothScenes = (immediate: Scene, waiting: Scene, step: (scene: Scene) => void): void => {
  for (const scene of [immediate, waiting]) step(scene)
}

const tick = (immediate: Scene, waiting: Scene): void => bothScenes(immediate, waiting, (scene) => scene.world.update(0.05))

describe('what a body bumps into does not depend on when the wall is repainted (spec 017)', () => {
  it('hit, read, hit the same wall again, read: the same standing units, the repaint waiting or not', () => {
    const immediate = setup(false)
    const waiting = setup(true)
    bothScenes(immediate, waiting, (scene) => burst(scene, 'wall_0_0', 4))
    expect(waiting.paintQueue.pending()).toBeGreaterThan(0)
    const first = standingOf(immediate)
    expect(standingOf(waiting)).toBe(first)
    bothScenes(immediate, waiting, (scene) => burst(scene, 'wall_0_0', 8))
    for (let step = 0; step < 6; step++) {
      expect(standingOf(waiting)).toBe(standingOf(immediate))
      tick(immediate, waiting)
    }
    expect(waiting.paintQueue.pending()).toBeGreaterThan(0)
    expect(standingOf(immediate)).not.toBe(first)
  })

  it('the paint queue draining between two reads changes nothing', () => {
    const immediate = setup(false)
    const waiting = setup(true)
    bothScenes(immediate, waiting, (scene) => burst(scene, 'wall_0_0', 6))
    const before = standingOf(waiting)
    expect(before).toBe(standingOf(immediate))
    for (let guard = 0; guard < 100 && waiting.paintQueue.pending() > 0; guard++) {
      waiting.paintQueue.pending(1)
      waiting.paintQueue.run(1e9, () => 0)
    }
    expect(waiting.paintQueue.pending()).toBe(0)
    expect(standingOf(waiting)).toBe(before)
    bothScenes(immediate, waiting, (scene) => burst(scene, 'wall_0_0', 6))
    expect(standingOf(waiting)).toBe(standingOf(immediate))
  })
})
