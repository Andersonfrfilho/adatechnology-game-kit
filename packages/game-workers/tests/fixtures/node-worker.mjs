// The worker_threads script of the tests: the built package behind nodeWorkerScope, hosting the test kinds.
import { installWorkerHost } from '../../dist/index.js'
import { nodeWorkerScope } from '../../dist/node.js'
import { crash, scaler, waves } from './kinds.mjs'

globalThis.__inWorker = true
installWorkerHost(nodeWorkerScope(), [waves, scaler, crash])
