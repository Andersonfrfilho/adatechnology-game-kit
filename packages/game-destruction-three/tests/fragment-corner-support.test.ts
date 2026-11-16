import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

/** A chunk turned 45 degrees about the vertical: its wrapping box on the floor is much bigger than the strip it really covers. */
const TURNED_45 = [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]
const LONG_CHUNK = [0.7, 0.2, 0.2]
const SMALL_CHUNK = [0.1, 0.1, 0.1]
const SETTLE_FRAMES = 300
const OFF_STRIP = 0.3

const chunk = (id: string, center: number[], rotation: number[], size: number[]) => ({
  id, shape: 'slab', center, rotation, velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size, material: 'brick', mass: 5,
})

describe('what a resting fragment holds up is the rectangle it covers, not the box that wraps it', () => {
  it('a small chunk beside the long diagonal one, inside its wrapping box but off its strip, falls to the floor', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0 } as unknown as FragmentSystemOptions)
    const look = system.materialFor('brick', 0xb04a30, false)
    const longMesh = system.spawn(chunk('long', [0, 0.1, 0], TURNED_45, LONG_CHUNK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    // beside it, across the strip (the long one runs along x = -z): at (+0.3, +0.3) the wrapping box still reaches, the chunk does not
    const smallMesh = system.spawn(chunk('small', [OFF_STRIP, 0.5, OFF_STRIP], [0, 0, 0, 1], SMALL_CHUNK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    expect(longMesh).not.toBeNull()
    const small = new THREE.Box3().setFromObject(smallMesh as THREE.Object3D)
    expect(small.min.y).toBeLessThan(0.01)
  })

  it('a small chunk over the long one still lies on it', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0 } as unknown as FragmentSystemOptions)
    const look = system.materialFor('brick', 0xb04a30, false)
    system.spawn(chunk('long', [0, 0.1, 0], TURNED_45, LONG_CHUNK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    const smallMesh = system.spawn(chunk('small', [0.1, 0.5, 0.1], [0, 0, 0, 1], SMALL_CHUNK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    const small = new THREE.Box3().setFromObject(smallMesh as THREE.Object3D)
    expect(small.min.y).toBeGreaterThan(0.15)
  })
})
