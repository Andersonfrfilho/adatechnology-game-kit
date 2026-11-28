import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec, DestructionEvent } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '../src/renderer'
import { physicsOption } from './setup-physics'

/** A concrete pole drawn whole by the renderer (no house to cut its gaps): one caged column set in the ground. */
const poleSpec = (): DestructibleSpec => ({
  name: 'pole',
  fixed: true,
  parts: [{
    id: 'shaft', material: 'concrete', shape: { kind: 'box', size: [0.26, 3.4, 0.26] }, position: [0, 1.7, 0], mass: 180, anchored: true,
    reinforcement: { material: 'steel', spacing: 0.1, diameter: 0.01 }, units: { size: [0.1, 0.1, 0.26], bond: 'stack', mortar: 'concrete' }, structure: { role: 'column' },
  }],
})

const build = (drawnByHost = false) => {
  const world = createDestruction({ seed: 3 })
  world.add(poleSpec(), { id: 'pole' })
  const scene = new THREE.Scene()
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 3.4, 0.26), new THREE.MeshStandardMaterial({ color: 0xa9a9a1 }))
  mesh.position.y = 1.7
  if (drawnByHost) mesh.userData.drawnSpalls = ['shaft']
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, eventBudgetMs: Infinity })
  renderer.bind('pole', root, { parts: { shaft: mesh } })
  const chips: Array<Extract<DestructionEvent, { type: 'chip' }>> = []
  world.on('chip', (e) => chips.push(e as Extract<DestructionEvent, { type: 'chip' }>))
  // rifle rounds (7.62, 2 kJ) on one spot of the front face
  const rifle = (rounds: number) => {
    for (let i = 0; i < rounds; i++) {
      world.shoot([0.02, 1.2, 6], [0, 0, -1], 2000, 7.62, 'test')
      for (let k = 0; k < 4; k++) {
        world.update(1 / 60)
        renderer.update(1 / 60)
      }
    }
  }
  /** The marks drawn on the front face (+z) inside the box of the chips, by their world position. */
  const gapMarks = () => {
    const p = new THREE.Vector3()
    return mesh.children.filter((decal) => {
      decal.getWorldPosition(p)
      return chips.some((c) => !c.torn && Math.abs(p.x - c.center[0]) <= c.size[0] / 2 + 0.01 && Math.abs(p.y - c.center[1]) <= c.size[1] / 2 + 0.01) && p.z > 0.12
    })
  }
  return { rifle, chips, gapMarks }
}

describe('a block of concrete knocked out of an object the renderer draws whole', () => {
  it('leaves its gap on the face it came out of, where the craters it took away were', () => {
    const { rifle, chips, gapMarks } = build()
    rifle(6)
    expect(chips.filter((c) => !c.torn).length).toBeGreaterThan(0)
    expect(gapMarks().length).toBeGreaterThan(0)
  })

  it('a drawing that cuts its own gaps (the house) takes no patch from the renderer', () => {
    const { rifle, chips, gapMarks } = build(true)
    rifle(6)
    expect(chips.filter((c) => !c.torn).length).toBeGreaterThan(0)
    expect(gapMarks()).toEqual([])
  })
})
