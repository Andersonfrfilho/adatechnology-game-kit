import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createVehicleColliders } from '../src'
import { build } from './vehicle-colliders-support'

describe('vehicle colliders across LOD swaps (spec 018 D2)', () => {
  it('keeps the built pieces when an ancestor above c.vehicle hides for fused LOD, and rebuilds nothing when it shows again', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const colliders = createVehicleColliders(THREE, vehicle, frame, { budget: 25000 })
    let pieces = colliders.pieces()
    for (let guard = 0; colliders.isPending() && guard < 30; guard++) pieces = colliders.pieces()
    expect(colliders.isPending()).toBe(false)
    expect(pieces.length).toBeGreaterThan(0)

    // createVehicleLod hides frame.children[0] (the turn group above vehicle.vehicle) when the car draws fused far from the camera
    const full = frame.children[0]!
    expect(full).not.toBe(vehicle.vehicle.vehicle)
    full.visible = false
    const whileFused = colliders.pieces()
    expect(whileFused.length).toBe(pieces.length)
    expect(whileFused.every((piece, index) => piece === pieces[index])).toBe(true)
    expect(colliders.isPending()).toBe(false)

    // when a hit or blast un-fuses the car, every piece is already there: no budget spent, no piece rebuilt
    full.visible = true
    const afterUnfuse = colliders.pieces()
    expect(afterUnfuse.length).toBe(pieces.length)
    expect(afterUnfuse.every((piece, index) => piece === pieces[index])).toBe(true)
    expect(colliders.isPending()).toBe(false)
    dispose()
  }, 60000)

  it('still drops a part hidden inside c.vehicle', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const colliders = createVehicleColliders(THREE, vehicle, frame)
    const before = colliders.pieces()
    const mirror = vehicle.objectsOf('mirror_left')
    expect(mirror.length).toBeGreaterThan(0)
    expect(before.some((piece) => piece.id === 'mirror_left')).toBe(true)
    for (const object of mirror) object.visible = false
    const after = colliders.pieces()
    expect(after.some((piece) => piece.id === 'mirror_left')).toBe(false)
    expect(after.some((piece) => piece.id === 'mirror_right')).toBe(true)
    dispose()
  }, 60000)

  it('ignores static-batch copies marked noSurfaceRay under c.vehicle', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const colliders = createVehicleColliders(THREE, vehicle, frame)
    const before = colliders.pieces()
    const batchGroup = new THREE.Group()
    batchGroup.name = 'static-batches'
    batchGroup.userData.noSurfaceRay = true
    batchGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()))
    ;(vehicle.vehicle.vehicle as THREE.Object3D).add(batchGroup)
    const after = colliders.pieces()
    expect(after.length).toBe(before.length)
    expect(after.every((piece, index) => piece === before[index])).toBe(true)
    dispose()
  }, 60000)

  it('follows the live c.vehicle after vehicle.reset() and does not drop owned parts while fused', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const colliders = createVehicleColliders(THREE, vehicle, frame, { budget: 25000 })
    let pieces = colliders.pieces()
    for (let guard = 0; colliders.isPending() && guard < 30; guard++) pieces = colliders.pieces()
    expect(colliders.isPending()).toBe(false)

    // reset() replaces vehicle.vehicle with a fresh VehicleContext under frame.children[0]
    vehicle.reset!()
    const full = frame.children[0]!
    full.visible = false
    pieces = colliders.pieces()
    for (let guard = 0; colliders.isPending() && guard < 30; guard++) pieces = colliders.pieces()
    expect(colliders.isPending()).toBe(false)
    expect(pieces.some((piece) => piece.id === 'battery')).toBe(true)
    expect(pieces.some((piece) => piece.id === 'bumper_front')).toBe(true)

    // unfusing must not discover any new pieces or spend any budget
    full.visible = true
    const afterUnfuse = colliders.pieces()
    expect(colliders.isPending()).toBe(false)
    expect(afterUnfuse.length).toBe(pieces.length)
    expect(afterUnfuse.every((piece, index) => piece === pieces[index])).toBe(true)

    // a mutation on the post-reset vehicle must update colliders (proving the live c.vehicle is read, not the disposed one)
    vehicle.crumple(vehicle.partWorldCenter('bumper_front'), [-1, 0, 0], 0.3)
    const afterCrumple = colliders.pieces()
    expect(afterCrumple.some((piece, index) => piece !== afterUnfuse[index])).toBe(true)
    dispose()
  }, 60000)
})
