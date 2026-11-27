// @vitest-environment happy-dom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { STATE } from '@adatechnology/game-crowd'
import type { CrowdPack } from '@adatechnology/game-crowd'
import { CROWD_AREA_ID, createCrowdTestModule } from '@adatechnology/game-crowd-three'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { BodyId } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'
import { createTestRoom } from '@adatechnology/game-test-room'

import { VEHICLES_AREA_ID, createVehiclesTestModule } from '../src'
import type { PhysicalCar } from '../src/test-area/physical-car'
import { defaultVehicleFleet } from './default-fleet'
import { fakeDocument } from './fake-dom'
import { stubRenderer } from './vehicles-room'

/**
 * Spec 008, TS.6: the room car runs the room crowd over, both modules loaded in a room made as production makes it (Jolt, no floor made by hand), whichever module the
 * room attaches first.
 */

const MODEL = 'compact_hatch'
const STEP = 1 / 60
const SPEED = 10
const pack = undeadCrowdPack() as unknown as CrowdPack
const IN_THE_WAY = [8, 12, 16, 20] as const
const BESIDE = [[-3.5, 12], [3.5, 16], [-4, 20]] as const

const sceneOf = async (crowdFirst: boolean) => {
  const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD }) as JoltWorld
  const loop = createPhysicsLoop(world)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, physics: loop })
  const vehicles = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never, three: THREE, vehicles: [MODEL], wrecks: [] })
  const crowdModule = createCrowdTestModule({ pack, locale: 'en', typeName: (type) => UNDEAD_TYPES.find((card) => card.id === type.id)?.id ?? type.id })
  for (const module of crowdFirst ? [crowdModule, vehicles] : [vehicles, crowdModule]) expect(room.loadModule(module as never).problems).toEqual([])
  room.openArea(VEHICLES_AREA_ID)
  room.clear()
  loop.stepFixed(1)
  room.spawn('hatch', [0, 0, -4], 0)
  loop.stepFixed(1)
  const root = [...(vehicles.placed as Map<string, { readonly root: THREE.Object3D }>).values()].find((entry) => entry.root.parent)!.root
  const car = root.userData.physicalCar as PhysicalCar
  for (let frame = 0; frame < 400 && !car.isBuilt(); frame++) loop.stepFixed(1)
  expect(car.isBuilt()).toBe(true)
  return { world, loop, room, crowd: crowdModule.crowd, car }
}

/** The driver's throttle: the car's own wheels have no engine, and its hulls slide to a stop in a second, so the speed is held at `speed` and a hit that slows the car is made up for. */
const drive = (world: JoltWorld, chassis: BodyId, speed: number, velocity: Float64Array): void => {
  world.readVelocity(chassis, velocity, 0)
  if (velocity[2]! < speed) world.setVelocity(chassis, [0, velocity[1]!, speed], [0, 0, 0])
}

describe.each([{ crowdFirst: true }, { crowdFirst: false }])('TS.6: the car on the crowd (crowd module loaded first: $crowdFirst)', ({ crowdFirst }) => {
  it('a car at 10 m/s through the crowd takes down the agents in its way and only them', { timeout: 240000 }, async () => {
    const scene = await sceneOf(crowdFirst)
    const { world, loop, crowd, car } = scene
    expect(CROWD_AREA_ID).toBeTruthy()
    const { store } = crowd
    const lay = (x: number, z: number): number => {
      const i = crowd.spawn(x, z, 0)
      store.height[i] = 1.7
      store.state[i] = STATE.DORMANT
      return store.identity[i]!
    }
    const inTheWay = IN_THE_WAY.map((z) => lay(0, z))
    const beside = BESIDE.map(([x, z]) => ({ identity: lay(x, z), x, z }))
    const pose = new Float64Array(7)
    const velocity = new Float64Array(6)
    for (let step = 0; step < 1200; step++) {
      drive(world, car.chassis()!, SPEED, velocity)
      loop.stepFixed(1)
      crowd.update(STEP, { bandCentre: [0, 0], flowTarget: [0, 0] })
      world.readPose(car.chassis()!, pose, 0)
      if (pose[2]! > 26) break
    }
    expect(pose[2]!).toBeGreaterThan(26)
    const alive = new Map<number, number>()
    for (let i = 0; i < store.n; i++) alive.set(store.identity[i]!, i)
    for (const identity of inTheWay) expect(alive.has(identity)).toBe(false)
    for (const { identity, x, z } of beside) {
      const i = alive.get(identity)!
      expect(i).toBeDefined()
      expect(store.x[i]).toBeCloseTo(x, 3)
      expect(store.z[i]).toBeCloseTo(z, 3)
      expect(store.state[i]).toBe(STATE.DORMANT)
    }
    expect(crowd.stats.kills).toBe(IN_THE_WAY.length)
    console.log(JSON.stringify({ name: 'ts6-run-over', crowdFirst, kills: crowd.stats.kills, carZ: Math.round(pose[2]! * 100) / 100, bystanders: beside.length }))
    scene.room.dispose()
    world.dispose()
  })

  it('a slower car knocks the agent down instead of killing it, and the one beside it stays', { timeout: 240000 }, async () => {
    const scene = await sceneOf(crowdFirst)
    const { world, loop, crowd, car } = scene
    const { store } = crowd
    const lay = (x: number, z: number): number => {
      const i = crowd.spawn(x, z, 0)
      store.height[i] = 1.7
      store.state[i] = STATE.DORMANT
      return store.identity[i]!
    }
    const hit = lay(0, 10)
    // the damage of a knock is by the energy: a body with the hit points to take it is knocked down instead of dying
    store.hp[Array.from({ length: store.n }, (_, i) => store.identity[i]!).indexOf(hit)] = 10000
    const aside = lay(3.5, 10)
    const velocity = new Float64Array(6)
    for (let step = 0; step < 960; step++) {
      drive(world, car.chassis()!, 6, velocity)
      loop.stepFixed(1)
      crowd.update(STEP, { bandCentre: [0, 0], flowTarget: [0, 0] })
    }
    const indexOf = (identity: number): number => Array.from({ length: store.n }, (_, i) => store.identity[i]!).indexOf(identity)
    expect(indexOf(hit)).toBeGreaterThanOrEqual(0)
    expect(store.state[indexOf(hit)]).not.toBe(STATE.DORMANT)
    expect(store.state[indexOf(aside)]).toBe(STATE.DORMANT)
    expect(crowd.stats.kills).toBe(0)
    scene.room.dispose()
    world.dispose()
  })
})
