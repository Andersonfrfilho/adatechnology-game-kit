import { installWorkerHost } from '@adatechnology/game-workers'
import type { WorkerScopeLike } from '@adatechnology/game-workers'

import { KIT_WORKER_KINDS } from './kit-kinds'

// the file a worker of `createKitWorkers` loads: every kind of the kit (a game with kinds of its own writes its file the same way, with them added)
installWorkerHost(globalThis as unknown as WorkerScopeLike, KIT_WORKER_KINDS)
