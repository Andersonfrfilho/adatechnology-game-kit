import { BATCHED_LAYER } from '@adatechnology/game-render-three'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { VEHICLE_REBATCH_AFTER_MS, createVehicleLod } from '../src/vehicle-lod'

/** A vehicle of `parts` panels sharing one material (one batch), placed in a root, the way the area places a built vehicle. */
function vehicle(parts = 12): { root: THREE.Group; full: THREE.Group; meshes: THREE.Mesh[] } {
  const root = new THREE.Group()
  root.name = 'sedan'
  const full = new THREE.Group()
  const material = new THREE.MeshStandardMaterial()
  const meshes = Array.from({ length: parts }, (_, at) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), material)
    mesh.position.set(at * 0.5, 0.5, 0)
    mesh.castShadow = true
    full.add(mesh)
    return mesh
  })
  root.add(full)
  return { root, full, meshes }
}

/** The first draw of the full model (its buffers reach the GPU): the renderer calls the probe's onAfterRender. */
function drawOnce(full: THREE.Group): void {
  full.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) mesh.onAfterRender(undefined as never, undefined as never, undefined as never, mesh.geometry, mesh.material as THREE.Material, undefined as never)
  })
}

const batches = (root: THREE.Object3D): THREE.Object3D | undefined => root.getObjectByName('static-batches')
const inBatch = (mesh: THREE.Mesh): boolean => mesh.layers.mask === 1 << BATCHED_LAYER

describe('vehicle-lod: a vehicle hit in play', () => {
  it('is batched again once nothing has changed on it for the quiet time, and keeps its own shadows', () => {
    let clock = 0
    const { root, full, meshes } = vehicle()
    const lod = createVehicleLod({ THREE }, {}, root, full, { now: () => clock })
    lod.update(30, true)
    drawOnce(full)
    lod.update(30, true)
    expect(batches(root), 'right after the hit it draws part by part').toBeUndefined()
    clock += VEHICLE_REBATCH_AFTER_MS - 1
    lod.update(30, true)
    expect(batches(root)).toBeUndefined()
    clock += 1
    lod.update(30, true)
    // the batcher merges over the next updates, a material at a time
    lod.update(30, true)
    expect(batches(root)?.children.length).toBe(1)
    expect(meshes.every(inBatch), 'every still part draws in the batch').toBe(true)
    expect(meshes.every((mesh) => mesh.castShadow), 'no proxy: the parts keep the shadow of the damaged shape').toBe(true)
    expect(lod.fused).toBe(false)
  })

  it('gives a part that changes its own draw back, and waits for quiet again when every part changed', () => {
    let clock = 0
    const { root, full, meshes } = vehicle(4)
    const lod = createVehicleLod({ THREE }, {}, root, full, { now: () => clock })
    lod.update(30, true)
    drawOnce(full)
    clock += VEHICLE_REBATCH_AFTER_MS
    lod.update(30, true)
    lod.update(30, true)
    expect(meshes.every(inBatch)).toBe(true)
    // a dent moves one panel
    meshes[0]!.position.y += 0.05
    root.updateMatrixWorld(true)
    lod.update(30, true)
    expect(inBatch(meshes[0]!)).toBe(false)
    expect(meshes.slice(1).every(inBatch)).toBe(true)
    // the blast moves all of them: the batch empties, and is not made again until the vehicle is quiet
    for (const mesh of meshes) mesh.position.y += 0.05
    root.updateMatrixWorld(true)
    lod.update(30, true)
    lod.update(30, true)
    expect(batches(root)).toBeUndefined()
    clock += VEHICLE_REBATCH_AFTER_MS
    lod.update(30, true)
    lod.update(30, true)
    expect(meshes.every(inBatch)).toBe(true)
    lod.dispose()
    expect(meshes.some(inBatch)).toBe(false)
  })
})
