// The room's one worker coordinator (CLAUDE.md §14), shared by every module of the page: `?workers=0` runs every job on the main thread,
// `?workers=N` takes N workers, otherwise the automatic count by the machine's cores. The page's build defines `__KIT_WORKER_SOURCE__`, the
// bundle of src/kit-worker.js; without it (a build that does not embed it) there is no coordinator and the modules keep their own path.
import { createWorkerCoordinator, sourceSpawn } from '@adatechnology/game-workers'

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
