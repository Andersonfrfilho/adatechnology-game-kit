import type { OrientedBox } from '@adatechnology/game-shapes'

import type { FitResult } from './fit-job'
import type { FitWorkerPort } from './fit-port'

/** Fits waiting for an answer at most: past it the renderer fits on the main thread (the worker is behind), so nothing waits on it and the arrays held stay few. */
export const FIT_IN_FLIGHT = 32
/** Buffers kept for the next jobs (§8: reused, never grown past this; dropped on dispose). */
const POOL_BUFFERS = 16

/** What became of the fits posted: answered and taken into the cache, answered for a part no longer there, failed in the worker, and cancelled (the object unbound). */
export interface FitRelayStats {
  posted: number
  answered: number
  taken: number
  stale: number
  failed: number
  cancelled: number
}

interface Waiting<TKey> {
  key: TKey | null
  readonly points: readonly number[]
  readonly triangles: readonly number[]
}

/**
 * The main thread's side of the fit worker: posts the points and triangles of a part (copied into pooled buffers, transferred), keeps the very number lists it posted, and hands
 * them back with the boxes when the answer comes, for the renderer's exact-input cache. Once the port fails or is disposed it posts nothing more (`live` false).
 */
export class FitRelay<TKey> {
  readonly stats: FitRelayStats = { posted: 0, answered: 0, taken: 0, stale: 0, failed: 0, cancelled: 0 }
  private readonly waiting = new Map<number, Waiting<TKey>>()
  private readonly pool: ArrayBuffer[] = []
  private nextId = 1
  private alive = true

  constructor(
    private readonly port: FitWorkerPort,
    private readonly take: (key: TKey, fit: { readonly points: readonly number[]; readonly triangles: readonly number[]; readonly boxes: OrientedBox[] }) => boolean,
  ) {
    port.onFit((result) => this.answer(result))
    port.onFailure(() => this.fail())
  }

  /** true while the port answers: false after a failure or `dispose`. */
  get live(): boolean {
    return this.alive
  }

  /** true when `FIT_IN_FLIGHT` fits wait for an answer. */
  get full(): boolean {
    return this.waiting.size >= FIT_IN_FLIGHT
  }

  get inFlight(): number {
    return this.waiting.size
  }

  get pooled(): number {
    return this.pool.length
  }

  /** Posts the fit of `points` joined by `triangles` for `key`; the lists are kept as they are (not copied: the caller hands them over). */
  post(key: TKey, points: readonly number[], triangles: readonly number[]): void {
    this.send(key, points, triangles)
  }

  /** One small fit, so the worker has compiled the fit before the first part needs it. */
  warm(): void {
    // a box of 8 corners joined by 12 triangles: every branch of the fit with triangles
    const points = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1]
    const triangles = [0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5]
    this.send(null, points, triangles)
  }

  /** Forgets the keys `drop` names: their answers are thrown away when they come (their buffers still go back to the pool). */
  cancel(drop: (key: TKey) => boolean): void {
    for (const entry of this.waiting.values()) {
      if (entry.key !== null && drop(entry.key)) {
        entry.key = null
        this.stats.cancelled++
      }
    }
  }

  /** Stops the port; nothing waits, nothing is kept. */
  dispose(): void {
    this.alive = false
    this.waiting.clear()
    this.pool.length = 0
    this.port.dispose()
  }

  private send(key: TKey | null, points: readonly number[], triangles: readonly number[]): void {
    if (!this.alive) return
    const id = this.nextId++
    const pointArray = new Float64Array(this.buffer(points.length * 8), 0, points.length)
    pointArray.set(points)
    const triangleArray = new Uint32Array(this.buffer(triangles.length * 4), 0, triangles.length)
    triangleArray.set(triangles)
    this.waiting.set(id, { key, points, triangles })
    if (key !== null) this.stats.posted++
    this.port.postFit({ id, points: pointArray, triangles: triangleArray })
  }

  /** The smallest pooled buffer that holds `bytes`, else a new one (whole multiples of 8, so a Float64Array view fits). */
  private buffer(bytes: number): ArrayBuffer {
    let best = -1
    for (let i = 0; i < this.pool.length; i++) {
      const size = this.pool[i]!.byteLength
      if (size >= bytes && (best < 0 || size < this.pool[best]!.byteLength)) best = i
    }
    if (best < 0) return new ArrayBuffer(Math.max(8, Math.ceil(bytes / 8) * 8))
    const [found] = this.pool.splice(best, 1)
    return found as ArrayBuffer
  }

  private release(buffer: ArrayBuffer): void {
    if (this.alive && this.pool.length < POOL_BUFFERS && buffer.byteLength > 0) this.pool.push(buffer)
  }

  private answer(result: FitResult): void {
    const entry = this.waiting.get(result.id)
    if (!entry) return
    this.waiting.delete(result.id)
    this.release(result.points.buffer as ArrayBuffer)
    this.release(result.triangles.buffer as ArrayBuffer)
    if (entry.key === null) return
    this.stats.answered++
    if (!result.ok) {
      this.stats.failed++
      return
    }
    if (this.take(entry.key, { points: entry.points, triangles: entry.triangles, boxes: result.boxes })) this.stats.taken++
    else this.stats.stale++
  }

  private fail(): void {
    this.stats.failed += [...this.waiting.values()].filter((entry) => entry.key !== null).length
    this.dispose()
  }
}
