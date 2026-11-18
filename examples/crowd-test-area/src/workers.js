// The room's one worker coordinator (CLAUDE.md §14), shared by every module of the page: `?workers=0` runs every job on the main thread,
// `?workers=N` takes N workers, otherwise the automatic count by the machine's cores. The page's build defines `__KIT_WORKER_SOURCE__`, the
// bundle of src/kit-worker.js; without it (a build that does not embed it) there is no coordinator and the modules keep their own path.
import { HORDE_SIM_ID, hordeSnapshotBytes } from '@adatechnology/game-crowd'
import { canRunSimThread, createWorkerCoordinator, sourceSpawn, startSimThread } from '@adatechnology/game-workers'

/** @type {import('@adatechnology/game-workers').WorkerCoordinator | null | undefined} */
let shared

/** The coordinator of this page, made once (`window.__kitWorkers`, for the checks and the stats); `null` when the build embeds no worker. */
export function roomWorkers() {
  if (shared !== undefined) return shared
  // replaced by the build's `define`; absent, it reads undefined
  const embedded = /** @type {{ __KIT_WORKER_SOURCE__?: unknown }} */ (globalThis).__KIT_WORKER_SOURCE__
  const source = typeof embedded === 'string' ? embedded : null
  if (!source) return (shared = null)
  const raw = new URLSearchParams(globalThis.location?.search ?? '').get('workers')
  const workers = raw === null || raw === 'auto' ? 'auto' : Math.max(0, Number(raw) || 0)
  shared = createWorkerCoordinator({ spawn: sourceSpawn(source, { type: 'classic', name: 'kit-worker' }), workers })
  ;/** @type {{ __kitWorkers?: unknown }} */ (globalThis).__kitWorkers = shared
  return shared
}

/**
 * The horde's simulation thread (spec 009, T22) when the page asks for it (`?sim=thread`) and can share memory (COOP/COEP; always in
 * Electron): the factory the crowd bench takes as `hordeThread`. `undefined` otherwise, and the horde steps here as before. The thread running
 * now is `window.__hordeThread` (its `stats()` for the checks).
 * @returns {((init: import('@adatechnology/game-crowd').HordeSimInit) => import('@adatechnology/game-workers').SimThread | null) | undefined}
 */
export function roomHordeThread() {
  if (new URLSearchParams(globalThis.location?.search ?? '').get('sim') !== 'thread') return undefined
  const embedded = /** @type {{ __KIT_SIM_SOURCE__?: unknown }} */ (globalThis).__KIT_SIM_SOURCE__
  const g = /** @type {{ __hordeThread?: unknown, __hordeThreadError?: string, __hordeThreadStart?: number }} */ (globalThis)
  if (typeof embedded !== 'string' || !canRunSimThread()) {
    g.__hordeThreadError = typeof embedded !== 'string' ? 'no simulation source in this build' : 'no shared memory (COOP/COEP)'
    return undefined
  }
  const spawn = sourceSpawn(embedded, { type: 'classic', name: 'sim-thread' })
  return (init) => {
    const thread = startSimThread(spawn, { module: HORDE_SIM_ID, init, snapshotBytes: hordeSnapshotBytes(init.capacity) })
    thread.ready.catch((error) => void (g.__hordeThreadError = String(error?.message ?? error)))
    g.__hordeThread = thread
    // the agents the page handed over (the first word of the initial snapshot)
    g.__hordeThreadStart = init.initial ? new Int32Array(init.initial.buffer, init.initial.byteOffset, 1)[0] : init.count
    return thread
  }
}
