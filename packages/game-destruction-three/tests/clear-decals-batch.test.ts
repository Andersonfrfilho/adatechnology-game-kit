import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { Visuals } from '../src/visual'

const DECALS = 40
const CHIPS = 30
const FACE = new THREE.Vector3(0, 0, 1)

/** A wall mesh under a four-deep chain of rotated, moved groups, with a row of spalls along it. */
const wall = () => {
  const visuals = new Visuals(THREE, false, 1000)
  const root = new THREE.Group()
  let parent: THREE.Object3D = root
  for (let depth = 0; depth < 4; depth++) {
    const group = new THREE.Group()
    group.position.set(depth, 0.5, -depth)
    group.rotation.y = 0.2 * depth
    parent.add(group)
    parent = group
  }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(DECALS, 2, 0.2))
  parent.add(mesh)
  root.updateMatrixWorld(true)
  const mv = visuals.makeMeshVis(mesh, 'wall')
  const face = new THREE.Vector3()
  for (let i = 0; i < DECALS; i++) {
    mesh.localToWorld(face.set(i - DECALS / 2 + 0.5, 0, 0.1))
    visuals.addSpall(mv, face.clone(), FACE.clone().transformDirection(mesh.matrixWorld), 0.05, 0xff0000)
  }
  return { visuals, mesh, mv, root }
}

type Box = { readonly center: THREE.Vector3; readonly half: THREE.Vector3; readonly rotation: THREE.Quaternion }

const boxes = (mesh: THREE.Mesh): Box[] =>
  Array.from({ length: CHIPS }, (_, i) => ({
    center: mesh.localToWorld(new THREE.Vector3(i * (DECALS / CHIPS) - DECALS / 2 + 0.5, 0, 0.1)),
    half: new THREE.Vector3(0.4, 0.5, 0.5),
    rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.3),
  }))

/** What a chip took away before the decals were cleared from their own matrices: the decal's world position, one by one. */
const survivorsByWorldPosition = (mv: ReturnType<typeof wall>['mv'], all: readonly Box[]): number[][] => {
  const point = new THREE.Vector3()
  return mv.decals
    .filter((decal) => {
      decal.obj.getWorldPosition(point)
      return !all.some((box) => {
        const local = point.clone().sub(box.center).applyQuaternion(box.rotation.clone().invert())
        return Math.abs(local.x) <= box.half.x && Math.abs(local.y) <= box.half.y && Math.abs(local.z) <= box.half.z
      })
    })
    .map((decal) => decal.obj.position.toArray())
}

describe('clearing the decals of many chips does not walk the matrices once per decal', () => {
  it('leaves the decals a reference by world position leaves, and updates the world matrix once per chip, not once per decal and chip', () => {
    const { visuals, mesh, mv } = wall()
    const all = boxes(mesh)
    const expected = survivorsByWorldPosition(mv, all)
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.length).toBeLessThan(DECALS)

    const spy = vi.spyOn(THREE.Object3D.prototype, 'updateWorldMatrix')
    for (const box of all) visuals.clearDecals(mv, box.center, box.half, box.rotation)
    const walks = spy.mock.contexts.filter((context) => context === mesh).length
    spy.mockRestore()

    expect(mv.decals.map((decal) => decal.obj.position.toArray())).toEqual(expected)
    expect(visuals.decalCount).toBe(expected.length)
    expect(walks).toBeLessThanOrEqual(CHIPS)
  })

  it('a mesh with no decals costs no matrix update', () => {
    const { visuals, mesh } = wall()
    const bare = visuals.makeMeshVis(mesh, 'bare')
    const all = boxes(mesh)
    const spy = vi.spyOn(THREE.Object3D.prototype, 'updateWorldMatrix')
    for (const box of all) visuals.clearDecals(bare, box.center, box.half, box.rotation)
    const walks = spy.mock.calls.length
    spy.mockRestore()
    expect(walks).toBe(0)
  })
})
