import { afterAll, afterEach } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsLoop, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

// one wasm engine per test file (setupFiles); each room gets its own world, and none outlives the test that made it
const engine = await createJoltEngine()
const alive: PhysicsWorld[] = []
const kept: PhysicsWorld[] = []

type Listener = { readonly type: string; readonly listener: EventListenerOrEventListenerObject; readonly options: boolean | AddEventListenerOptions | undefined }
const windowListeners: Listener[] = []

// a room a test never disposes keeps its key listeners on window; a later test's key press would reach it with its world already freed (a wasm crash), so they leave with the test
if (typeof window !== 'undefined') {
  const add = window.addEventListener.bind(window)
  window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    windowListeners.push({ type, listener, options })
    add(type, listener, options)
  }) as typeof window.addEventListener
}

/** The loop a test room steps on: a new Jolt world per call, like production. Pass it as `physics`. */
export const roomPhysics = (): PhysicsLoop => {
  // the wasm heap holds about six worlds (a fixed 128 MB, ~18 MB each): the oldest of four goes when a fifth is made
  if (alive.length >= 4) alive.shift()?.dispose()
  const world = engine.createWorld({ ...KIT_WORLD })
  alive.push(world)
  return createPhysicsLoop(world)
}

/** Like `roomPhysics`, for a room a suite makes once and shares across its tests: the world goes when the file ends, not after the first test. */
export const suiteRoomPhysics = (): PhysicsLoop => {
  const world = engine.createWorld({ ...KIT_WORLD })
  kept.push(world)
  return createPhysicsLoop(world)
}

afterAll(() => {
  for (const world of kept.splice(0)) world.dispose()
})

afterEach(() => {
  for (const { type, listener, options } of windowListeners.splice(0)) window.removeEventListener(type, listener, options)
  for (const world of alive.splice(0)) world.dispose()
})
