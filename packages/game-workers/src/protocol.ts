/** Messages between the coordinator and a worker host. One protocol for browser workers, `worker_threads` and the in-thread host. */

export type ToWorker =
  | { readonly t: 'hello'; readonly id: number }
  | { readonly t: 'task'; readonly id: number; readonly kind: string; readonly input: unknown }
  | { readonly t: 'create'; readonly rid: number; readonly kind: string; readonly init: unknown }
  | { readonly t: 'step'; readonly id: number; readonly rid: number; readonly input: unknown }
  | { readonly t: 'dispose'; readonly rid: number }

export type FromWorker =
  | { readonly t: 'hello'; readonly id: number; readonly kinds: readonly string[] }
  | { readonly t: 'done'; readonly id: number; readonly ok: true; readonly output: unknown; readonly ms: number }
  | { readonly t: 'done'; readonly id: number; readonly ok: false; readonly error: string; readonly ms: number }

/** Anything with `postMessage` / `onmessage` / `terminate`: a browser `Worker`, a `worker_threads` wrapper, the in-thread host. */
export interface WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
  postMessage(message: unknown, transfer?: readonly ArrayBuffer[]): void
  terminate(): void
}

/** The worker side: `self` in a browser worker, `parentPort` in Node (through `nodeWorkerScope`), or the in-thread host. */
export interface WorkerScopeLike {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage(message: unknown, transfer?: readonly ArrayBuffer[]): void
}

/** Makes one worker that runs `installWorkerHost` with the kinds the coordinator is asked for. */
export type Spawn = () => WorkerLike

export const isFromWorker = (data: unknown): data is FromWorker => typeof data === 'object' && data !== null && typeof (data as { t?: unknown }).t === 'string'
export const isToWorker = (data: unknown): data is ToWorker => typeof data === 'object' && data !== null && typeof (data as { t?: unknown }).t === 'string'
