import type { AnyResidentKind, AnyWorkerKind, ResidentInstance } from '@adatechnology/game-contracts'
import { isToWorker } from './protocol'
import type { FromWorker, WorkerScopeLike } from './protocol'

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * The worker side of the coordinator: answers each job with the kind's own `run` (or the resident instance's `step`) and transfers the
 * output's buffers back. Call it in the file the worker loads, with every kind the game registers, the kit's and its own:
 *
 * ```ts
 * // game-worker.ts
 * import { installWorkerHost } from '@adatechnology/game-workers'
 * installWorkerHost(self, [...KIT_WORKER_KINDS, pathfinding])
 * ```
 */
export function installWorkerHost(scope: WorkerScopeLike, kinds: readonly AnyWorkerKind[]): void {
  const byId = new Map<string, AnyWorkerKind>()
  for (const kind of kinds) {
    if (byId.has(kind.id) && byId.get(kind.id) !== kind) throw new Error(`installWorkerHost: two kinds with the id ${kind.id}`)
    byId.set(kind.id, kind)
  }
  const residents = new Map<number, { kind: AnyResidentKind; instance: ResidentInstance<unknown, unknown> }>()
  const reply = (message: FromWorker, transfer: readonly ArrayBuffer[] = []): void => scope.postMessage(message, transfer)
  const fail = (id: number, error: unknown, started: number): void => reply({ t: 'done', id, ok: false, error: error instanceof Error ? error.message : String(error), ms: now() - started })

  scope.onmessage = (event) => {
    const message = event.data
    if (!isToWorker(message)) return
    switch (message.t) {
      case 'hello':
        reply({ t: 'hello', id: message.id, kinds: [...byId.keys()] })
        return
      case 'task': {
        const started = now()
        const kind = byId.get(message.kind)
        if (!kind || kind.kind !== 'task') return fail(message.id, new Error(`this worker has no task kind ${message.kind}`), started)
        try {
          const output = kind.run(message.input)
          reply({ t: 'done', id: message.id, ok: true, output, ms: now() - started }, kind.transferOutput?.(output) ?? [])
        } catch (error) {
          fail(message.id, error, started)
        }
        return
      }
      case 'create': {
        const kind = byId.get(message.kind)
        // an unknown kind answers at its first step, where there is a job id to fail
        if (kind?.kind === 'resident') residents.set(message.rid, { kind, instance: kind.create(message.init) })
        return
      }
      case 'step': {
        const started = now()
        const resident = residents.get(message.rid)
        if (!resident) return fail(message.id, new Error(`this worker has no resident ${message.rid}`), started)
        try {
          const output = resident.instance.step(message.input)
          reply({ t: 'done', id: message.id, ok: true, output, ms: now() - started }, resident.kind.transferOutput?.(output) ?? [])
        } catch (error) {
          fail(message.id, error, started)
        }
        return
      }
      case 'dispose':
        residents.get(message.rid)?.instance.dispose?.()
        residents.delete(message.rid)
        return
    }
  }
}
