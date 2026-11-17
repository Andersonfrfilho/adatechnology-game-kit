import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

const piece = (id: string, unit: boolean) => ({
  id, shape: 'chunk', center: [0, 0.5, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: [0.23, 0.075, 0.11], material: 'brick', mass: 2.5, ...(unit ? { unit: true } : {}),
})

describe('the shape a piece of masonry is drawn in', () => {
  it('a whole brick that came out at its joints is drawn as a brick (a box), a broken piece of brick as rubble', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0, crumbles: (id: string) => id === 'brick' } as unknown as FragmentSystemOptions)
    const look = system.materialFor('brick', 0xa8553a, false)
    const brick = system.spawn(piece('wall#u0', true) as never, look, 'home', 30)!
    const broken = system.spawn(piece('wall#c0', false) as never, look, 'home', 30)!
    expect(brick.geometry.attributes.position!.count).toBe(24)
    const box = new THREE.Box3().setFromBufferAttribute(brick.geometry.attributes.position as THREE.BufferAttribute)
    expect(box.min.toArray()).toEqual([-0.5, -0.5, -0.5])
    expect(box.max.toArray()).toEqual([0.5, 0.5, 0.5])
    expect(broken.geometry.attributes.position!.count).not.toBe(24)
  })
})
