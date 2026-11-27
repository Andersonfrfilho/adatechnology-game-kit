import * as THREE_NS from 'three'
import { describe, expect, it } from 'vitest'

import type { TestableItem } from '@adatechnology/game-contracts'
import { createMainThreadGroundPort } from '@adatechnology/game-destruction-three'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { BodyId, BodyDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'

import { buildFromSpec } from '../src/build-from-spec'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

/**
 * Spec 008, TS.1b: the room as production makes it (Jolt, no floor made by hand), the ground under whatever the engine moves that the pieces do not own. Without it a body
 * or a character made where no piece has been falls through the world.
 */

const CAR_HALF: [number, number, number] = [0.9, 0.7, 2.25]
const CAR_MASS = 1200
const WALL_HALF = [6, 1.5, 0.2] as const

const wall: TestableItem = {
  id: 'long_wall',
  name: 'Long wall',
  build: (T: unknown) => buildFromSpec(T as typeof THREE_NS, { name: 'Long wall', parts: [{ id: 'body', material: 'concrete', shape: { kind: 'box', size: [WALL_HALF[0] * 2, WALL_HALF[1] * 2, WALL_HALF[2] * 2] }, position: [0, WALL_HALF[1], 0] }] }),
}

const sceneOf = async (withWorker: boolean) => {
  const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD }) as JoltWorld
  const loop = createPhysicsLoop(world)
  const room = makeRoom({ physics: loop, catalog: demoItems('en', []), ...(withWorker ? { debris: { groundWorker: createMainThreadGroundPort() } } : {}) })
  loop.stepFixed(1)
  const pose = new Float64Array(7)
  const velocity = new Float64Array(6)
  const carAt = (x: number, z: number, vz: number): BodyId => {
    const desc: BodyDesc = { shape: { kind: 'box', half: CAR_HALF }, motion: 'dynamic', mass: CAR_MASS, layer: 'vehicle', position: [x, CAR_HALF[1] + 0.02, z], user: 0 }
    const id = world.createBody(desc)
    world.setVelocity(id, [0, 0, vz], [0, 0, 0])
    return id
  }
  const dispose = (): void => {
    room.dispose()
    world.dispose()
  }
  return { world, loop, room, pose, velocity, carAt, dispose }
}

describe.each([{ withWorker: false }, { withWorker: true }])('the ground follows the bodies of the world (ground worker $withWorker)', ({ withWorker }) => {
  it('a sphere let go far from any piece falls on ground and sleeps on it within 3 s', async () => {
    const { world, loop, pose, dispose } = await sceneOf(withWorker)
    const id = world.createBody({ shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', mass: 1, layer: 'debris', position: [300, 1, 300], user: 0 })
    const steps = Math.round(3 / world.fixedStep)
    for (let i = 0; i < steps && !world.isSleeping(id); i++) loop.stepFixed(1)
    world.readPose(id, pose, 0)
    expect(world.isSleeping(id)).toBe(true)
    expect(Math.abs((pose[1] as number) - 0.1)).toBeLessThanOrEqual(0.01)
    dispose()
  }, 60000)

  it('a car-sized box at 30 m/s over 60 m never goes more than 5 cm under the ground and ends resting on it', async () => {
    const { world, loop, pose, carAt, dispose } = await sceneOf(withWorker)
    const id = carAt(0, 200, -30)
    let lowest = Infinity
    let travelled = 0
    for (let step = 0; step < 600 && travelled < 60; step++) {
      // driven: the speed is held, as a car's engine does against the road's drag
      world.setVelocity(id, [0, 0, -30], [0, 0, 0])
      loop.stepFixed(1)
      world.readPose(id, pose, 0)
      lowest = Math.min(lowest, (pose[1] as number) - CAR_HALF[1])
      travelled = 200 - (pose[2] as number)
    }
    expect(travelled).toBeGreaterThanOrEqual(60)
    for (let step = 0; step < 2400 && !world.isSleeping(id); step++) {
      loop.stepFixed(1)
      world.readPose(id, pose, 0)
      lowest = Math.min(lowest, (pose[1] as number) - CAR_HALF[1])
    }
    expect(lowest).toBeGreaterThanOrEqual(-0.05)
    expect(world.isSleeping(id)).toBe(true)
    expect(Math.abs((pose[1] as number) - CAR_HALF[1])).toBeLessThanOrEqual(0.03)
    dispose()
  }, 120000)

  it('a character made in a new place stands on ground within 1 s', async () => {
    const { world, loop, dispose } = await sceneOf(withWorker)
    const id = world.createCharacter({ halfHeight: 0.5, radius: 0.3, mass: 80, strength: 100, position: [-400, 0.3, 700] })
    let supportedAt = -1
    for (let step = 0; step < Math.round(1 / world.fixedStep) && supportedAt < 0; step++) {
      world.moveCharacter(id, 0, 0, world.fixedStep)
      loop.stepFixed(1)
      if (world.characterSupported(id)) supportedAt = step
    }
    expect(supportedAt).toBeGreaterThanOrEqual(0)
    dispose()
  }, 60000)

  it('a car at 30 m/s does not go through a wall of the room', async () => {
    const { world, loop, room, pose, carAt, dispose } = await sceneOf(withWorker)
    room.loadModule({ id: 'wall_test', name: 'Wall test', group: 'Wall test', items: () => [wall], area: () => ({ placements: [{ item: 'long_wall', position: [0, 0, 0], fixed: true }] }) })
    room.openArea('wall_test')
    for (let i = 0; i < 120; i++) room.update(1 / 60)
    const id = carAt(0, 40, -30)
    let nearest = Infinity
    for (let step = 0; step < 600; step++) {
      loop.stepFixed(1)
      world.readPose(id, pose, 0)
      nearest = Math.min(nearest, (pose[2] as number) - CAR_HALF[2])
    }
    expect(nearest).toBeGreaterThan(WALL_HALF[2] - 0.05)
    expect(pose[2] as number).toBeGreaterThan(0)
    dispose()
  }, 120000)
})
