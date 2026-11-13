import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Dent, Hole, Vec3 } from '@adatechnology/game-destruction'
import { createVfx } from '@adatechnology/game-vfx'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const HINGE: { point: Vec3; axis: Vec3; side: Vec3 } = { point: [0.05, 0, 0], axis: [0, 0, -1], side: [1, 0, 0] }
const DENT: Dent = { point: [-0.2, 0.001, 0], normal: [0, -1, 0], radius: 0.05, depth: 0.004 }
const HOLE: Hole = { point: [-0.1, 0.001, 0.05], normal: [0, 1, 0], diameter: 0.012, through: true }
const BEND = 0.4

/** A pressed steel blade (a thin plate) bound to a fake world; `state` is what the world holds for it when the renderer is made. */
const blade = (state: Parameters<typeof partState>[2] = {}) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), onSound: () => {}, vfx: createVfx() })
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.002, 0.2, 12, 1, 4), new THREE.MeshStandardMaterial())
  const root = new THREE.Group()
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  world.addObject('blade', [partState('blade', 'steel', state)], [['blade']])
  renderer.bind('blade', root, { parts: { blade: mesh } })
  return { world, renderer, mesh, root }
}
const positionsOf = (mesh: THREE.Mesh): number[] => Array.from((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array)
/** The drawn marks (holes, rims, crack lines) are objects added under the blade's root: its descendants beyond the plate itself. */
const decalsOf = (root: THREE.Object3D): number => {
  let count = 0
  root.traverse(() => count++)
  return count - 2
}

describe('the renderer draws an object again from the state its world holds', () => {
  it('a blade put back bent, dented and holed shows the same vertices and as many marks as one that took the hits live', () => {
    const live = blade()
    live.world.emit({ type: 'dent', object: 'blade', part: 'blade', worldPoint: DENT.point, dent: { ...DENT } })
    live.world.emit({ type: 'hole', object: 'blade', part: 'blade', worldPoint: HOLE.point, hole: { ...HOLE }, blow: 'ballistic' })
    live.world.emit({ type: 'bend', object: 'blade', part: 'blade', hinge: { ...HINGE }, angle: BEND, worldPoint: [0, 0, 0] })
    live.renderer.update(0.016)

    const restored = blade({ dents: [{ ...DENT }], holes: [{ ...HOLE }], bend: BEND, bendHinge: { ...HINGE } })
    const untouched = positionsOf(restored.mesh)
    restored.renderer.redraw('blade')
    restored.renderer.update(0.016)

    const bent = positionsOf(restored.mesh)
    expect(bent).not.toEqual(untouched)
    expect(bent.length).toBe(positionsOf(live.mesh).length)
    bent.forEach((value, index) => expect(value).toBeCloseTo(positionsOf(live.mesh)[index]!, 5))
    expect(decalsOf(restored.root)).toBe(decalsOf(live.root))
    expect(decalsOf(restored.root)).toBeGreaterThan(0)
  })

  it('draws twice the same as once, and a part that is broken in the state is hidden', () => {
    const { renderer, mesh } = blade({ bend: BEND, bendHinge: { ...HINGE } })
    renderer.redraw('blade')
    const once = positionsOf(mesh)
    renderer.redraw('blade')
    expect(positionsOf(mesh)).toEqual(once)
    const gone = blade({ status: 'broken' })
    gone.renderer.redraw('blade')
    expect(gone.mesh.visible).toBe(false)
  })
})
