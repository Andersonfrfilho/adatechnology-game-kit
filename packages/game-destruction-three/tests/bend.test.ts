import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createVfx } from '@adatechnology/game-vfx'
import { BEND_SMOOTH_RADIUS, bendPositions } from '../src/bend'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const HINGE = { point: [0, 0, 0], axis: [0, 0, -1], side: [1, 0, 0] } as const

describe('bending the vertices of a plate', () => {
  it('leaves every vertex alone at a bend of 0', () => {
    const positions = new Float32Array([0.3, 0, 0.1, -0.3, 0.001, 0.1, 0, 0, -0.1])
    const before = new Float32Array(positions)
    bendPositions(positions, 0, positions.length, HINGE.point, HINGE.axis, HINGE.side, 0, BEND_SMOOTH_RADIUS)
    expect(Array.from(positions)).toEqual(Array.from(before))
  })

  it('turns the far edge by length * sin(angle) down and leaves the near side where it was', () => {
    const positions = new Float32Array([0.3, 0, 0, 0.3, 0, 0.2, -0.3, 0, 0, -0.3, 0, 0.2])
    bendPositions(positions, 0, positions.length, HINGE.point, HINGE.axis, HINGE.side, 0.4, BEND_SMOOTH_RADIUS)
    expect(positions[1]).toBeCloseTo(-0.3 * Math.sin(0.4), 6)
    expect(positions[0]).toBeCloseTo(0.3 * Math.cos(0.4), 6)
    expect(positions[4]).toBeCloseTo(-0.3 * Math.sin(0.4), 6)
    // along the hinge line nothing moves
    expect(positions[2]).toBeCloseTo(0, 6)
    expect(positions[5]).toBeCloseTo(0.2, 6)
    expect(positions[6]).toBeCloseTo(-0.3, 6)
    expect(positions[7]).toBe(0)
    expect(positions[9]).toBeCloseTo(-0.3, 6)
    expect(positions[10]).toBe(0)
  })

  it('rounds the fold: a vertex on the hinge turns by half the angle', () => {
    const positions = new Float32Array([0, 0, 0.1, 0.5 * BEND_SMOOTH_RADIUS, 0, 0])
    bendPositions(positions, 0, positions.length, HINGE.point, HINGE.axis, HINGE.side, 0.4, BEND_SMOOTH_RADIUS)
    expect(positions[3]).toBeLessThan(0.5 * BEND_SMOOTH_RADIUS + 1e-9)
    expect(positions[4]).toBeLessThan(0)
    expect(positions[4]).toBeGreaterThan(-0.5 * BEND_SMOOTH_RADIUS * Math.sin(0.4))
  })
})

describe('the renderer draws the bend of a part', () => {
  const setup = () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), onSound: () => {}, vfx: createVfx() })
    const geometry = new THREE.BoxGeometry(0.6, 0.002, 0.2, 12, 1, 1)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    root.updateMatrixWorld(true)
    world.addObject('blade', [partState('blade', 'steel')], [['blade']])
    renderer.bind('blade', root, { parts: { blade: mesh } })
    return { world, renderer, mesh }
  }
  const lowestY = (mesh: THREE.Mesh): number => {
    const array = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array
    let lowest = 0
    for (let i = 1; i < array.length; i += 3) lowest = Math.min(lowest, array[i]!)
    return lowest
  }

  it('moves the far edge by about length * sin(angle) and keeps the near side, and keeps it through later updates', () => {
    const { world, renderer, mesh } = setup()
    const before = new Float32Array((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as ArrayLike<number>)
    world.emit({ type: 'bend', object: 'blade', part: 'blade', hinge: { point: [0, 0, 0], axis: [0, 0, -1], side: [1, 0, 0] }, angle: 0.4, worldPoint: [0, 0, 0] })
    renderer.update(0.016)
    expect(lowestY(mesh)).toBeLessThan(-0.3 * Math.sin(0.4) * 0.99)
    expect(lowestY(mesh)).toBeGreaterThan(-0.3 * Math.sin(0.4) * 1.01 - 0.002)
    const after = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array
    for (let i = 0; i < before.length; i += 3) if (before[i]! < -BEND_SMOOTH_RADIUS) expect(after[i + 1]).toBeCloseTo(before[i + 1]!, 9)
    const kept = Array.from(after)
    for (let n = 0; n < 5; n++) renderer.update(0.016)
    expect(Array.from((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array)).toEqual(kept)
  })

  it('stacks on the dents the plate already has', () => {
    const { world, renderer, mesh } = setup()
    world.emit({ type: 'dent', object: 'blade', part: 'blade', worldPoint: [-0.2, 0.001, 0], dent: { point: [-0.2, 0.001, 0], normal: [0, -1, 0], radius: 0.05, depth: 0.004 } })
    renderer.update(0.016)
    const dented = lowestY(mesh)
    world.emit({ type: 'bend', object: 'blade', part: 'blade', hinge: { point: [0, 0, 0], axis: [0, 0, -1], side: [1, 0, 0] }, angle: 0.4, worldPoint: [0, 0, 0] })
    renderer.update(0.016)
    expect(lowestY(mesh)).toBeLessThan(dented)
    const array = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array
    let dentKept = false
    for (let i = 0; i < array.length; i += 3) if (Math.abs(array[i]! + 0.2) < 0.02 && array[i + 1]! > 0.001 + 0.001) dentKept = true
    expect(dentKept).toBe(true)
  })
})
