// @vitest-environment happy-dom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'
import { createTestRoom } from '@adatechnology/game-test-room'

import { VEHICLES_AREA_ID, createVehiclesTestModule } from '../src'
import type { PhysicalCar } from '../src/test-area/physical-car'
import { defaultVehicleFleet } from './default-fleet'
import { fakeDocument } from './fake-dom'
import { stubRenderer } from './vehicles-room'

/**
 * A vehicle set down in the room on the engine (Jolt) rests where it is drawn: on its tyres, skids or landing gear, level, nothing of it under the floor, nothing lost.
 * One model of each way a vehicle stands that went wrong: a whole axle as one tyre part (the bus), a side of six wheels as one part (the 6x6), the skids of a helicopter
 * and the tricycle gear of a plane, whose centre of mass was read in the model's axes instead of the chassis frame's and lay over the tail, and tyres drawn
 * below the root (the troop truck), which started inside the floor.
 */
const MODELS = ['compact_hatch', 'city_bus', 'apc_6x6', 'troop_truck', 'armored_truck', 'trainer_helicopter', 'attack_helicopter', 'single_engine_plane'] as const
/** Steps of the fixed loop the vehicle is left to rest (KIT_WORLD steps at 120 Hz: six seconds). */
const REST_STEPS = 720
/** The most it may lean (rad: a helicopter settles a degree or two on skids drawn a little off level) and how far its lowest drawn vertex may be off the floor (m): a tyre squashes a few centimetres. */
const MAX_TILT_RAD = 0.05
const MAX_SINK_M = 0.05
const MAX_FLOAT_M = 0.05

const engine = await createJoltEngine()

const lowestDrawnOf = (root: THREE.Object3D): number => {
  root.updateMatrixWorld(true)
  const vertex = new THREE.Vector3()
  let lowest = Infinity
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh || String(mesh.name).startsWith('batch:')) return
    for (let at: THREE.Object3D | null = mesh; at; at = at.parent) if (!at.visible) return
    const position = mesh.geometry.getAttribute('position')
    for (let index = 0; index < position.count; index++) lowest = Math.min(lowest, vertex.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld).y)
  })
  return lowest
}

interface Rest {
  readonly tilt: number
  readonly lowest: number
  readonly lowestOverRest: number
  readonly released: number
  readonly isSleeping: boolean
}

const restOf = (model: string): Rest => {
  const world = engine.createWorld({ ...KIT_WORLD }) as JoltWorld
  const loop = createPhysicsLoop(world)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, physics: loop })
  try {
    const module = createVehiclesTestModule({ fleet: defaultVehicleFleet(), locale: 'en', document: fakeDocument as never, three: THREE, vehicles: [model], wrecks: [] })
    expect(room.loadModule(module as never).problems).toEqual([])
    room.openArea(VEHICLES_AREA_ID)
    room.clear()
    loop.stepFixed(1)
    const [item] = module.items('en')
    room.spawn(item!.id, [0, 0, -4], 0)
    loop.stepFixed(1)
    const root = [...(module.placed as Map<string, { readonly root: THREE.Object3D }>).values()].find((entry) => entry.root.parent)!.root
    const car = root.userData.physicalCar as PhysicalCar
    // from the first step on, while the hulls are still being made too: the drawing stands on the floor before the chassis exists
    let lowestOverRest = lowestDrawnOf(root)
    for (let step = 0; step < 400 && !car.isBuilt(); step++) {
      loop.stepFixed(1)
      lowestOverRest = Math.min(lowestOverRest, lowestDrawnOf(root))
    }
    expect(car.isBuilt()).toBe(true)
    for (let step = 0; step < REST_STEPS; step++) {
      loop.stepFixed(1)
      if (step % 10 === 0) lowestOverRest = Math.min(lowestOverRest, lowestDrawnOf(root))
    }
    const turn = new THREE.Euler().setFromQuaternion(root.getWorldQuaternion(new THREE.Quaternion()), 'YXZ')
    return { tilt: Math.max(Math.abs(turn.x), Math.abs(turn.z)), lowest: lowestDrawnOf(root), lowestOverRest, released: car.parts()!.stats().released, isSleeping: world.isSleeping(car.chassis()!) }
  } finally {
    room.dispose()
    world.dispose()
  }
}

describe('a vehicle set down on the engine rests on what it stands on', () => {
  for (const model of MODELS) {
    it(`${model} stays level, on the floor, whole and asleep`, () => {
      const rest = restOf(model)
      expect(rest.tilt).toBeLessThan(MAX_TILT_RAD)
      expect(rest.lowestOverRest).toBeGreaterThan(-MAX_SINK_M)
      expect(rest.lowest).toBeLessThan(MAX_FLOAT_M)
      expect(rest.released).toBe(0)
      expect(rest.isSleeping).toBe(true)
    }, 240000)
  }
})
