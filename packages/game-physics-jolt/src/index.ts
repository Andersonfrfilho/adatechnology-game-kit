/**
 * @adatechnology/game-physics-jolt: the kit's physics contract over Jolt Physics (JoltPhysics.js; by default the single-threaded `wasm-compat` build: the
 * wasm is inlined in the JS, so node, vitest and the single-file test room load it with no loader config; no SharedArrayBuffer, no COOP/COEP).
 * The multithreaded build is opt-in (`createJoltEngine({ build: 'multithread' })`, see `threading.ts`).
 * Every Jolt object the package creates is destroyed by it (`Jolt.destroy`, `RemoveBody`/`DestroyBody`, `Release`): CLAUDE.md §8.
 */
import initJolt from 'jolt-physics/wasm-compat'

import type { PhysicsEngine, WorldDesc } from '@adatechnology/game-physics'

import type { Jolt } from './constants'
import { MAX_WORKER_THREADS, MULTITHREAD_MODULE, resolveJoltThreading } from './threading'
import type { JoltBuild, JoltEngineOptions, JoltThreading } from './threading'
import { JoltWorld } from './world'

export { JoltWorld } from './world'
export type { JoltCharacter } from './entries'
export { JOLT_THREADING_ERROR, JoltThreadingError, MAX_WORKER_THREADS, MULTITHREAD_MODULE, SINGLE_THREAD, canShareMemory, resolveJoltThreading } from './threading'
export type { JoltBuild, JoltContactCallbacks, JoltEngineOptions, JoltThreading, JoltThreadingErrorCode } from './threading'

const loaded = new Map<JoltBuild, Promise<Jolt>>()
/** Job threads held by the live worlds of the multithreaded build (its pthread pool is one per page). */
let workerThreadsInUse = 0

type JoltModule = { readonly default: () => Promise<Jolt> }

/** The multithreaded build, by a specifier held in a variable: a bundler leaves it to the page, whose pthreads load the same file by its URL. */
const importMultithread = async (moduleUrl: string): Promise<Jolt> => {
  const module = (await import(/* @vite-ignore */ moduleUrl)) as JoltModule
  return module.default()
}

/** Loads a build's wasm once (async: the browser does not compile a module this size synchronously on the main thread). Default the single-threaded build. */
export const loadJolt = (build: JoltBuild = 'single', moduleUrl: string = MULTITHREAD_MODULE): Promise<Jolt> => {
  const known = loaded.get(build)
  if (known) return known
  const loading = build === 'single' ? initJolt() : importMultithread(moduleUrl)
  loaded.set(build, loading)
  return loading
}

export type JoltEngine = PhysicsEngine & { readonly jolt: Jolt; readonly threading: JoltThreading }

/**
 * The engine, once loaded: `createWorld` is synchronous. With no options, the single-threaded build and the kit's JS contact listener, as always.
 * `options` pick the multithreaded build and its job threads (see `threading.ts`: worker threads only without JS contact callbacks); a combination that
 * cannot run throws `JoltThreadingError` before anything loads. The worlds of a page share the build's 16 pthreads: a world asks for `workerThreads`
 * and gets what the live worlds left (`world.threading` says how many); its `dispose` gives them back.
 */
export const createJoltEngine = async (options: JoltEngineOptions = {}): Promise<JoltEngine> => {
  const threading = resolveJoltThreading(options)
  const jolt = await loadJolt(threading.build, options.moduleUrl)
  const createWorld = (desc?: WorldDesc): JoltWorld => {
    // every live world's job threads come out of the same pthread pool: a world made while others hold it gets what is left (0 at worst), never a hang
    const workerThreads = Math.min(threading.workerThreads, MAX_WORKER_THREADS - workerThreadsInUse)
    workerThreadsInUse += workerThreads
    return new JoltWorld(jolt, desc ?? {}, { ...threading, workerThreads }, () => {
      workerThreadsInUse -= workerThreads
    })
  }
  return { name: 'jolt', jolt, threading, createWorld }
}
