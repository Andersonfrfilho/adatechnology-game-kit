import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

const drop = (count: number): THREE.Box3[] => {
  const scene = new THREE.Scene()
  const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0 } as unknown as FragmentSystemOptions)
  const look = system.materialFor('concrete', 0x9a9a96, false)
  for (let i = 0; i < count; i++) {
    const fragment = { id: `f${i}`, shape: 'slab', center: [0.01 * i, 0.2 + i * 0.05, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.3, 0.03, 0.2], material: 'concrete', mass: 2 }
    system.spawn(fragment as never, look, 'home', 30)
  }
  for (let frame = 0; frame < 240; frame++) system.update(1 / 60)
  const boxes: THREE.Box3[] = []
  scene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) boxes.push(new THREE.Box3().setFromObject(node))
  })
  return boxes
}

describe('debris piles up', () => {
  it('a slab dropped on another lies on it, not inside it', () => {
    const boxes = drop(4).sort((a, b) => a.min.y - b.min.y)
    expect(boxes).toHaveLength(4)
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.min.y).toBeGreaterThanOrEqual(boxes[i - 1]!.max.y - 0.002)
    expect(boxes[3]!.max.y).toBeGreaterThan(0.11)
  })
})
