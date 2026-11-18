import { parentPort, Worker } from 'node:worker_threads'
import type { Spawn, WorkerLike, WorkerScopeLike } from './protocol'

/**
 * Node `worker_threads` workers that load `url` (an ES module that calls `installWorkerHost(nodeWorkerScope(), kinds)`), with the same
 * protocol as a browser worker. Node only: import it from `@adatechnology/game-workers/node`.
 */
export function nodeSpawn(url: string | URL, options: { readonly execArgv?: readonly string[] } = {}): Spawn {
  return () => {
    const worker = new Worker(url, options.execArgv ? { execArgv: [...options.execArgv] } : {})
    const like: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (message, transfer = []) => worker.postMessage(message, [...transfer]),
      terminate: () => void worker.terminate(),
    }
    worker.on('message', (data: unknown) => like.onmessage?.({ data }))
    worker.on('error', (error: unknown) => like.onerror?.(error))
    // a worker that exits on its own took its jobs with it
    worker.on('exit', (code: number) => code !== 0 && like.onerror?.(new Error(`worker exited with ${code}`)))
    worker.unref()
    return like
  }
}

/** The worker side in Node: `parentPort` as the scope `installWorkerHost` takes. */
export function nodeWorkerScope(): WorkerScopeLike {
  const port = parentPort
  if (!port) throw new Error('nodeWorkerScope: not inside a worker_threads worker')
  const scope: WorkerScopeLike = {
    onmessage: null,
    postMessage: (message, transfer = []) => port.postMessage(message, [...transfer]),
  }
  port.on('message', (data: unknown) => scope.onmessage?.({ data }))
  return scope
}
