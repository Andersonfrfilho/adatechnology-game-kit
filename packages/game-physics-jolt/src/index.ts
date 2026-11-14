/**
 * @adatechnology/game-physics-jolt: the kit's physics contract over Jolt Physics (JoltPhysics.js, single-threaded `wasm-compat` build: the
 * wasm is inlined in the JS, so node, vitest and the single-file test room load it with no loader config; no SharedArrayBuffer, no COOP/COEP).
 * Every Jolt object the package creates is destroyed by it (`Jolt.destroy`, `RemoveBody`/`DestroyBody`, `Release`): CLAUDE.md §8.
 */
import initJolt from 'jolt-physics/wasm-compat'

import type { PhysicsEngine, WorldDesc } from '@adatechnology/game-physics'

import type { Jolt } from './constants'
import { JoltWorld } from './world'

export { JoltWorld } from './world'
export type { JoltCharacter } from './entries'

let loaded: Promise<Jolt> | null = null

/** Loads the wasm once (async: the browser does not compile a module this size synchronously on the main thread). */
export const loadJolt = (): Promise<Jolt> => (loaded ??= initJolt())

/** The engine, once loaded: `createWorld` is synchronous. */
export const createJoltEngine = async (): Promise<PhysicsEngine & { readonly jolt: Jolt }> => {
  const jolt = await loadJolt()
  return { name: 'jolt', jolt, createWorld: (desc?: WorldDesc) => new JoltWorld(jolt, desc ?? {}) }
}
