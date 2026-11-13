import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const DT = 0.05
const G = 9.81

/**
 * A panel stood exactly on its thin edge and let go, stepped at the room's 20 updates a second: the energy it gained over the fall (the sum of every rise of its centre's
 * energy height, y + |v|^2 / 2g, the room probes' C2 ruler), the barrier it had to pass (its centre's rise to stand over the edge), whether it ended flat, and when it slept.
 */
const standAndRelease = (size: [number, number, number], mass: number) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
  world.addObject('panel', [partState('body', 'wood', { mass })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(0, size[1] / 2 + 0.002, 0)
  root.rotation.z = (0.05 * Math.PI) / 180
  scene.add(root)
  renderer.bind('panel', root, { parts: { body: mesh } })
  const piece = renderer.makePiece('panel')
  const energy = (): number => root.position.y + (piece.velocity[0] ** 2 + piece.velocity[1] ** 2 + piece.velocity[2] ** 2) / (2 * G)
  let gained = 0
  let before = energy()
  let slept = -1
  for (let t = DT; t <= 6 && slept < 0; t += DT) {
    renderer.update(DT)
    const now = energy()
    gained += Math.max(0, now - before)
    before = now
    if (piece.sleeping) slept = t
  }
  root.updateMatrixWorld(true)
  const flat = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y < Math.min(...size) * 2
  const half = size[1] / 2
  const barrier = Math.hypot(half, Math.min(size[0], size[2]) / 2) - half
  return { gained, barrier, flat, slept }
}

describe('the balancing rule gives a piece on a narrow edge only what it takes to go over', () => {
  it('a 3 kg 1.2 x 2 m panel on its 4 cm edge goes over and sleeps, gaining no more than the barrier and a few millimetres', () => {
    const { gained, barrier, flat, slept } = standAndRelease([1.2, 2, 0.04], 3)
    expect(flat).toBe(true)
    expect(slept).toBeGreaterThan(0)
    expect(gained).toBeLessThan(barrier + 0.01)
  })

  it('an 8 kg door on its 5 cm edge, the same', () => {
    const { gained, barrier, flat, slept } = standAndRelease([0.6, 1.6, 0.05], 8)
    expect(flat).toBe(true)
    expect(slept).toBeGreaterThan(0)
    expect(gained).toBeLessThan(barrier + 0.01)
  })
})
