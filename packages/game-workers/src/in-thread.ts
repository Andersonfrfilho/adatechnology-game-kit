import type { AnyWorkerKind } from '@adatechnology/game-contracts'
import { installWorkerHost } from './host'
import type { Spawn, WorkerLike, WorkerScopeLike } from './protocol'

export interface InThreadOptions {
  /** Milliseconds before each answer reaches the coordinator (default 0: the next macrotask), to play a slow worker in tests. */
  readonly delayMs?: number
}

/**
 * A worker that runs `installWorkerHost` in this thread and answers on a later macrotask, as a real one does: the same protocol, the same
 * copy of the input (`structuredClone`) and the same transfer of the output. For tests, and the reference of `checkTaskKind`.
 */
export function inThreadSpawn(kinds: readonly AnyWorkerKind[], options: InThreadOptions = {}): Spawn {
  return () => {
    let alive = true
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage(message, transfer = []) {
        const copy: unknown = structuredClone(message, { transfer: [...transfer] })
        setTimeout(() => alive && scope.onmessage?.({ data: copy }), 0)
      },
      terminate() {
        alive = false
      },
    }
    const scope: WorkerScopeLike = {
      onmessage: null,
      postMessage(message, transfer = []) {
        const copy: unknown = structuredClone(message, { transfer: [...transfer] })
        setTimeout(() => alive && worker.onmessage?.({ data: copy }), options.delayMs ?? 0)
      },
    }
    installWorkerHost(scope, kinds)
    return worker
  }
}
