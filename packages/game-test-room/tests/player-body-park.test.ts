import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop, createPhysicsServices } from '@adatechnology/game-physics'
import type { BodyId, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import * as THREE from 'three'
import type * as THREE_NS from 'three'

import type { ItemSeat } from '@adatechnology/game-contracts'

import type { RoomAvatar, TestRoomItem } from '../src'
import { createEngineLocomotion } from '../src/player-body'
import type { Locomotion } from '../src/locomotion'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

/** Spec 008, TS.9j: the body leaves the world for a seat, a flight or a vehicle and comes back where it fits, never inside something. */

const STEPS_PER_SECOND = Math.round(1 / (KIT_WORLD.fixedStep ?? 1 / 120))

const sceneOf = async () => {
  const world: PhysicsWorld = (await createJoltEngine()).createWorld(KIT_WORLD)
  world.createBody({ shape: { kind: 'box', half: [50, 0.5, 50] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  const services = createPhysicsServices({ loop: createPhysicsLoop(world) })
  const box = (centre: [number, number, number], half: [number, number, number]): BodyId => world.createBody({ shape: { kind: 'box', half }, motion: 'static', position: centre, user: -1 })
  const body: Locomotion = createEngineLocomotion({ colliders: [], limit: 50 }, [6, 0, 6], { services })
  const run = (seconds: number): void => services.loop.stepFixed(Math.round(seconds * STEPS_PER_SECOND))
  const solidsAt = (x: number, y: number, z: number): number =>
    world.overlapShape({ kind: 'capsule', halfHeight: 0.6, radius: 0.3 }, [x, y + 0.9 + 0.03, z], [0, 0, 0, 1], [], { layers: ['static', 'debris', 'prop', 'vehicle'] })
  return { world, body, box, run, solidsAt }
}

describe('the body of the player parks and comes back (spec 008, TS.9j)', () => {
  it('seated: the exit blocked on both sides, it comes down on the roof of the seat and penetrates nothing', { timeout: 60000 }, async () => {
    const { world, body, box, run, solidsAt } = await sceneOf()
    box([0, 0.5, 0], [1, 0.5, 1])
    box([2.2, 1, 0], [0.4, 1, 0.8])
    box([-2.2, 1, 0], [0.4, 1, 0.8])
    run(0.2)
    body.place([0, 1.7, 0])
    body.setSeated(true)
    run(0.5)
    body.place([2.2, 1.7, 0])
    body.setSeated(false)
    run(0.5)
    expect(body.seated).toBe(false)
    expect(body.feet).toBeGreaterThan(0.99)
    expect(body.feet).toBeLessThan(1.1)
    expect(Math.hypot(body.x, body.z)).toBeLessThan(0.1)
    expect(solidsAt(body.x, body.feet, body.z)).toBe(0)
    world.dispose()
  })

  it('seated: with the exit free it comes out there', { timeout: 60000 }, async () => {
    const { world, body, box, run } = await sceneOf()
    box([0, 0.5, 0], [1, 0.5, 1])
    run(0.2)
    body.place([0, 1.7, 0])
    body.setSeated(true)
    run(0.3)
    body.place([2.2, 1.7, 0])
    body.setSeated(false)
    run(0.5)
    expect(body.x).toBeCloseTo(2.2, 1)
    expect(body.feet).toBeLessThan(0.05)
    expect(body.grounded).toBe(true)
    world.dispose()
  })

  it('held by a module: it is out of the world while it lasts and the keys do not move it', { timeout: 60000 }, async () => {
    const { world, body, run } = await sceneOf()
    run(0.2)
    body.hold(true)
    body.update(1 / 60, { walkX: 0, walkZ: -1, speed: 3, running: false, jump: false, walkHeld: true, crouched: false, rise: 0 })
    run(0.5)
    expect(body.x).toBeCloseTo(6, 3)
    body.hold(false)
    run(0.3)
    expect(body.x).toBeCloseTo(6, 1)
    expect(body.grounded).toBe(true)
    world.dispose()
  })

  it('flying leaves the world, and coming down puts it back on the floor', { timeout: 60000 }, async () => {
    const { world, body, run } = await sceneOf()
    run(0.2)
    expect(body.toggleFly()).toBe(true)
    body.update(1 / 60, { walkX: 0, walkZ: 0, speed: 5, running: false, jump: false, walkHeld: false, crouched: false, rise: 1 })
    expect(body.feet).toBeGreaterThan(0.05)
    expect(body.toggleFly()).toBe(false)
    run(1)
    expect(body.flying).toBe(false)
    expect(body.grounded).toBe(true)
    expect(body.feet).toBeLessThan(0.05)
    world.dispose()
  })
})

const SEAT_HEIGHT = 0.45
const SEATS: ItemSeat[] = [{ id: 'left', pose: 'sit', pos: [-0.4, SEAT_HEIGHT, 0], ry: 0, exit: [-0.4, 0, 0.8] }]
const buildBench = (T: typeof THREE_NS): THREE_NS.Object3D => {
  const root = new T.Group()
  const seat = new T.Mesh(new T.BoxGeometry(1.4, 0.06, 0.45), new T.MeshStandardMaterial())
  seat.name = 'seat'
  seat.position.y = SEAT_HEIGHT - 0.03
  root.add(seat)
  return root
}
const bench: TestRoomItem = {
  id: 'bench',
  name: 'Bench',
  group: 'Furniture',
  build: buildBench,
  spec: { name: 'bench', parts: [{ id: 'seat', material: 'wood_hard', mass: 18, shape: { kind: 'box', size: [1.4, 0.06, 0.45] }, position: [0, SEAT_HEIGHT - 0.03, 0] }], joints: [] },
  movable: false,
  seats: SEATS,
}

describe('sitting on the engine (spec 008, TS.9j)', () => {
  it('sits with the body out of the world and stands at the exit of the seat', { timeout: 60000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const room = makeRoom({ physics: createPhysicsLoop(world), catalog: [...demoItems('en'), bench], scenery: { table: null, shelf: null } })
    try {
      const { objectId } = room.spawn('bench', [0, 0, -2], 0)
      room.look([0.6, 1.7, -0.5], [0, 0.5, -2])
      for (let frame = 0; frame < 30; frame++) room.update(1 / 60, { live: true })
      expect(room.sit(objectId)).not.toBeNull()
      for (let frame = 0; frame < 30; frame++) room.update(1 / 60, { live: true })
      expect(room.camera.position.x).toBeCloseTo(-0.4, 1)
      expect(room.camera.position.z).toBeCloseTo(-2, 1)
      expect(room.camera.position.y).toBeCloseTo(SEAT_HEIGHT + 0.62, 1)
      expect(room.stand()).toBe(true)
      for (let frame = 0; frame < 30; frame++) room.update(1 / 60, { live: true })
      expect(room.playerPosition[0]).toBeCloseTo(-0.4, 1)
      expect(room.playerPosition[2]).toBeCloseTo(-1.2, 1)
      expect(room.playerPosition[1]).toBeLessThan(0.05)
    } finally {
      room.dispose()
      world.dispose()
    }
  })
})

describe('the avatar on the engine (spec 008, TS.9k)', () => {
  it('stands where the feet are drawn: at most two frames of walking behind the body in the world', { timeout: 60000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const room = makeRoom({ physics: createPhysicsLoop(world) })
    const avatar: RoomAvatar = { root: new THREE.Group(), update: () => undefined, hand: () => new THREE.Object3D() }
    room.setAvatar(avatar)
    room.setCameraMode('third')
    try {
      room.look([0, 1.7, 4], [0, 1.7, -10])
      for (let frame = 0; frame < 30; frame++) room.update(1 / 60, { live: true })
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      let farthest = 0
      for (let frame = 0; frame < 60; frame++) {
        room.update(1 / 60, { live: true })
        farthest = Math.max(farthest, Math.hypot(avatar.root.position.x - room.playerPosition[0], avatar.root.position.z - room.playerPosition[2]))
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      expect(avatar.root.position.z).toBeLessThan(4 - 2.5)
      expect(farthest).toBeLessThan((2 * 3.4) / 60)
      expect(avatar.root.position.y).toBeCloseTo(0, 2)
    } finally {
      room.dispose()
      world.dispose()
    }
  })
})
