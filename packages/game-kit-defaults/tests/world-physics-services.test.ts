// @vitest-environment happy-dom
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { KIT_WORLD, createPhysicsLoop, isPhysicsServices } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createKitWorldSync, physicsHostOf } from '../src/world'
import type { KitWorld, KitWorldPhysics } from '../src/world'
import { servicesOf } from '../src/world/physics-services'
import { stubRenderer } from './world-helpers'

const worlds: KitWorld[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const world of worlds.splice(0)) world.dispose()
})

describe('the physics services of the world', () => {
  it('are made with a loop and handed to a module through the host', async () => {
    const engine = await createJoltEngine()
    const joltWorld = engine.createWorld(KIT_WORLD)
    try {
      const loop = createPhysicsLoop(joltWorld)
      const world = createKitWorldSync(THREE, { container: document.createElement('div'), renderer: stubRenderer(), bounds: [-8, -8, 8, 8], physics: loop, workers: 0, audio: false })
      worlds.push(world)
      const { services } = world.physics
      expect(isPhysicsServices(services)).toBe(true)
      expect(services?.loop).toBe(loop)
      expect(physicsHostOf(world).physics).toBe(services)
      expect(world.destruction.renderer).toBeDefined()
    } finally {
      for (const world of worlds.splice(0)) world.dispose()
      joltWorld.dispose()
    }
  })

  it('are left out on a world the game steps itself (a seam), and the host says so', async () => {
    const seamWorld = (await createJoltEngine()).createWorld(KIT_WORLD)
    try {
      const world = createKitWorldSync(THREE, { container: document.createElement('div'), renderer: stubRenderer(), bounds: [-8, -8, 8, 8], physics: seamWorld, workers: 0, audio: false })
      worlds.push(world)
      expect(world.physics.services).toBeUndefined()
      expect(physicsHostOf(world)).toEqual({})
    } finally {
      for (const world of worlds.splice(0)) world.dispose()
      seamWorld.dispose()
    }
  })

  it('are released before the world they were made in', async () => {
    const engine = await createJoltEngine()
    const joltWorld = engine.createWorld(KIT_WORLD)
    try {
      const order: string[] = []
      const loop = createPhysicsLoop(joltWorld)
      const physics = servicesOf<Omit<KitWorldPhysics, 'services'>>({ loop, pieces: loop, engine: null, info: { kind: 'loop' }, dispose: () => void order.push('world') })
      const { services } = physics
      expect(services).toBeDefined()
      const corpses = services!.corpses()
      expect(services!.corpses()).toBe(corpses)
      const dispose = vi.spyOn(corpses, 'dispose').mockImplementation(() => void order.push('services'))
      physics.dispose()
      expect(dispose).toHaveBeenCalledTimes(1)
      expect(order).toEqual(['services', 'world'])
    } finally {
      joltWorld.dispose()
    }
  })

  it('hand the workers of the game to the module beside the physics', async () => {
    const workers = { stats: () => ({ workers: 0 }) } as never
    const seamWorld = (await createJoltEngine()).createWorld(KIT_WORLD)
    try {
      const world = createKitWorldSync(THREE, { container: document.createElement('div'), renderer: stubRenderer(), bounds: [-8, -8, 8, 8], physics: seamWorld, workers: 0, audio: false })
      worlds.push(world)
      expect(physicsHostOf(world, workers)).toEqual({ workers })
    } finally {
      for (const world of worlds.splice(0)) world.dispose()
      seamWorld.dispose()
    }
  })
})
