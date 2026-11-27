// @vitest-environment happy-dom
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import type { Crowd, CrowdPack } from '@adatechnology/game-crowd'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { BodyId, Quat } from '@adatechnology/game-physics'
import { AWAKE_BOUNDS_STRIDE } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'
import { createTestRoom } from '@adatechnology/game-test-room'

import { CROWD_AREA_ID, createCrowdTestModule } from '../src'
import type { CrowdTestModuleOptions } from '../src'

/**
 * Spec 008, TS.6: the room's crowd module on the engine loop, in a room made as production makes it (Jolt, no floor made by hand): the agents are kinematic
 * capsules, the closed doors leaves on a hinge that gives way, and everything goes when the module detaches.
 */

const pack = undeadCrowdPack() as unknown as CrowdPack
const STEP = 1 / 60
const WIDE: [number, number, number] = [800, 60, 800]
const NO_TURN: Quat = [0, 0, 0, 1]

const stubRenderer = (): never => {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as never
}

const moduleOptions = (extra: Partial<CrowdTestModuleOptions> = {}): CrowdTestModuleOptions => ({ pack, locale: 'en', typeName: (type) => UNDEAD_TYPES.find((card) => card.id === type.id)?.id ?? type.id, ...extra })

const sceneOf = async (physics: 'jolt' | 'own', extra: Partial<CrowdTestModuleOptions> = {}) => {
  const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD }) as JoltWorld
  const loop = createPhysicsLoop(world)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, physics: physics === 'jolt' ? loop : 'own' })
  const countOn = (layer: 'agent' | 'prop'): number => world.overlapShape({ kind: 'box', half: WIDE }, [0, 0, 0], NO_TURN, [] as BodyId[], { layers: [layer] })
  // the player is a body of the room's world (a capsule shadow in `agent`): the crowd's counts add it explicitly instead of hiding it
  const playerBodies = physics === 'jolt' ? countOn('agent') : 0
  const module = createCrowdTestModule(moduleOptions(extra))
  expect(room.loadModule(module as never).problems).toEqual([])
  room.openArea(CROWD_AREA_ID)
  loop.stepFixed(1)
  return { world, loop, room, module, countOn, playerBodies }
}

/** The state-hash of the crowd: every per-agent array of the store (the first `n` agents) and the physics counters, FNV-1a. */
const hashCrowd = (crowd: Crowd): string => {
  const { store } = crowd
  let hash = 0x811c9dc5
  const feed = (bytes: Uint8Array): void => {
    for (let k = 0; k < bytes.length; k++) hash = Math.imul(hash ^ bytes[k]!, 0x01000193) >>> 0
  }
  for (const key of Object.keys(store).sort()) {
    const value = (store as unknown as Record<string, unknown>)[key]
    if (!ArrayBuffer.isView(value)) continue
    const typed = value as unknown as Uint8Array & { BYTES_PER_ELEMENT: number }
    const perAgent = key === 'armHp' || key === 'legHp' ? 2 : 1
    feed(new Uint8Array(typed.buffer, typed.byteOffset, store.n * perAgent * typed.BYTES_PER_ELEMENT))
  }
  feed(new TextEncoder().encode(JSON.stringify([store.n, crowd.stats.physics])))
  return hash.toString(16)
}

describe('TS.6: the crowd module in the engine loop', () => {
  it('the agents are capsules of the world, follow the store, and agents pressing a door off its hinge break it for the crowd, with the leaf landing on ground', { timeout: 240000 }, async () => {
    const scene = await sceneOf('jolt')
    const { world, loop, module, countOn, playerBodies } = scene
    const { crowd } = module
    expect(countOn('agent')).toBe(playerBodies)
    expect(countOn('prop')).toBe(0)
    const door = crowd.doors.add(0, 0, 'x', 1.2)
    const columns = 40
    const agents = 240
    for (let k = 0; k < agents; k++) {
      const i = crowd.spawn(((k % columns) - columns / 2) * 0.6, 3 + Math.floor(k / columns) * 0.6, 0)
      crowd.store.height[i] = 1.7
    }
    loop.stepFixed(2)
    expect(countOn('agent')).toBe(playerBodies + agents)
    expect(countOn('prop')).toBe(1)
    // game-crowd's walk, simplified: toward the doorway, held at the wall line unless in the doorway, where they press on into the leaf
    const { store } = crowd
    let brokeAt = -1
    for (let frame = 0; frame < 900 && brokeAt < 0; frame++) {
      for (let i = 0; i < store.n; i++) {
        const dx = -store.x[i]!
        const dz = -store.z[i]!
        const distance = Math.hypot(dx, dz) || 1
        store.x[i] = store.x[i]! + (dx / distance) * 1.2 * world.fixedStep
        store.z[i] = Math.max(Math.abs(store.x[i]!) < 0.6 ? 0.1 : 0.3, store.z[i]! + (dz / distance) * 1.2 * world.fixedStep)
      }
      loop.stepFixed(1)
      if (crowd.doors.list[door]!.broken) brokeAt = (frame + 1) * world.fixedStep
    }
    expect(brokeAt).toBeGreaterThan(0)
    expect(crowd.doors.list[door]!.open).toBe(true)
    // the leaf the hinge let go of is a loose body now: the ground follows it and it comes to rest on the floor
    const rows = new Float64Array(AWAKE_BOUNDS_STRIDE * 64)
    let lowest = Infinity
    for (let frame = 0; frame < 480; frame++) {
      loop.stepFixed(1)
      const count = world.readAwakeBounds(rows)
      for (let row = 0; row < Math.min(count, 64); row++) {
        const at = row * AWAKE_BOUNDS_STRIDE
        if (Math.abs(rows[at + 2]!) < 1.5 && Math.abs(rows[at + 4]!) < 1.5) lowest = Math.min(lowest, rows[at + 3]!)
      }
    }
    console.log(JSON.stringify({ name: 'ts6-door', brokeAtS: Math.round(brokeAt * 1000) / 1000, leafLowestY: Math.round(lowest * 1000) / 1000, agents: countOn('agent') - playerBodies }))
    expect(lowest).toBeGreaterThanOrEqual(-0.05)
    scene.room.dispose()
    world.dispose()
  })

  it('detach leaves the world without a body of the crowd', async () => {
    const scene = await sceneOf('jolt', { startCount: 80 })
    const { world, loop, module, countOn, playerBodies } = scene
    module.crowd.doors.add(6, 0, 'z', 1)
    loop.stepFixed(3)
    expect(countOn('agent')).toBe(playerBodies + 80)
    expect(countOn('prop')).toBe(1)
    scene.room.dispose()
    loop.stepFixed(1)
    expect(countOn('agent')).toBe(0)
    expect(countOn('prop')).toBe(0)
    world.dispose()
  })

  it('a cleared room makes the bodies again, none left over', async () => {
    const scene = await sceneOf('jolt', { startCount: 30 })
    const { world, loop, module, countOn, playerBodies } = scene
    loop.stepFixed(2)
    expect(countOn('agent')).toBe(playerBodies + 30)
    scene.room.clear()
    loop.stepFixed(2)
    expect(countOn('agent')).toBe(playerBodies + 30)
    expect(module.crowd.store.n).toBe(30)
    scene.room.dispose()
    world.dispose()
  })

  it('on the own solver the module makes no body of its own', async () => {
    const scene = await sceneOf('own', { startCount: 40 })
    scene.module.crowd.doors.add(0, 0, 'x', 1.2)
    scene.loop.stepFixed(5)
    expect(scene.world.bodyCount).toBe(0)
    scene.room.dispose()
    scene.world.dispose()
  })

  it('with the horde in a thread the page keeps no capsules', async () => {
    const scene = await sceneOf('jolt', { startCount: 40, hordeThread: () => null })
    scene.loop.stepFixed(5)
    expect(scene.countOn('agent')).toBe(scene.playerBodies)
    scene.room.dispose()
    scene.world.dispose()
  })

  it('the state-hash of the horde is the same as on the own solver when nothing pushes a body', { timeout: 240000 }, async () => {
    const run = async (physics: 'jolt' | 'own'): Promise<{ hash: string; agents: number }> => {
      const scene = await sceneOf(physics, { startCount: 120, seed: 4 })
      const { crowd } = scene.module
      for (let step = 0; step < 300; step++) {
        if (physics === 'jolt') scene.loop.stepFixed(1)
        crowd.update(STEP, { bandCentre: [0, 0], flowTarget: [0, 0] })
      }
      const result = { hash: hashCrowd(crowd), agents: physics === 'jolt' ? scene.countOn('agent') - scene.playerBodies : 0 }
      scene.room.dispose()
      scene.world.dispose()
      return result
    }
    const engine = await run('jolt')
    const own = await run('own')
    expect(engine.agents).toBe(120)
    expect(engine.hash).toBe(own.hash)
    console.log(JSON.stringify({ name: 'ts6-state-hash', hash: engine.hash, agents: 120, steps: 300 }))
  })
})
