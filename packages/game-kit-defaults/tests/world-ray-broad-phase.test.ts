// @vitest-environment happy-dom
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { createKitWorldSync } from '../src/world'
import type { KitWorld } from '../src/world'
import { stubRenderer } from './world-helpers'

const worlds: KitWorld[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const world of worlds.splice(0)) world.dispose()
})

describe('the rays broad phase', () => {
  const makeWith = (physics: 'own' | ReturnType<typeof createPhysicsLoop>, debris?: { readonly rayBroadPhase?: boolean }): { readonly world: KitWorld; readonly setRayBroadPhase: ReturnType<typeof vi.spyOn> } => {
    const destruction = createDestruction({ seed: 1, materials: [] })
    const setRayBroadPhase = vi.spyOn(destruction, 'setRayBroadPhase')
    const world = createKitWorldSync(THREE, { container: document.createElement('div'), renderer: stubRenderer(), bounds: [-8, -8, 8, 8], physics, workers: 0, audio: false, world: destruction, ...(debris ? { debris } : {}) })
    worlds.push(world)
    return { world, setRayBroadPhase }
  }

  it('is on when a loop steps the pieces, and off with the kit own solver or when the game says false', async () => {
    const engine = await createJoltEngine()
    const first = engine.createWorld(KIT_WORLD)
    const second = engine.createWorld(KIT_WORLD)
    try {
      expect(makeWith(createPhysicsLoop(first)).setRayBroadPhase).toHaveBeenCalledWith(expect.anything())
      expect(makeWith('own').setRayBroadPhase).not.toHaveBeenCalled()
      expect(makeWith(createPhysicsLoop(second), { rayBroadPhase: false }).setRayBroadPhase).not.toHaveBeenCalled()
    } finally {
      for (const world of worlds.splice(0)) world.dispose()
      first.dispose()
      second.dispose()
    }
  })
})
