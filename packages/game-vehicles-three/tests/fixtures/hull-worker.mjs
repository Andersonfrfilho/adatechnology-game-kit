// A worker_threads worker of the coordinator hosting the hull division, from the built three-free entry (the test job builds the package first).
import { installWorkerHost } from '@adatechnology/game-workers'
import { nodeWorkerScope } from '@adatechnology/game-workers/node'

import { hullPlanKind } from '../../dist/worker-kinds.js'

installWorkerHost(nodeWorkerScope(), [hullPlanKind])
