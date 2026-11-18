// The simulation thread of the horde tests (worker_threads): the built packages, the horde module.
import { installSimThread } from '@adatechnology/game-workers'
import { nodeWorkerScope } from '@adatechnology/game-workers/node'

import { hordeSimModule } from '../../dist/index.js'

installSimThread(nodeWorkerScope(), [hordeSimModule])
