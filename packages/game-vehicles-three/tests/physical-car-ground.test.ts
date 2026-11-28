// @vitest-environment happy-dom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'
import { createTestRoom } from '@adatechnology/game-test-room'

import { VEHICLES_AREA_ID, createVehiclesTestModule } from '../src'
import { bodyMassOf } from '../src/crash-parts-math'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'
import { framePartsOf } from '../src/test-area/physical-car'
import type { PhysicalCar } from '../src/test-area/physical-car'
import { defaultVehicleFleet } from './default-fleet'
import { fakeDocument } from './fake-dom'
import { stubRenderer } from './vehicles-room'

/** Spec 008, TS.1b: the room car of a room made as production makes it, with no floor made by hand: the engine's ground follows the chassis. */

const MODEL = 'compact_hatch'

describe('TS.1b: the room car has ground under it without a floor made by hand', () => {
  it('is made, settles at the height it is drawn and sleeps, in a world that had no fixed body', async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD }) as JoltWorld
    const loop = createPhysicsLoop(world)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, physics: loop })
    const module = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never, three: THREE, vehicles: [MODEL], wrecks: [] })
    expect(room.loadModule(module as never).problems).toEqual([])
    room.openArea(VEHICLES_AREA_ID)
    room.clear()
    loop.stepFixed(1)
    room.spawn('hatch', [0, 0, -4], 0)
    loop.stepFixed(1)
    const root = [...(module.placed as Map<string, { readonly root: THREE.Object3D }>).values()].find((entry) => entry.root.parent)!.root
    const car = root.userData.physicalCar as PhysicalCar
    for (let frame = 0; frame < 400 && !car.isBuilt(); frame++) loop.stepFixed(1)
    expect(car.isBuilt()).toBe(true)
    const centre = bodyMassOf(framePartsOf(THREE, root.userData.destructible as VehicleDestructible, root)).centre
    const drawn = root.localToWorld(new THREE.Vector3(...centre)).y
    for (let step = 0; step < 600 && !world.isSleeping(car.chassis()!); step++) loop.stepFixed(1)
    expect(world.isSleeping(car.chassis()!)).toBe(true)
    expect(Math.abs(root.localToWorld(new THREE.Vector3(...centre)).y - drawn)).toBeLessThanOrEqual(0.02)
    room.dispose()
    world.dispose()
  }, 240000)
})
