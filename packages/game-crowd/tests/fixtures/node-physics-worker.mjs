import { parentPort } from 'node:worker_threads'

import { attachPhysicsWorker } from '../../dist/index.js'

attachPhysicsWorker({ postMessage: (message, transfer) => parentPort.postMessage(message, transfer), onMessage: (listener) => parentPort.on('message', listener) })
