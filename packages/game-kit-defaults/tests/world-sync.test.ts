// @vitest-environment happy-dom
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAudioEngine } from '@adatechnology/game-audio'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { TerrainBlowResult } from '@adatechnology/game-terrain'

import { createKitWorldSync } from '../src/world'
import type { KitWorld, KitWorldSyncOptions } from '../src/world'
import { makeWorld, stubRenderer } from './world-helpers'

const worlds: KitWorld[] = []
const joltEngine = await createJoltEngine()
const seamWorlds: PhysicsWorld[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const world of worlds.splice(0)) world.dispose()
  for (const world of seamWorlds.splice(0)) world.dispose()
})

/** A world the host steps itself: the cheapest physics a synchronous host takes. */
const newSeamWorld = (): PhysicsWorld => {
  const world = joltEngine.createWorld(KIT_WORLD)
  seamWorlds.push(world)
  return world
}

const makeSyncWorld = (extra: Partial<KitWorldSyncOptions> = {}): KitWorld => {
  const world = createKitWorldSync(THREE, { container: document.createElement('div'), renderer: stubRenderer(), bounds: [-8, -8, 8, 8], physics: extra.physics ?? newSeamWorld(), workers: 0, audio: false, ...extra })
  worlds.push(world)
  return world
}

describe('the world made at once', () => {
  it('schedules the same systems as the world that waits for its physics', async () => {
    const world = makeSyncWorld()
    const waited = await makeWorld({ audio: false })
    expect(world.frame.systems()).toEqual(waited.frame.systems())
    expect(world.info.physics.kind).toBe('seam')
    expect(world.frame.tick).toBeCloseTo(1 / 60, 12)
  })

  it('steps a loop of the game at two of its steps a tick, and hands a seam to the pieces without stepping it', async () => {
    const engine = await createJoltEngine()
    const joltWorld = engine.createWorld(KIT_WORLD)
    // a world has one loop at most: the seam is another world
    const seamWorld = engine.createWorld(KIT_WORLD)
    try {
      const loop = createPhysicsLoop(joltWorld)
      const looped = makeSyncWorld({ physics: loop })
      expect(looped.info.physics.kind).toBe('loop')
      expect(looped.physics.loop).toBe(loop)
      expect(looped.frame.tick).toBeCloseTo(2 * loop.world.fixedStep, 12)
      looped.dispose()
      const seamed = makeSyncWorld({ physics: seamWorld })
      expect(seamed.info.physics.kind).toBe('seam')
      expect(seamed.physics.loop).toBeNull()
      expect(seamed.physics.pieces).toBe(seamWorld)
    } finally {
      for (const world of worlds.splice(0)) world.dispose()
      joltWorld.dispose()
      seamWorld.dispose()
    }
  })
})

describe('a seam of the game on the world that waits', () => {
  it('is handed to the pieces, with no second engine loaded, although a Jolt world says engine jolt', async () => {
    const engine = await createJoltEngine()
    const seamWorld = engine.createWorld(KIT_WORLD)
    try {
      const world = await makeWorld({ physics: seamWorld })
      expect(world.info.physics.kind).toBe('seam')
      expect(world.physics.engine).toBeNull()
      expect(world.physics.loop).toBeNull()
      expect(world.physics.pieces).toBe(seamWorld)
      world.dispose()
    } finally {
      seamWorld.dispose()
    }
  })
})

describe('the sound of a world', () => {
  it('tells the game every key even when the world is silent', () => {
    const onSound = vi.fn()
    const world = makeSyncWorld({ onSound })
    world.sound.play('impact_concrete', [1, 0, 2], 0.5)
    expect(world.sound.audio).toBeNull()
    expect(onSound).toHaveBeenCalledWith('impact_concrete', [1, 0, 2], 0.5)
  })

  it('loads on an engine of the game given with the options and leaves it standing', () => {
    const engine = createAudioEngine({ deferredStart: {} })
    const disposeEngine = vi.spyOn(engine, 'dispose')
    const world = makeSyncWorld({ audio: { engine, samplesBaseUrl: null, userSamplesBaseUrl: null } })
    expect(world.sound.audio).toBe(engine)
    world.dispose()
    expect(disposeEngine).not.toHaveBeenCalled()
    engine.dispose()
  })
})

describe('the ground', () => {
  it('shows a blow the game applied itself: debris and the impact sound', () => {
    const onSound = vi.fn()
    const world = makeSyncWorld({ onSound })
    const emit = vi.spyOn(world.destruction.renderer, 'emit')
    const material = world.ground.terrain.columnAt(0, 0).material
    const result = { point: [0, 0, 0], radius: 0.1, depth: 0.01, totalDepth: 0.01, removed: [{ material, volume: 0.001 }], exposed: material, atLimit: false } as unknown as TerrainBlowResult
    world.ground.showBlow(result)
    expect(emit).toHaveBeenCalled()
    expect(onSound).toHaveBeenCalled()
  })

  it('takes the fire clock back to zero and leaves the layout as it is', () => {
    const world = makeSyncWorld()
    const burning = vi.spyOn(world.ground.terrain, 'burningPoints')
    const setLayout = vi.spyOn(world.ground.terrain, 'setLayout')
    world.ground.showFire(0.2)
    world.ground.resetFire()
    world.ground.showFire(0.2)
    expect(burning).not.toHaveBeenCalled()
    world.ground.showFire(0.2)
    expect(burning).toHaveBeenCalledTimes(1)
    expect(setLayout).not.toHaveBeenCalled()
  })
})

describe('what a host reads back', () => {
  it('names the film stream and whether its loop runs', () => {
    const world = makeSyncWorld()
    expect(world.liquids.filmRandom.seed).toBe(1)
    expect(world.isLooping).toBe(false)
    const stop = world.start({ render: false })
    expect(world.isLooping).toBe(true)
    stop()
    expect(world.isLooping).toBe(false)
  })
})
