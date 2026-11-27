import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const BOOK: [number, number, number] = [0.05, 0.28, 0.26]

interface HitParams {
  readonly offsetX: number
  readonly dropHeight: number
  readonly settleSeconds: number
  readonly sidewaysSpeed: number
}

/** A book stands on the floor; another, lying almost flat, falls on its top edge. Returns how tall the standing book is at the end, and whether it slept before the hit. */
const hitStandingBook = ({ offsetX, dropHeight, settleSeconds, sidewaysSpeed }: HitParams): { height: number; sleptBefore: boolean } => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  const add = (id: string, position: [number, number, number], rotation: [number, number]): THREE.Group => {
    world.addObject(id, [partState('body', 'wood', { mass: 1.5 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...BOOK))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(...position)
    root.rotation.set(rotation[0], 0, rotation[1])
    scene.add(root)
    renderer.bind(id, root, { parts: { body: mesh } })
    return root
  }
  const standing = add('standing', [0, BOOK[1] / 2 + 0.001, 0], [0, 0])
  const piece = renderer.makePiece('standing')
  for (let t = 0; t < settleSeconds; t += 1 / 60) renderer.update(1 / 60)
  const sleptBefore = piece.sleeping
  add('falling', [offsetX, BOOK[1] + dropHeight, 0], [0.3, (Math.PI / 2) * 0.9])
  renderer.makePiece('falling', { velocity: [sidewaysSpeed, 0, 0] })
  for (let t = 0; t < 4; t += 1 / 60) renderer.update(1 / 60)
  standing.updateMatrixWorld(true)
  return { height: new THREE.Box3().setFromObject(standing).getSize(new THREE.Vector3()).y, sleptBefore }
}

// a book that lands flat on the 5 cm top edge presses straight down: it goes over only when its weight acts past the rim (x 0.15)
const LANDING_X = 0.15

describe('a standing book hit by a falling one', () => {
  for (const settleSeconds of [0.2, 2]) {
    const state = settleSeconds > 1 ? 'asleep' : 'awake'
    it(`falls over when a book dropped 0.6 m lands on its top edge (${state})`, () => {
      const { height, sleptBefore } = hitStandingBook({ offsetX: LANDING_X, dropHeight: 0.6, settleSeconds, sidewaysSpeed: 0 })
      expect(sleptBefore).toBe(settleSeconds > 1)
      expect(height).toBeLessThan(0.12)
    })

    it(`falls over when a book thrown sideways at 1 m/s hits its top edge (${state})`, () => {
      const { height } = hitStandingBook({ offsetX: 0.2, dropHeight: 0.2, settleSeconds, sidewaysSpeed: -1 })
      expect(height).toBeLessThan(0.12)
    })
  }
})
