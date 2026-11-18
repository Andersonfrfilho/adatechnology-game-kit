import type { WorkerScopeLike } from '@adatechnology/game-shapes'

import { installGroundWorker } from './engine-ground-port'

// the worker script a host starts for `createWorkerGroundPort` (dist/ground-worker.js as a module, or dist/ground-worker.global.js as a classic or Blob worker): no three.js here
installGroundWorker(globalThis as unknown as WorkerScopeLike)
