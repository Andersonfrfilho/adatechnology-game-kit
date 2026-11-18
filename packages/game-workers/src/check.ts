import type { AnyWorkerKind, TaskKind } from '@adatechnology/game-contracts'
import { createWorkerCoordinator } from './coordinator'
import { inThreadSpawn } from './in-thread'
import type { Spawn } from './protocol'

export interface KindReport {
  readonly ok: boolean
  readonly problems: readonly string[]
}

const bytesOf = (view: ArrayBufferView): Uint8Array => new Uint8Array(view.buffer, view.byteOffset, view.byteLength)

/** Where two values differ, byte for byte in typed arrays (`-0`, `NaN` payloads included); `null` when they are the same. */
export function firstDifference(a: unknown, b: unknown, path = 'output'): string | null {
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.constructor !== b.constructor) return `${path}: not the same kind of array`
    const x = bytesOf(a)
    const y = bytesOf(b)
    if (x.length !== y.length) return `${path}: ${x.length} bytes against ${y.length}`
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return `${path}: byte ${i} differs`
    return null
  }
  if (a instanceof ArrayBuffer || b instanceof ArrayBuffer) {
    if (!(a instanceof ArrayBuffer) || !(b instanceof ArrayBuffer)) return `${path}: not both ArrayBuffers`
    return firstDifference(new Uint8Array(a), new Uint8Array(b), path)
  }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b) ? null : `${path}: ${String(a)} against ${String(b)}`
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: an array against an object`
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const difference = firstDifference((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`)
    if (difference) return difference
  }
  return null
}

/**
 * The equivalence test every kind passes (CLAUDE.md §14): each sample run on the main thread, through the in-thread worker (the protocol,
 * the copy and the transfer) and through each `spawn` given (a real `worker_threads` worker in CI), and the outputs compared byte for byte.
 * `extraKinds`: the other kinds the given workers host.
 */
export async function checkTaskKind<In, Out>(kind: TaskKind<In, Out>, samples: readonly In[], spawns: readonly Spawn[] = [], extraKinds: readonly AnyWorkerKind[] = []): Promise<KindReport> {
  const problems: string[] = []
  const any = kind as TaskKind<unknown, unknown>
  const paths: { name: string; spawn: Spawn }[] = [{ name: 'in-thread worker', spawn: inThreadSpawn([any, ...extraKinds]) }, ...spawns.map((spawn, i) => ({ name: `worker ${i + 1}`, spawn }))]
  for (const path of paths) {
    const coordinator = createWorkerCoordinator({ spawn: path.spawn, workers: 1 })
    try {
      await coordinator.warm([any])
      for (let i = 0; i < samples.length; i++) {
        const reference = kind.run(structuredClone(samples[i]) as In)
        const handle = coordinator.submit(kind, structuredClone(samples[i]) as In, { frame: 0 })
        const out = await handle.promise
        if (handle.source !== 'worker') problems.push(`${kind.id} sample ${i}: ${path.name} did not answer (${handle.source ?? 'no result'})`)
        const difference = firstDifference(reference, out)
        if (difference) problems.push(`${kind.id} sample ${i}, ${path.name}: ${difference}`)
      }
    } catch (error) {
      problems.push(`${kind.id}, ${path.name}: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      coordinator.dispose()
    }
  }
  return { ok: problems.length === 0, problems }
}
