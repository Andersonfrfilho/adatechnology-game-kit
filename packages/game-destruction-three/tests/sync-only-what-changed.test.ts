import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'
import type { Vec3 } from '@adatechnology/game-destruction'

import { createDestructionRenderer } from '../src/renderer'
import { physicsOption } from './setup-physics'

const setup = (at: Vec3, asPiece: boolean) => {
  const world = createDestruction()
  const scene = new THREE.Scene()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, eventBudgetMs: Infinity })
  const id = world.add({ parts: [{ id: 'crate', material: 'wood_hard', shape: { kind: 'box', size: [0.2, 0.2, 0.2] }, position: [0, 0, 0] }], joints: [] }, { position: at })
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2))
  root.add(mesh)
  root.position.set(...at)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root, { parts: { crate: mesh } })
  if (asPiece) renderer.makePiece(id)
  const step = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      world.update(1 / 60)
      renderer.update(1 / 60)
    }
  }
  return { world, renderer, root, id, step }
}

const worldPosition = (r: ReturnType<typeof setup>): Vec3 => r.world.state(r.id)?.position ?? [NaN, NaN, NaN]

describe('the transforms of the bound objects follow only what changed', () => {
  it('an object moved by the host reaches the world in the same update, and one that did not move is left alone', () => {
    const r = setup([2, 5, 0], false)
    r.step(0.2)
    r.root.position.set(7, 3, -1)
    r.step(1 / 60)
    expect(worldPosition(r)).toEqual([7, 3, -1])
    const before = worldPosition(r)
    r.step(0.5)
    expect(worldPosition(r)).toEqual(before)
  })

  it('a piece that came to rest stops recomputing its matrix, and every moved root still matches the world', () => {
    const r = setup([0, 1, 0], true)
    r.step(4)
    expect(r.renderer.piece(r.id)?.sleeping).toBe(true)
    expect(r.root.matrixAutoUpdate).toBe(false)
    const p = worldPosition(r)
    expect(p[1]).toBeCloseTo(r.root.position.y, 5)
    expect(p[0]).toBeCloseTo(r.root.matrixWorld.elements[12] as number, 5)
  })

  it('a piece asleep teleported by the host is read the same update and gets its matrix back', () => {
    const r = setup([0, 1, 0], true)
    r.step(4)
    expect(r.root.matrixAutoUpdate).toBe(false)
    r.root.position.set(5, 0.1, 0)
    r.renderer.markMoved(r.id)
    expect(r.root.matrixAutoUpdate).toBe(true)
    r.step(1 / 60)
    expect(worldPosition(r)[0]).toBeCloseTo(5, 3)
  })

  it('a piece woken by a blow has its matrix recomputed again and unbinding leaves the root as an ordinary one', () => {
    const r = setup([0, 1, 0], true)
    r.step(4)
    expect(r.root.matrixAutoUpdate).toBe(false)
    const piece = r.renderer.piece(r.id)
    if (piece) {
      piece.sleeping = false
      piece.velocity[1] = 2
    }
    r.step(1 / 60)
    expect(r.root.matrixAutoUpdate).toBe(true)
    r.step(4)
    r.renderer.unbind(r.id)
    expect(r.root.matrixAutoUpdate).toBe(true)
  })
})
