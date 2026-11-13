import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createVfx } from '@adatechnology/game-vfx'
import { buildItem, makeupSpec } from '../../game-items-three/src'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const SHOVEL = { id: 'shovel', category: 'tools', size: [1.1, 0.07, 0.22] as [number, number, number], model: 'shovel', weight: 2 }
const ANGLE = 0.4
// the make-up's blade: 0.301 m long on x from 0.25 to 0.551; struck 0.42 m along the shovel, the hinge is there and the +x end folds down
const HINGE_X = 0.42
const TIP_X = 0.551

describe('a shovel blade bent in the real renderer', () => {
  it('moves the far edge of the blade meshes by about length * sin(angle) and leaves the near part and the handle, though the model is drawn in centimetres', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), onSound: () => {}, vfx: createVfx() })
    const { root } = buildItem(THREE, SHOVEL, { destructible: true })
    root.position.set(2, 1, -3)
    scene.add(root)
    root.updateMatrixWorld(true)
    const spec = makeupSpec('shovel')!
    world.addObject('shovel', spec.parts.map((part) => partState(part.id, part.material)))
    renderer.bind('shovel', root)
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh))
    const snapshot = () => meshes.map((m) => Float32Array.from((m.geometry.getAttribute('position') as THREE.BufferAttribute).array))
    // the vertices of every mesh in the metres of the item (its root is scaled by 0.01)
    const inMetres = (mesh: THREE.Mesh, array: Float32Array): THREE.Vector3[] => {
      const out: THREE.Vector3[] = []
      for (let i = 0; i < array.length; i += 3) out.push(new THREE.Vector3(array[i], array[i + 1], array[i + 2]).applyMatrix4(mesh.matrixWorld).sub(root.position))
      return out
    }
    const before = snapshot()
    world.emit({ type: 'bend', object: 'shovel', part: 'blade', hinge: { point: [HINGE_X, 0.006, 0], axis: [0, 0, -1], side: [1, 0, 0] }, angle: ANGLE, worldPoint: [2 + HINGE_X, 1.006, -3] })
    renderer.update(0.016)
    const after = snapshot()
    let lowestFar = 0
    meshes.forEach((mesh, index) => {
      const names = mesh.userData.destructionPart as string
      const was = inMetres(mesh, before[index]!)
      const now = inMetres(mesh, after[index]!)
      was.forEach((vertex, v) => {
        const moved = vertex.distanceTo(now[v]!)
        if (names === 'handle') expect(moved).toBe(0)
        else if (vertex.x < HINGE_X - 0.015) expect(moved).toBeLessThan(1e-6)
        else if (vertex.x > HINGE_X + 0.015) {
          expect(moved).toBeGreaterThan(0)
          lowestFar = Math.min(lowestFar, now[v]!.y - vertex.y)
        }
      })
    })
    // the tip edge goes down by the length from the hinge times sin(angle)
    expect(lowestFar).toBeLessThan(-(TIP_X - HINGE_X) * Math.sin(ANGLE) * 0.97)
    expect(lowestFar).toBeGreaterThan(-(TIP_X - HINGE_X) * Math.sin(ANGLE) * 1.03 - 0.004)
  })
})
