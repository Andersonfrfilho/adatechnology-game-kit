// A worker_threads worker of the coordinator hosting the package's kinds, from the built three-free entry (the test job builds it first).
import { installWorkerHost } from '@adatechnology/game-workers'
import { nodeWorkerScope } from '@adatechnology/game-workers/node'

import { groundTilesKind } from '../../dist/worker-kinds.js'

installWorkerHost(nodeWorkerScope(), [groundTilesKind])
