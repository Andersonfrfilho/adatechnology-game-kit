import type { PhysicsWorkerFactory } from './types'

/** The browser worker that loads `physics-worker.js` from beside the bundle; `null` where there is no `Worker` or no `import.meta.url` (the iife build, node). */
export function createDefaultWorkerFactory(): PhysicsWorkerFactory | null {
  if (typeof Worker === 'undefined') return null
  let url: URL
  try {
    url = new URL('./physics-worker.js', import.meta.url)
  } catch {
    return null
  }
  return () => {
    const worker = new Worker(url, { type: 'module' })
    return {
      postMessage: (message, transfer) => worker.postMessage(message, transfer ?? []),
      onMessage: (listener) => worker.addEventListener('message', (event) => listener(event.data)),
      terminate: () => worker.terminate(),
    }
  }
}
