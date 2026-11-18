// A worker_threads worker of the coordinator hosting the crowd physics resident: both built packages (the test job builds them first).
import { installWorkerHost } from '@adatechnology/game-workers'
import { nodeWorkerScope } from '@adatechnology/game-workers/node'

import { crowdPhysicsKind } from '../../dist/index.js'

installWorkerHost(nodeWorkerScope(), [crowdPhysicsKind])
