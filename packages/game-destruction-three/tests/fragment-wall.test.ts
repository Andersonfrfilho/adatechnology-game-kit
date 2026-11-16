import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

/** A wall 15 cm thick across x at x = 1 (its near face at 0.925), 2.8 m tall, and the head of a door inside it at 2.3 m: what the sweep meets and what lies under a fragment. */
const WALL_FACE = 0.925
const sweep: FragmentSystemOptions['sweep'] = (from, direction, distance) => {
  if (direction[0] <= 0 || from[0] >= WALL_FACE || from[1] > 2.8) return null
  const t = (WALL_FACE - from[0]) / direction[0]
  if (t > distance) return null
  return { point: [WALL_FACE, from[1] + direction[1] * t, from[2] + direction[2] * t], normal: [-1, 0, 0] }
}
// inside the wall a fragment would find the head of the door to lie on
const surfaceAt = (x: number, y: number): number => (x > WALL_FACE && x < 1.075 && y > 2.3 ? 2.3 : 0)

const throwAtWall = (withSweep: boolean): THREE.Vector3 => {
  const scene = new THREE.Scene()
  const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, surfaceAt, life: 0, ...(withSweep ? { sweep } : {}) } as unknown as FragmentSystemOptions)
  const look = system.materialFor('brick', 0xa8553a, false)
  // a chip of brick thrown up and at the wall by a blast in the room
  const fragment = { id: 'chip', shape: 'chunk', center: [0, 1.6, 0], rotation: [0, 0, 0, 1], velocity: [8, 3, 0], angularVelocity: [0, 0, 0], size: [0.03, 0.025, 0.026], material: 'brick', mass: 0.05 }
  system.spawn(fragment as never, look, 'home', 30)
  for (let frame = 0; frame < 300; frame++) system.update(1 / 30)
  const out = new THREE.Vector3()
  scene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) out.copy(node.position)
  })
  return out
}

describe('fragments meet the walls', () => {
  it('a chip thrown at a wall bounces off its face and falls at its foot, never into it', () => {
    const at = throwAtWall(true)
    expect(at.x).toBeLessThan(WALL_FACE)
    expect(at.y).toBeLessThan(0.1)
  })

  it('without the sweep the chip flies into the wall and lies on the head of the door inside it (the shard seen stuck on the plaster)', () => {
    const at = throwAtWall(false)
    expect(at.x).toBeGreaterThan(WALL_FACE)
  })
})
