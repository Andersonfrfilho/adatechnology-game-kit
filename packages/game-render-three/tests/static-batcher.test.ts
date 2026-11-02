import { describe, expect, it } from 'vitest'

import { BATCHED_LAYER, createStaticBatcher } from '../src'
import { THREE } from './helpers'

function car() {
  const root = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial()
  const glass = new THREE.MeshStandardMaterial()
  const parts = [0, 1, 2].map((at) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), paint)
    mesh.position.set(at * 2, 0, 0)
    root.add(mesh)
    return mesh
  })
  const panes = [0, 1].map((at) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glass)
    mesh.position.set(at, 2, 0)
    root.add(mesh)
    return mesh
  })
  return { root, parts, panes }
}

const drawn = (object: THREE.Object3D) => object.layers.test(new THREE.Camera().layers)

describe('createStaticBatcher', () => {
  it('draws the meshes of one material as one batch, in place, and takes them off the camera layer', () => {
    const { root, parts, panes } = car()
    const batcher = createStaticBatcher(THREE, root)
    expect(batcher.stats()).toEqual({ batches: 2, batched: 5, released: 0 })
    expect(parts.every((part) => !drawn(part) && part.layers.isEnabled(BATCHED_LAYER))).toBe(true)
    const paint = batcher.group.children.find((child) => (child as THREE.Mesh).material === parts[0]!.material) as THREE.Mesh
    paint.geometry.computeBoundingBox()
    expect(paint.geometry.boundingBox!.min.x).toBeCloseTo(-0.5)
    expect(paint.geometry.boundingBox!.max.x).toBeCloseTo(4.5)
    expect(panes.every((pane) => !drawn(pane))).toBe(true)
  })

  it('gives a mesh its own draw back when it moves, is dented or is hidden, and leaves the others batched', () => {
    const { root, parts, panes } = car()
    const batcher = createStaticBatcher(THREE, root)
    parts[0]!.rotation.y = 1
    root.updateMatrixWorld(true)
    parts[1]!.geometry.attributes.position!.needsUpdate = true
    panes[0]!.visible = false
    expect(batcher.update()).toBe(3)
    expect(drawn(parts[0]!) && drawn(parts[1]!)).toBe(true)
    expect(drawn(parts[2]!)).toBe(false)
    expect(batcher.stats().batched).toBe(2)
    expect(batcher.update()).toBe(0)
  })

  it('moves with its root without releasing anything, and is never hit by a ray', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root)
    root.position.set(10, 0, 0)
    root.updateMatrixWorld(true)
    expect(batcher.update()).toBe(0)
    const ray = new THREE.Raycaster(new THREE.Vector3(10, 0, 5), new THREE.Vector3(0, 0, -1))
    ray.layers.enableAll()
    const hits = ray.intersectObject(root, true)
    expect(hits[0]?.object).toBe(parts[0])
  })

  it('puts every mesh back on its layer on dispose', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root)
    batcher.dispose()
    expect(parts.every(drawn)).toBe(true)
    expect(root.getObjectByName('static-batches')).toBeUndefined()
  })
})

describe('createStaticBatcher with a rebuilt model', () => {
  it('releases a mesh that is no longer under its root', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root)
    root.remove(parts[0]!)
    expect(batcher.update()).toBe(1)
  })
})

describe('createStaticBatcher with a budget', () => {
  it('makes the batches over the next updates instead of in the call', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root, { budgetMs: 0 })
    expect(batcher.stats().batches).toBe(0)
    expect(drawn(parts[0]!)).toBe(true)
    batcher.update()
    batcher.update()
    expect(batcher.stats().batches).toBe(2)
    expect(drawn(parts[0]!)).toBe(false)
  })
})

describe('createStaticBatcher with every mesh of a batch released', () => {
  it('hides the empty batch', () => {
    const { root, panes } = car()
    const batcher = createStaticBatcher(THREE, root)
    for (const pane of panes) pane.visible = false
    batcher.update()
    const glass = batcher.group.children.find((child) => (child as THREE.Mesh).material === panes[0]!.material)!
    expect(glass.visible).toBe(false)
  })
})

describe('createStaticBatcher following its meshes', () => {
  it('keeps a posed mesh batched and draws its part of the batch where the mesh now is', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root, { followMeshes: true })
    const moved = parts[1]!
    moved.position.set(5, 3, -2)
    moved.rotation.set(0, Math.PI / 2, 0)
    root.updateMatrixWorld(true)
    expect(batcher.update()).toBe(0)
    const paint = batcher.group.children.find((child) => (child as THREE.Mesh).material === moved.material) as THREE.SkinnedMesh
    expect(paint.isSkinnedMesh).toBe(true)
    paint.skeleton.update()
    const vertices = (parts[0]!.geometry.attributes.position as THREE.BufferAttribute).count
    const corner = new THREE.Vector3().fromBufferAttribute(moved.geometry.attributes.position as THREE.BufferAttribute, 0)
    const expected = moved.localToWorld(corner.clone())
    const drawnAt = paint.localToWorld(paint.applyBoneTransform(vertices, new THREE.Vector3().fromBufferAttribute(paint.geometry.attributes.position as THREE.BufferAttribute, vertices)))
    expect(drawnAt.distanceTo(expected)).toBeLessThan(1e-5)
  })

  it('still gives a dented or hidden mesh its own draw back', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root, { followMeshes: true })
    parts[0]!.visible = false
    ;(parts[1]!.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    expect(batcher.update()).toBe(2)
  })
})
