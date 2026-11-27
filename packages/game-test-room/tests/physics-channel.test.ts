import { describe, expect, it } from 'vitest'

import type { ModuleHost, TestableModule, WorkerCoordinator } from '@adatechnology/game-contracts'
import { KIT_WORLD, createPhysicsLoop, isPhysicsServices } from '@adatechnology/game-physics'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import type { ScenarioContext } from '../src'
import { makeRoom } from './helpers'

const probeModule = (onAttach: (host: ModuleHost) => void): TestableModule<ScenarioContext> => ({
  id: 'physics_probe',
  name: 'Physics probe',
  group: 'Probe',
  items: () => [],
  area: () => ({ placements: [], view: { eye: [0, 2, 4], target: [0, 0, 0] } }),
  attach(host) {
    onAttach(host)
    return () => undefined
  },
})

describe('the physics channel of the host (spec 008, TS.1)', () => {
  it('hands a module the PhysicsServices of the loop that steps the pieces', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ ...KIT_WORLD })
    const loop = createPhysicsLoop(world)
    const room = makeRoom({ physics: loop })
    try {
      let lent: ModuleHost | undefined
      room.loadModule(probeModule((host) => (lent = host)))
      expect(isPhysicsServices(lent?.physics)).toBe(true)
      expect(isPhysicsServices(lent?.physics) && lent.physics.loop).toBe(loop)
      expect(lent?.workers).toBeUndefined()
    } finally {
      room.dispose()
      world.dispose()
    }
  })

  it('leaves physics undefined on a world the page steps itself (a seam)', async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const room = makeRoom({ physics: world })
    let lent: ModuleHost | undefined
    room.loadModule(probeModule((host) => (lent = host)))
    expect(lent?.physics).toBeUndefined()
    room.dispose()
    world.dispose()
  })

  it('hands the workers of the page to the module', () => {
    const workers = { stats: () => ({ workers: 0 }) } as unknown as WorkerCoordinator
    const room = makeRoom({ workers })
    let lent: ModuleHost | undefined
    room.loadModule(probeModule((host) => (lent = host)))
    expect(lent?.workers).toBe(workers)
    room.dispose()
  })
})

const characterCountAt = (world: PhysicsWorld, at: readonly [number, number, number]): number =>
  world.overlapShape({ kind: 'capsule', halfHeight: 0.6, radius: 0.3 }, [at[0], at[1] + 0.9, at[2]], [0, 0, 0, 1], [], { layers: ['agent'] })

const holdKey = (code: string, down: boolean): void => void window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))

describe('the player of the room on the physics loop (spec 008, TS.9h)', () => {
  it('is a walker in the world with the loop and leaves it when the room goes', { timeout: 60000 }, async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ ...KIT_WORLD })
    const loop = createPhysicsLoop(world)
    const room = makeRoom({ physics: loop })
    try {
      room.look([0, 1.7, 4], [0, 1.7, -10])
      loop.stepFixed(2)
      expect(characterCountAt(world, room.playerPosition)).toBe(1)
      holdKey('KeyW', true)
      for (let frame = 0; frame < 60; frame++) room.update(1 / 60, { live: true })
      holdKey('KeyW', false)
      expect(room.playerPosition[2]).toBeLessThan(4 - 2.5)
      expect(room.playerPosition[2]).toBeGreaterThan(4 - 4)
      expect(characterCountAt(world, room.playerPosition)).toBe(1)
      const at = room.playerPosition
      room.dispose()
      expect(characterCountAt(world, at)).toBe(0)
    } finally {
      world.dispose()
    }
  })

  it('walks by itself on a seam: no walker, the position is the colliders and the keys', async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const room = makeRoom({ physics: world })
    room.look([0, 1.7, 4], [0, 1.7, -10])
    holdKey('KeyW', true)
    for (let frame = 0; frame < 60; frame++) room.update(1 / 60, { live: true })
    holdKey('KeyW', false)
    expect(room.playerPosition[2]).toBeCloseTo(4 - 3.4, 1)
    room.dispose()
    world.dispose()
  })
})
