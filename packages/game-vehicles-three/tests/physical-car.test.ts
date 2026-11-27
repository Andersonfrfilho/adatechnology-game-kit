// @vitest-environment happy-dom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { WorkerCoordinator } from '@adatechnology/game-contracts'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoomOptions } from '@adatechnology/game-test-room'

import { VEHICLES_AREA_ID, createVehiclesTestModule } from '../src'
import { bodyMassOf } from '../src/crash-parts-math'
import type { PhysicalCar } from '../src/test-area/physical-car'
import { planHulls } from '../src/worker-kinds'
import type { HullPlanJob } from '../src/worker-kinds'
import { defaultVehicleFleet } from './default-fleet'
import { fakeDocument } from './fake-dom'
import { stubRenderer } from './vehicles-room'

const MODEL = 'compact_hatch'
const WALL_Z = 12
const CRASH_SPEED = 30

interface Scene {
  readonly world: JoltWorld
  readonly loop: ReturnType<typeof createPhysicsLoop>
  readonly room: ReturnType<typeof createTestRoom>
  readonly module: ReturnType<typeof createVehiclesTestModule>
  readonly fixedBodies: number
}

const sceneOf = async (physics: 'jolt' | 'own', extra: Partial<TestRoomOptions> = {}): Promise<Scene> => {
  const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD }) as JoltWorld
  const loop = createPhysicsLoop(world)
  world.createBody({ shape: { kind: 'box', half: [60, 0.5, 60] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  world.createBody({ shape: { kind: 'box', half: [12, 3, 0.5] }, motion: 'static', position: [0, 3, WALL_Z], user: -1 })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, physics: physics === 'jolt' ? loop : 'own', ...extra })
  const module = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never, three: THREE, vehicles: [MODEL], wrecks: [] })
  expect(room.loadModule(module as never).problems).toEqual([])
  room.openArea(VEHICLES_AREA_ID)
  room.clear()
  loop.stepFixed(1)
  const fixedBodies = world.bodyCount
  room.spawn('hatch', [0, 0, -4], 0)
  loop.stepFixed(1)
  return { world, loop, room, module, fixedBodies }
}

const rootOf = (scene: Scene): THREE.Object3D => [...(scene.module.placed as Map<string, { readonly root: THREE.Object3D }>).values()].find((entry) => entry.root.parent)!.root

const carOf = (scene: Scene): PhysicalCar | undefined => {
  return rootOf(scene).userData.physicalCar as PhysicalCar | undefined
}

const stepUntilBuilt = (scene: Scene): PhysicalCar => {
  const car = carOf(scene)!
  for (let frame = 0; frame < 400 && !car.isBuilt(); frame++) scene.loop.stepFixed(1)
  expect(car.isBuilt()).toBe(true)
  return car
}

/** A coordinator that plans in the call's own thread but answers late, as a worker does. */
const lateWorkers = (): { workers: WorkerCoordinator; calls: () => number } => {
  let calls = 0
  const workers = {
    run: (_kind: unknown, job: HullPlanJob) => {
      calls++
      return new Promise((resolve) => setTimeout(() => resolve(planHulls(job)), 5))
    },
  } as unknown as WorkerCoordinator
  return { workers, calls: () => calls }
}

describe('TS.4: the room car on the engine loop', () => {
  it('on the loop the car has its bodies in the loop world, drops parts when it hits a wall, and detach leaves the world as it was', async () => {
    const scene = await sceneOf('jolt')
    const { world, loop } = scene
    expect(world.bodyCount).toBe(scene.fixedBodies)
    const car = stepUntilBuilt(scene)
    expect(world.bodyCount).toBe(scene.fixedBodies + 1)
    expect(world.has(car.chassis()!)).toBe(true)
    world.setVelocity(car.chassis()!, [0, 0, CRASH_SPEED], [0, 0, 0])
    for (let step = 0; step < 900; step++) loop.stepFixed(1)
    const stats = car.parts()!.stats()
    expect(stats.events).toBeGreaterThan(0)
    expect(stats.released).toBeGreaterThan(0)
    expect(world.bodyCount).toBe(scene.fixedBodies + 1 + car.parts()!.partBodies().size)
    console.log(JSON.stringify({ name: 'ts4-crash', blows: stats.blows, events: stats.events, released: stats.released, hitParts: [...stats.hitParts] }))
    scene.room.clear()
    loop.stepFixed(1)
    expect(world.bodyCount).toBe(scene.fixedBodies)
    scene.room.dispose()
    world.dispose()
  }, 240000)

  it('a parked car settles at the height it is drawn and sleeps', async () => {
    const scene = await sceneOf('jolt')
    const car = stepUntilBuilt(scene)
    const root = rootOf(scene)
    const centre = bodyMassOf((root.userData.destructible as { model: { parts: Parameters<typeof bodyMassOf>[0] } }).model.parts).centre
    const drawn = root.localToWorld(new THREE.Vector3(...centre)).y
    for (let step = 0; step < 600 && !scene.world.isSleeping(car.chassis()!); step++) scene.loop.stepFixed(1)
    expect(scene.world.isSleeping(car.chassis()!)).toBe(true)
    expect(Math.abs(root.localToWorld(new THREE.Vector3(...centre)).y - drawn)).toBeLessThanOrEqual(0.02)
    scene.room.dispose()
    scene.world.dispose()
  }, 240000)

  it('the hull plan goes through the host workers and the car is built when it is back', async () => {
    const { workers, calls } = lateWorkers()
    const scene = await sceneOf('jolt', { workers })
    const car = carOf(scene)!
    for (let frame = 0; frame < 60; frame++) scene.loop.stepFixed(1)
    expect(car.isBuilt()).toBe(false)
    for (let frame = 0; frame < 200 && !car.isBuilt(); frame++) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      scene.loop.stepFixed(1)
    }
    expect(calls()).toBe(1)
    expect(car.isBuilt()).toBe(true)
    scene.room.dispose()
    scene.world.dispose()
  }, 240000)

  it('on the own solver nothing changes: no body of the car in the loop world and the drawn pieces fill in as before', async () => {
    const scene = await sceneOf('own')
    expect(carOf(scene)).toBeUndefined()
    const impl = rootOf(scene).userData.destructible as { colliders(): readonly unknown[]; collidersPending(): boolean }
    for (let call = 0; call < 200 && impl.collidersPending(); call++) impl.colliders()
    expect(impl.collidersPending()).toBe(false)
    scene.loop.stepFixed(120)
    expect(scene.world.bodyCount).toBe(scene.fixedBodies)
    scene.room.dispose()
    scene.world.dispose()
  }, 240000)
})
