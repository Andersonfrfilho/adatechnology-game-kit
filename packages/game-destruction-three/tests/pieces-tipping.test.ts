import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const drop = (id: string, size: [number, number, number], tilt: number, mass: number, meshOffset: [number, number, number] = [0, 0, 0]) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
  world.addObject(id, [partState('body', 'wood', { mass })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
  mesh.position.set(...meshOffset)
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(0, size[1] / 2 + 0.002, 0)
  root.rotation.z = (tilt * Math.PI) / 180
  scene.add(root)
  renderer.bind(id, root, { parts: { body: mesh } })
  const piece = renderer.makePiece(id)
  let t = 0
  let slept = -1
  while (t < 3) {
    renderer.update(1 / 60)
    t += 1 / 60
    if (piece.sleeping && slept < 0) slept = t
  }
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const ext = box.getSize(new THREE.Vector3())
  return { piece, ext, slept }
}

describe('piece tipping', () => {
  it('a tall thin door released upright with a 2 degree tilt falls flat and sleeps', () => {
    const { piece, ext } = drop('door', [0.6, 1.6, 0.05], 2, 8)
    expect(Math.min(ext.x, ext.y, ext.z)).toBe(ext.y)
    expect(ext.y).toBeLessThan(0.1)
    expect(piece.sleeping).toBe(true)
  })

  it('a door whose mesh is off the root origin also falls flat', () => {
    const { piece, ext } = drop('door2', [0.6, 1.6, 0.05], 2, 8, [0.3, 0.8, 0])
    expect(ext.y).toBeLessThan(0.1)
    expect(piece.sleeping).toBe(true)
  })

  it('a door released exactly upright with no tilt still does not stay standing on its edge', () => {
    const { piece, ext } = drop('door3', [0.6, 1.6, 0.05], 0.05, 8)
    expect(ext.y).toBeLessThan(0.1)
    expect(piece.sleeping).toBe(true)
  })

  it('a cube stays upright', () => {
    const { piece, ext } = drop('cube', [0.4, 0.4, 0.4], 2, 8)
    expect(ext.y).toBeLessThan(0.4 * 1.05)
    expect(ext.y).toBeGreaterThan(0.4 * 0.98)
    expect(piece.sleeping).toBe(true)
  })
})
