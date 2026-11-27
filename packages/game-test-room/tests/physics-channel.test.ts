import { describe, expect, it } from 'vitest'

import type { ModuleHost, TestableModule, WorkerCoordinator } from '@adatechnology/game-contracts'
import { KIT_WORLD, createPhysicsLoop, isPhysicsServices } from '@adatechnology/game-physics'
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

  it('leaves physics undefined on the kit own solver', () => {
    const room = makeRoom({ physics: 'own' })
    let lent: ModuleHost | undefined
    room.loadModule(probeModule((host) => (lent = host)))
    expect(lent?.physics).toBeUndefined()
    room.dispose()
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
