import type { WorkerScopeLike } from '@adatechnology/game-shapes'

import { installFitWorker } from './fit-port'

// the worker script a host starts for `createWorkerFitPort` (dist/fit-worker.js as a module, or dist/fit-worker.global.js as a classic or Blob worker): no three.js here
installFitWorker(globalThis as unknown as WorkerScopeLike)
