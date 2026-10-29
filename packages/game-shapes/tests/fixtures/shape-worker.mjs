// A Node worker_threads script for the pool tests: the built package (the test job builds it first) behind a parentPort wrapper.
import { parentPort } from 'node:worker_threads'

import { installShapeWorker } from '../../dist/worker.js'
import { rocks } from './rocks.mjs'

const scope = {
  onmessage: null,
  postMessage: (message, transfer) => parentPort.postMessage(message, transfer),
}
parentPort.on('message', (data) => scope.onmessage?.({ data }))
installShapeWorker(scope, { generators: { 'test.rocks': rocks } })
