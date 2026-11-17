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
    // its centre over the strip (0.07 m off the long one's axis, inside its 0.1 m half width)
    const smallMesh = system.spawn(chunk('small', [0.05, 0.5, 0.05], [0, 0, 0, 1], SMALL_CHUNK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    const small = new THREE.Box3().setFromObject(smallMesh as THREE.Object3D)
    expect(small.min.y).toBeGreaterThan(0.15)
  })
})

describe('a piece lies on another only with its centre over it (the corner of a pier of loose bricks does not stand)', () => {
  const BRICK = [0.23, 0.075, 0.11]
  it('a brick whose centre is past the edge of the one under it goes over to the floor', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0 } as unknown as FragmentSystemOptions)
    const look = system.materialFor('brick', 0xb04a30, false)
    system.spawn(chunk('under', [0, 0.0375, 0], [0, 0, 0, 1], BRICK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    // 0.16 m along: it still overlaps the lower brick by 0.07 m, but its centre is 0.045 m past that brick's end
    const overMesh = system.spawn(chunk('over', [0.16, 0.12, 0], [0, 0, 0, 1], BRICK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    const over = new THREE.Box3().setFromObject(overMesh as THREE.Object3D)
    expect(over.min.y).toBeLessThan(0.03)
  })

  it('a brick laid in bond over the one under it (its centre over it) stays on it', () => {
    const scene = new THREE.Scene()
    const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0 } as unknown as FragmentSystemOptions)
    const look = system.materialFor('brick', 0xb04a30, false)
    system.spawn(chunk('under', [0, 0.0375, 0], [0, 0, 0, 1], BRICK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    const overMesh = system.spawn(chunk('over', [0.08, 0.12, 0], [0, 0, 0, 1], BRICK) as never, look, 'home', 30)
    for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
    const over = new THREE.Box3().setFromObject(overMesh as THREE.Object3D)
    expect(over.min.y).toBeGreaterThan(0.06)
  })
})
