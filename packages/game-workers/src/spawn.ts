import type { Spawn, WorkerLike } from './protocol'

interface BrowserWorker {
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
  terminate(): void
}
type WorkerConstructor = new (url: string | URL, options?: { type?: 'module' | 'classic'; name?: string }) => BrowserWorker

const workerConstructor = (): WorkerConstructor | null => (globalThis as { Worker?: WorkerConstructor }).Worker ?? null

/** Whether this runtime has browser workers. */
export const canSpawnBrowserWorkers = (): boolean => workerConstructor() !== null

const wrap = (worker: BrowserWorker): WorkerLike => {
  const like: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: (message, transfer = []) => worker.postMessage(message, [...transfer]),
    terminate: () => worker.terminate(),
  }
  worker.onmessage = (event) => like.onmessage?.(event)
  worker.onerror = (event) => like.onerror?.(event)
  return like
}

/**
 * Module workers that load `url`, the file that calls `installWorkerHost` (a bundler resolves `new URL('./game-worker.js', import.meta.url)`).
 * Throws where there is no `Worker`; the coordinator then runs every job on the main thread.
 */
export function browserSpawn(url: string | URL, options: { readonly type?: 'module' | 'classic'; readonly name?: string } = {}): Spawn {
  return () => {
    const Ctor = workerConstructor()
    if (!Ctor) throw new Error('browserSpawn: no Worker in this runtime')
    return wrap(new Ctor(url, { type: options.type ?? 'module', ...(options.name ? { name: options.name } : {}) }))
  }
}

/**
 * Workers made from the worker's own source text, for a page that is one file (no worker file beside it to load): the build embeds the
 * bundle of the worker as a string and this makes a Blob URL of it once.
 */
export function sourceSpawn(source: string, options: { readonly type?: 'module' | 'classic'; readonly name?: string } = {}): Spawn {
  let url: string | null = null
  return () => {
    if (!url) {
      if (typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') throw new Error('sourceSpawn: no Blob URLs in this runtime')
      url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    }
    return browserSpawn(url, options)()
  }
}
