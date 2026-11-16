import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

const WALL_MIN_Z = -0.1
const WALL_MAX_Z = 0.1
const BRICK = [0.2, 0.1, 0.1]
const SETTLE_FRAMES = 240

/** A wall slab of the world 0.2 m thick along z: a point inside it is pushed out the nearest face. */
const pushOut = (x: number, y: number, z: number, _reachX: number, reachZ: number): readonly [number, number, number] | null => {
  if (z <= WALL_MIN_Z || z >= WALL_MAX_Z) return null
  const toFront = z - WALL_MIN_Z
  const toBack = WALL_MAX_Z - z
  return toFront < toBack ? [0, 0, -(toFront + reachZ + 0.01)] : [0, 0, toBack + reachZ + 0.01]
}

const settle = (withPushOut: boolean) => {
  const scene = new THREE.Scene()
  const options = { scene, gravity: 9.8, groundAt: () => 0, life: 0, ...(withPushOut ? { pushOut } : {}) } as unknown as FragmentSystemOptions
  const system = new FragmentSystem(THREE, options)
  const look = system.materialFor('brick', 0xb04a30, false)
  // a brick born in the low course of the wall, in its thickness, that the wall part still covers
  const fragment = { id: 'brick', shape: 'slab', center: [0, 0.05, 0.03], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: BRICK, material: 'brick', mass: 2 }
  const mesh = system.spawn(fragment as never, look, 'home', 30) as THREE.Object3D
  for (let frame = 0; frame < SETTLE_FRAMES; frame++) system.update(1 / 60)
  return new THREE.Box3().setFromObject(mesh)
}

describe('rubble that settles inside a standing part', () => {
  it('stays where it lies when the host gives no way out', () => {
    const box = settle(false)
    expect(box.min.z).toBeLessThan(WALL_MAX_Z)
    expect(box.max.z).toBeGreaterThan(WALL_MIN_Z)
  })

  it('is moved out by the nearest face and lies on the floor beside the wall', () => {
    const box = settle(true)
    const outsideFront = box.max.z <= WALL_MIN_Z + 1e-6
    const outsideBack = box.min.z >= WALL_MAX_Z - 1e-6
    expect(outsideFront || outsideBack).toBe(true)
    expect(box.min.y).toBeLessThan(0.01)
  })
})
