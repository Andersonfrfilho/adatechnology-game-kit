import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

function makeSystem(): { system: FragmentSystem; scene: THREE.Scene } {
  const scene = new THREE.Scene()
  const options = { scene, gravity: 9.8, groundAt: () => 0, life: 0 } as unknown as FragmentSystemOptions
  return { system: new FragmentSystem(THREE, options), scene }
}

const fragment = { id: 'f1', shape: 'chunk', center: [0, 0.05, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.1, 0.1, 0.1], material: 'wood', mass: 1 }

describe('a fragment at rest', () => {
  it('stops having its matrix rebuilt every frame, and has it again when something moves it', () => {
    const { system } = makeSystem()
    const material = system.materialFor('wood', 0x808080, false)
    const mesh = system.spawn(fragment as never, material, 'home', 10)!
    for (let frame = 0; frame < 120; frame++) system.update(1 / 60)
    expect(mesh.matrixAutoUpdate).toBe(false)
    system.blast([0.2, 0, 0], 2, 5)
    expect(mesh.matrixAutoUpdate).toBe(true)
  })
})
