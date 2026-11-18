import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '../src/renderer'
import { physicsOption } from './setup-physics'

const BOOKS = 8
const SHELF_Y = 0.9

/** A shelf between two sides, screwed to both, carrying a row of books standing upright on it (4 cm thick, 24 cm tall). */
const shelfSpec = (): DestructibleSpec => {
  const parts: DestructibleSpec['parts'] = [
    { id: 'side_a', material: 'mdf', shape: { kind: 'box', size: [0.04, 1.6, 0.3] }, position: [-0.62, 0.8, 0], anchored: true, structure: { role: 'column' } },
    { id: 'side_b', material: 'mdf', shape: { kind: 'box', size: [0.04, 1.6, 0.3] }, position: [0.62, 0.8, 0], anchored: true, structure: { role: 'column' } },
    { id: 'board', material: 'mdf', shape: { kind: 'box', size: [1.2, 0.03, 0.3] }, position: [0, SHELF_Y, 0], structure: { role: 'beam', maxSpan: 1.8 } },
  ]
  const joints: DestructibleSpec['joints'] = [
    { a: 'board', b: 'side_a', kind: 'screw', bears: 'a_on_b' },
    { a: 'board', b: 'side_b', kind: 'screw', bears: 'a_on_b' },
  ]
  for (let i = 0; i < BOOKS; i++) {
    const id = `book_${i}`
    parts.push({ id, material: 'paper', shape: { kind: 'box', size: [0.04, 0.24, 0.22] }, position: [-0.45 + i * 0.12, SHELF_Y + 0.015 + 0.12, 0] })
    joints.push({ a: id, b: 'board', kind: 'resting' })
  }
  return { name: 'shelf', parts, joints, tags: ['furniture'] }
}

const build = () => {
  const spec = shelfSpec()
  const world = createDestruction()
  world.add(spec, { id: 'shelf' })
  const scene = new THREE.Scene()
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  for (const p of spec.parts) {
    const s = p.shape.kind === 'box' ? p.shape.size : [0.1, 0.1, 0.1]
    const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]))
    m.position.set(...p.position)
    root.add(m)
    meshes[p.id] = m
  }
  scene.add(root)
  root.updateMatrixWorld(true)
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, eventBudgetMs: Infinity })
  renderer.bind('shelf', root, { parts: meshes })
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 60) {
      world.update(1 / 60)
      renderer.update(1 / 60)
    }
  }
  return { world, renderer, meshes, run }
}

/** The book meshes standing upright at the end (their tall axis within 30° of the vertical). */
const upright = (meshes: Record<string, THREE.Mesh>): number =>
  Object.entries(meshes).filter(([id, m]) => {
    if (!id.startsWith('book_')) return false
    m.updateMatrixWorld(true)
    return Math.abs(new THREE.Vector3(0, 1, 0).transformDirection(m.matrixWorld).y) > Math.cos(Math.PI / 6)
  }).length

describe('a shelf that loses the side at one end', () => {
  it('swings down on the screw at the other and pours its books off; they do not land standing', () => {
    const { world, meshes, run } = build()
    run(0.5)
    expect(upright(meshes)).toBe(BOOKS)
    world.hitPart('shelf', 'side_b', { type: 'blunt', point: [0.62, 1.2, 0.15], direction: [0, 0, -1], energy: 1e8, radius: 0.05 })
    // the board's free end goes down first: its end at the side still standing stays near the screw while the free end falls
    run(0.25)
    const board = meshes.board
    board.updateMatrixWorld(true)
    const held = new THREE.Vector3(-0.6, 0, 0).applyMatrix4(board.matrixWorld)
    const free = new THREE.Vector3(0.6, 0, 0).applyMatrix4(board.matrixWorld)
    expect(free.y).toBeLessThan(held.y - 0.15)
    expect(held.y).toBeGreaterThan(SHELF_Y - 0.1)
    run(5)
    expect(upright(meshes)).toBeLessThanOrEqual(2)
  })
})
