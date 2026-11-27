import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { kitOriginOf } from '@adatechnology/game-contracts'
import type { TestableModule } from '@adatechnology/game-contracts'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { BodyId, Layer, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { createArsenal } from '@adatechnology/game-weapons'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { projectileModel } from '../src/projectile-model'
import { createWeaponsTestModule } from '../src'

/** Spec 008, TS.5: the casings of the weapons module and the grenade are bodies of the room's world only when the room was given one; with its own solver no body is born. */

const STEP = 1 / 60
const MOVING_LAYERS: readonly Layer[] = ['debris', 'prop', 'character', 'agent', 'vehicle', 'corpse']
const SHOTS = 8

const stubRenderer = (): THREE.WebGLRenderer =>
  ({ domElement: document.createElement('canvas'), shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined }) as unknown as THREE.WebGLRenderer

const movingIds = (world: PhysicsWorld): BodyId[] => {
  const found: BodyId[] = []
  world.overlapShape({ kind: 'box', half: [500, 200, 500] }, [0, 0, 0], [0, 0, 0, 1], found, { layers: MOVING_LAYERS })
  return found
}

type Probe = { physics: unknown; attached: boolean }

const roomOf = (options: { physics?: ReturnType<typeof createPhysicsLoop> | 'own' } = {}) => {
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal, projectileModel: (query) => projectileModel(THREE, query), ...(options.physics ? { physics: options.physics } : {}) })
  const weapons = createWeaponsTestModule({ locale: 'en', sound: false, arsenal })
  expect(room.loadModule(weapons).problems).toEqual([])
  const probe: Probe = { physics: undefined, attached: false }
  const spy: TestableModule = { id: 'probe', name: 'probe', group: 'probe', items: () => [], attach: (lent) => ((probe.physics = lent.physics), (probe.attached = true), () => undefined) }
  room.loadModule(spy)
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return { room, weapons, probe }
}

const step = (room: TestRoom, frames: number): void => {
  for (let frame = 0; frame < frames; frame++) room.update(STEP)
}

const fire = (room: TestRoom): void => {
  room.setTool('glock_17')
  step(room, 40)
  for (let shot = 0; shot < SHOTS; shot++) {
    room.use()
    step(room, 8)
  }
}

describe('the casings of the room in the engine (spec 008, TS.5)', () => {
  it('fall, never go under the ground, sleep on it, and leave the world when the room is cleared', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const { room, weapons } = roomOf({ physics: createPhysicsLoop(world) })
    const pose = new Float64Array(7)
    fire(room)
    const casings = movingIds(world)
    expect(casings.length).toBeGreaterThanOrEqual(3)
    expect(weapons.fx?.casings).toBe(casings.length)
    let lowest = Infinity
    for (let frame = 0; frame < 8 * 60 && !casings.every((id) => world.isSleeping(id)); frame++) {
      room.update(STEP)
      for (const id of casings) {
        world.readPose(id, pose, 0)
        lowest = Math.min(lowest, pose[1] ?? 0)
      }
    }
    expect(casings.every((id) => world.isSleeping(id))).toBe(true)
    // a 9 mm case lies on its side: its centre rests at its radius over the ground, and none went through it
    expect(lowest).toBeGreaterThanOrEqual(-0.005)
    for (const id of casings) {
      world.readPose(id, pose, 0)
      expect(pose[1]).toBeLessThanOrEqual(0.03)
    }
    console.info(`[TS.5] casings ${JSON.stringify({ count: casings.length, lowest })}`)
    room.clear()
    step(room, 2)
    expect(movingIds(world)).toEqual([])
    expect(weapons.fx?.casings).toBe(0)
    room.dispose()
    expect(movingIds(world)).toEqual([])
    world.dispose()
  })
})

describe('a room without an engine makes no body (spec 008, TS.5)', () => {
  for (const physics of ['own', undefined] as const) {
    it(`${physics === undefined ? 'no physics option' : "physics 'own'"}: the module is lent no world, and the casings and the grenade still fly`, () => {
      const { room, weapons, probe } = roomOf(physics ? { physics } : {})
      expect(probe.attached).toBe(true)
      expect(probe.physics).toBeUndefined()
      fire(room)
      expect(weapons.fx?.casings).toBeGreaterThan(0)
      room.setTool('frag_grenade')
      step(room, 40)
      room.use()
      let grenade: THREE.Object3D | undefined
      for (let frame = 0; frame < 120 && !grenade; frame++) {
        room.update(STEP)
        room.scene.traverse((object) => {
          if (!grenade && kitOriginOf(object)?.kind === 'explosive') grenade = object
        })
      }
      expect(grenade).toBeDefined()
      room.clear()
      expect(weapons.fx?.casings).toBe(0)
      room.dispose()
    })
  }
})
