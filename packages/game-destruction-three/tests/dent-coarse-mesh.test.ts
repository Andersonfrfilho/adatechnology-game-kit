import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createVfx } from '@adatechnology/game-vfx'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

describe('dent on a coarse mesh', () => {
  it('moves at least one vertex inward by more than a millimetre when the dent is smaller than the vertex spacing', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), onSound: () => {}, vfx: createVfx() })
    // a can: radius 33 mm, height 122 mm, 16 sides and one height segment, so the vertices are 61 mm apart
    const geometry = new THREE.CylinderGeometry(0.033, 0.033, 0.122, 16, 1)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    world.addObject('can', [partState('shell', 'steel')], [['shell']])
    renderer.bind('can', root, { parts: { shell: mesh } })
    const before = new Float32Array((geometry.getAttribute('position') as THREE.BufferAttribute).array as ArrayLike<number>)
    world.emit({ type: 'dent', object: 'can', part: 'shell', worldPoint: [0.033, 0, 0], dent: { point: [0.033, 0, 0], normal: [-1, 0, 0], radius: 0.012, depth: 0.01 } })
    renderer.update(0.016)
    const after = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array
    let deepest = 0
    for (let i = 0; i < before.length; i += 3) {
      const shift = Math.hypot(after[i]! - before[i]!, after[i + 1]! - before[i + 1]!, after[i + 2]! - before[i + 2]!)
      deepest = Math.max(deepest, shift)
    }
    expect(deepest).toBeGreaterThan(0.001)
  })
})
