import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec, Quat } from '../src'

/** A shelf screwed to a side, with two books lying on it. */
const shelf = (): DestructibleSpec => ({
  parts: [
    { id: 'side', material: 'mdf', shape: { kind: 'box', size: [0.04, 1, 0.3] }, position: [-0.4, 0.5, 0], anchored: true },
    { id: 'board', material: 'mdf', shape: { kind: 'box', size: [0.8, 0.03, 0.3] }, position: [0, 0.5, 0] },
    { id: 'book_a', material: 'paper', shape: { kind: 'box', size: [0.04, 0.2, 0.2] }, position: [-0.1, 0.615, 0] },
    { id: 'book_b', material: 'paper', shape: { kind: 'box', size: [0.04, 0.2, 0.2] }, position: [0.1, 0.615, 0] },
  ],
  joints: [
    { a: 'side', b: 'board', kind: 'screw' },
    { a: 'board', b: 'book_a', kind: 'resting' },
    { a: 'board', b: 'book_b', kind: 'resting' },
  ],
})

/** Rotation of `degrees` about the z axis. */
const tiltZ = (degrees: number): Quat => {
  const half = (degrees * Math.PI) / 360
  return [0, 0, Math.sin(half), Math.cos(half)]
}

describe('resting joints and tilt', () => {
  it('a small lean keeps the books on the shelf', () => {
    const world = createDestruction()
    const id = world.add(shelf(), { id: 'case' })
    world.setTransform(id, [0, 0, 0], tiltZ(15))
    expect(world.state(id)!.joints.every((j) => !j.open)).toBe(true)
    expect(world.state(id)!.groups).toHaveLength(1)
  })

  it('a toppled case lets every book fall off on its own, while the screwed board stays', () => {
    const world = createDestruction()
    const id = world.add(shelf(), { id: 'case' })
    const detached: string[] = []
    world.on('detach', (event) => {
      if (event.type === 'detach') detached.push(event.joint)
    })
    world.setTransform(id, [0, 0, 0], tiltZ(80))
    const joints = world.state(id)!.joints
    expect(joints.filter((j) => j.open)).toHaveLength(2)
    expect(detached).toHaveLength(2)
    expect(world.state(id)!.groups).toHaveLength(3)
  })
})
