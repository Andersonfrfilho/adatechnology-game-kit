import { fleetVehicleIds } from '@adatechnology/game-vehicles-fleet'
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'
import { createVehicleColliders, vehicleColliders } from '../src'
import { MIN_PLANE, REACH, SAMPLE, boundsOf, build, cornersOf, isInside, nearest, pointsOf } from './vehicle-colliders-support'
import type { Piece, Points } from './vehicle-colliders-support'

afterEach(() => new Promise((resolve) => setImmediate(resolve)))

describe('the pieces a vehicle collides with, on the whole fleet', () => {
  it('has the 69 models', () => expect(fleetVehicleIds.length).toBe(69))

  it.each([...fleetVehicleIds])('%s: no box reaches past its own piece and every drawn piece is in a box', (id) => {
    const { vehicle, frame, dispose } = build(id)
    const pieces = vehicleColliders(THREE, vehicle, frame)
    expect(pieces.length).toBeGreaterThan(0)
    const partIds = new Set(vehicle.model.parts.map((part) => part.id))
    // the meshes each part draws on its own, tyre first (a rim's group holds the tyre too), then the shell: what no part owns
    const owned = new Set<THREE.Mesh>()
    const own = new Map<string, Points>()
    for (const part of vehicle.model.parts) {
      const { points, meshes } = pointsOf(vehicle.objectsOf(part.id), frame, owned)
      meshes.forEach((mesh) => owned.add(mesh))
      if (points.length) own.set(part.id, points)
    }
    const shell = pointsOf([vehicle.vehicle.vehicle as THREE.Object3D], frame, owned).points
    const everything = pointsOf([vehicle.vehicle.vehicle as THREE.Object3D], frame, new Set()).points
    let worst = 0
    for (const piece of pieces) {
      expect(partIds.has(piece.id), `${id}: piece ${piece.id} is a part`).toBe(true)
      const mine = own.get(piece.id)
      // a shell piece is held by triangles of the shell, an owned piece by the meshes of its part (which may also own triangles of the shell inside its box)
      const reference = mine ? [...mine, ...shell] : shell
      const bounds = boundsOf(reference).expandByScalar(REACH)
      for (const corner of cornersOf(piece)) {
        worst = Math.max(worst, bounds.distanceToPoint(corner))
        expect(bounds.containsPoint(corner), `${id}: ${piece.id} reaches past its mesh`).toBe(true)
      }
      if (!piece.mesh) {
        // a box is held only where each corner has a vertex of the piece within 1 cm on each axis of the box
        for (const corner of cornersOf(piece)) expect(nearest(corner, reference), `${id}: ${piece.id} corner is air`).toBeLessThanOrEqual((REACH + MIN_PLANE) * Math.sqrt(3) + 1e-6)
      }
    }
    // the union covers what is drawn: a sample of every drawn vertex lies in a piece, within the 2.5 cm a coarsened mesh may move
    const step = Math.max(1, Math.floor(everything.length / 3 / SAMPLE)) * 3
    let missed = 0
    let checked = 0
    for (let i = 0; i < everything.length; i += step) {
      checked++
      if (!pieces.some((piece) => isInside(piece, everything[i] as number, everything[i + 1] as number, everything[i + 2] as number, 0.03))) missed++
    }
    expect(missed, `${id}: ${missed} of ${checked} drawn vertices in no piece`).toBe(0)
    expect(worst).toBeLessThanOrEqual(0.0001)
    dispose()
  }, 120000)

  it('a mirror is a piece of its own and the cab does not reach out to it', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const pieces = vehicleColliders(THREE, vehicle, frame)
    const mirrors = pieces.filter((piece) => /^mirror_/.test(piece.id))
    expect(new Set(mirrors.map((piece) => piece.id))).toEqual(new Set(['mirror_left', 'mirror_right']))
    // the drawing without the mirrors: no other piece reaches past it, so a mirror never widens the cab or the body
    const mirrorMeshes = new Set<THREE.Mesh>()
    for (const mirror of ['mirror_left', 'mirror_right']) pointsOf(vehicle.objectsOf(mirror), frame, mirrorMeshes).meshes.forEach((mesh) => mirrorMeshes.add(mesh))
    const bounds = boundsOf(pointsOf([vehicle.vehicle.vehicle as THREE.Object3D], frame, mirrorMeshes).points).expandByScalar(REACH)
    for (const piece of pieces) {
      if (/^mirror_/.test(piece.id)) continue
      for (const corner of cornersOf(piece)) expect(bounds.containsPoint(corner), `${piece.id} reaches past the drawing without the mirrors`).toBe(true)
    }
    const outermost = (items: readonly Piece[]): number => Math.max(...items.flatMap((piece) => cornersOf(piece).map((corner) => Math.abs(corner.x))))
    expect(outermost(mirrors)).toBeGreaterThan(0)
    dispose()
  }, 60000)

  it('a part that came off has no piece, and the others stay', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const before = vehicleColliders(THREE, vehicle, frame)
    expect(before.some((piece) => piece.id === 'mirror_left')).toBe(true)
    for (let i = 0; i < 200 && vehicle.disassemble!('mirror_left~door_front_left', 'wrench', 0.2) < 1; i++) vehicle.update!(0.2)
    expect(vehicle.detachedParts()).toContain('mirror_left')
    const after = vehicleColliders(THREE, vehicle, frame)
    expect(after.some((piece) => piece.id === 'mirror_left')).toBe(false)
    expect(after.some((piece) => piece.id === 'mirror_right')).toBe(true)
    expect(after.length).toBeLessThan(before.length)
    expect(before.length - after.length).toBe(before.filter((piece) => piece.id === 'mirror_left').length)
    dispose()
  }, 60000)
  it('after the first build, a hit on one part costs a few milliseconds of collider work, and only the pieces it touched are made again', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const colliders = createVehicleColliders(THREE, vehicle, frame)
    const first = colliders.pieces()
    const again = colliders.pieces()
    expect(again.length).toBe(first.length)
    // nothing changed: the very same pieces
    expect(again.every((piece) => first.includes(piece))).toBe(true)
    const times: number[] = []
    let remade = 0
    let before = again
    for (const [part, direction] of [['door_front_left', [0, 0, -1]], ['door_rear_right', [0, 0, 1]], ['fender_front_left', [0, 0, -1]], ['hood', [0, -1, 0]], ['bumper_front', [-1, 0, 0]], ['roof', [0, -1, 0]], ['lid', [0, -1, 0]], ['door_front_right', [0, 0, 1]]] as const) {
      vehicle.hit({ type: 'ballistic', point: vehicle.partWorldCenter(part), direction: [...direction], energy: 1500, caliber: 9 })
      vehicle.update!(0.1)
      const t0 = performance.now()
      const after = colliders.pieces()
      times.push(performance.now() - t0)
      remade += after.filter((piece) => !before.includes(piece)).length
      before = after
    }
    times.sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]!
    console.log(`collider work after a hit, ms: ${times.map((t) => t.toFixed(2)).join(' ')}; median ${median.toFixed(2)}; pieces ${first.length}, remade in total ${remade}`)
    expect(median).toBeLessThanOrEqual(10)
    expect(remade).toBeLessThan(first.length)
    // a blunt 20 kJ blow dents panels over the whole side: many more pieces move, and it is a rare event, so it is only reported
    vehicle.hit({ type: 'blunt', point: vehicle.partWorldCenter('door_front_left'), direction: [0, 0, -1], energy: 20000, radius: 0.3 })
    vehicle.update!(0.1)
    const t1 = performance.now()
    const blow = colliders.pieces()
    console.log(`collider work after a blunt 20 kJ blow, ms: ${(performance.now() - t1).toFixed(2)}; pieces remade ${blow.filter((piece) => !before.includes(piece)).length}`)
    dispose()
  }, 60000)

  it('a crumple moves the pieces with the drawing', () => {
    const { vehicle, frame, dispose } = build('midsize_sedan')
    const colliders = createVehicleColliders(THREE, vehicle, frame)
    const before = colliders.pieces()
    vehicle.crumple(vehicle.partWorldCenter('bumper_front'), [-1, 0, 0], 0.3)
    const after = colliders.pieces()
    const moved = after.filter((piece) => !before.includes(piece))
    expect(moved.length).toBeGreaterThan(0)
    expect(moved.length).toBeLessThan(before.length)
    dispose()
  }, 60000)

  it('a budget fills the pieces in over several calls and ends with the same ones', () => {
    const { vehicle, frame, dispose } = build('compact_hatch')
    const whole = vehicleColliders(THREE, vehicle, frame)
    const colliders = createVehicleColliders(THREE, vehicle, frame, { budget: 20000 })
    let calls = 0
    let pieces = colliders.pieces()
    calls++
    expect(colliders.isPending()).toBe(true)
    expect(pieces.length).toBeLessThan(whole.length)
    while (colliders.isPending() && calls < 100) {
      pieces = colliders.pieces()
      calls++
    }
    expect(colliders.isPending()).toBe(false)
    expect(calls).toBeGreaterThan(2)
    expect(pieces.map((piece) => piece.key).sort()).toEqual(whole.map((piece) => piece.key).sort())
    dispose()
  }, 60000)
})
