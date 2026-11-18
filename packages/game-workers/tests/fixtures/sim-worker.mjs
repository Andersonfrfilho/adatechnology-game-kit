// The simulation thread of the tests (worker_threads), with the test module.
import { installSimThread } from '../../dist/index.js'
import { nodeWorkerScope } from '../../dist/node.js'
import { field } from './sim.mjs'

installSimThread(nodeWorkerScope(), [field])
