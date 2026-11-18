import type { GroundRect, GroundTile } from './engine-ground'
import { bandLength, computeGroundTile, tileOfResult } from './engine-ground-job'
import type { GroundTileResult } from './engine-ground-job'
import type { GroundWorkerPort } from './engine-ground-port'

/** A tile asked for and not applied yet (`GroundSchedule`). */
export interface PendingGround {
  readonly key: number
  readonly ix: number
  readonly iz: number
  readonly x0: number
  readonly z0: number
  readonly size: number
  /** The update it is applied at, whatever the worker does. */
  readonly due: number
  /** No tile was laid there before: what needs it waits held. */
  readonly fresh: boolean
  readonly wasCoarse: boolean
  /** The samples read at the ask, the main thread's own (the tile keeps them); the band too, from the pool, until applied. */
  readonly samples: Float64Array
  readonly band: Float64Array
  readonly id: number
  /** The worker's answer, if it came. */
  result: GroundTileResult | null
  /** Where the ground changed since the ask (a fresh tile has no record to hold the mark): read again after it is applied. */
  dirty: GroundRect | null
}

export type GroundAsk = Omit<PendingGround, 'id' | 'result' | 'dirty' | 'band' | 'due'>

/**
 * The fixed schedule of the ground tiles made off the main thread (owner decision 2026-11-17): a tile asked for at update N is applied at N + `frames`, never earlier and never
 * later. Its job is read at N (`readGround`, `readGroundBand`) and kept; at N + `frames` the tile is the worker's answer if it came, else `computeGroundTile` of the same job on
 * the main thread, the same bits (the answer is a pure function of the job). So the physics never depends on when, or whether, the worker answered.
 * The buffers sent are copies from a pool, and come back with the answer; the pool keeps them for the next job (no arrays made per job once warm).
 */
export class GroundSchedule {
  /** By tile key, in the order asked: the order they are applied in. */
  readonly pending = new Map<number, PendingGround>()
  private readonly byId = new Map<number, PendingGround>()
  private readonly pool = new Map<number, Float64Array[]>()
  private nextId = 1
  /** Pool buffers out (with a job, or with the worker): back to 0 when every job is applied and every answer came. */
  outstanding = 0

  constructor(
    private readonly port: GroundWorkerPort,
    readonly frames: number,
  ) {
    port.onTile(this.answer)
  }

  /** A band from the pool, for `readGroundBand` (`ask` keeps it). */
  band(size: number): Float64Array {
    return this.take(bandLength(size))
  }

  ask(job: GroundAsk, band: Float64Array, now: number): void {
    const pending: PendingGround = { ...job, band, due: now + this.frames, id: this.nextId++, result: null, dirty: null }
    this.pending.set(job.key, pending)
    this.byId.set(pending.id, pending)
    if (this.port.transport === 'none') return
    const samples = this.take(job.samples.length)
    samples.set(job.samples)
    const sent = this.take(band.length)
    sent.set(band)
    this.port.postTile({ id: pending.id, x0: job.x0, z0: job.z0, size: job.size, wasCoarse: job.wasCoarse, samples, band: sent })
  }

  /** The tiles due at update `now`, in the order asked, taken off the schedule into `out`. */
  takeDue(now: number, out: PendingGround[]): void {
    out.length = 0
    for (const p of this.pending.values()) if (p.due <= now) out.push(p)
    for (const p of out) {
      this.pending.delete(p.key)
      this.byId.delete(p.id)
    }
  }

  /** The tile of a due job: the worker's answer, or made here from the job; its band goes back to the pool. */
  resolve(p: PendingGround): GroundTile {
    const result = p.result ?? computeGroundTile({ id: p.id, x0: p.x0, z0: p.z0, size: p.size, wasCoarse: p.wasCoarse, samples: p.samples, band: p.band })
    this.give(p.band)
    p.result = null
    return tileOfResult(result, p.samples)
  }

  /** Every pending job dropped (the ground is cleared); answers still on their way only give their buffers back. */
  clear(): void {
    for (const p of this.pending.values()) this.give(p.band)
    this.pending.clear()
    this.byId.clear()
  }

  dispose(): void {
    this.clear()
    this.port.dispose()
    this.pool.clear()
  }

  /** How many buffers the pool holds now. */
  get pooled(): number {
    let n = 0
    for (const list of this.pool.values()) n += list.length
    return n
  }

  private readonly answer = (result: GroundTileResult): void => {
    this.give(result.samples)
    this.give(result.band)
    const p = this.byId.get(result.id)
    if (p) p.result = result
  }

  private take(length: number): Float64Array {
    this.outstanding++
    return this.pool.get(length)?.pop() ?? new Float64Array(length)
  }

  private give(buffer: Float64Array): void {
    this.outstanding--
    const list = this.pool.get(buffer.length)
    if (list) list.push(buffer)
    else this.pool.set(buffer.length, [buffer])
  }
}
