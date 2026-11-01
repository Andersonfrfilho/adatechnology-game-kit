import { attachPhysicsWorker } from './worker-host'

type WorkerScope = { postMessage(message: unknown, transfer?: ArrayBuffer[]): void; addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void }

// the file a browser `Worker` loads (`dist/physics-worker.js`); outside a worker scope it does nothing
const scope = globalThis as unknown as Partial<WorkerScope> & { WorkerGlobalScope?: unknown }
if (typeof scope.WorkerGlobalScope !== 'undefined' && scope.postMessage && scope.addEventListener) {
  const self = scope as WorkerScope
  attachPhysicsWorker({ postMessage: (message, transfer) => self.postMessage(message, transfer), onMessage: (listener) => self.addEventListener('message', (event) => listener(event.data)) })
}
