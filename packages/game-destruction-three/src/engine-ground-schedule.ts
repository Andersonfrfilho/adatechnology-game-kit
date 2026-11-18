import type { HeightPatch } from '@adatechnology/game-terrain'

import type { GroundRect, GroundTile } from './engine-ground'
import { bandLength, computeGroundTile, readGroundPatch, tileOfResult } from './engine-ground-job'
import type { GroundPatchRead, GroundTileResult } from './engine-ground-job'
import type { GroundWorkerPort } from './engine-ground-port'

/** The most free patches kept (a few blasts' worth of tiles made again): past it a patch let go is left to the collector. */
const MAX_FREE_PATCHES = 64

/** The samples and band of a patch job (it carries neither): never transferred (`jobTransferOf` skips empty buffers). */
const EMPTY = new Float64Array(0)

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
  /** The samples read at the ask, the main thread's own (the tile keeps them); the band too, from the pool, until applied. Both null in a patch job. */
  readonly samples: Float64Array | null
  readonly band: Float64Array | null
  /** A patch job's terrain vertices (`readGroundPatch`), the main thread's own (the tile keeps them, to tell a change); null in a samples job. */
  readonly patch: HeightPatch | null
  readonly id: number
  /** The worker's answer, if it came. */
  result: GroundTileResult | null
  /** Where the ground changed since the ask (a fresh tile has no record to hold the mark): read again after it is applied. */
  dirty: GroundRect | null
}

export type GroundAsk = Omit<PendingGround, 'id' | 'result' | 'dirty' | 'band' | 'due' | 'patch'> & { readonly patch?: HeightPatch | null }

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
  /** Patches read and not used (the ground had not changed, or the tile that held one was made again), for the next read: not counted in `outstanding`. */
  private readonly freePatches: Float64Array[] = []
  /** The longest patch read yet: a free patch shorter than it is let go. */
  private patchLength = 0
  /** Tiles asked for; applied from the worker's answer (it came in time); made here at their update (it had not); answers that came after (dropped). */
  readonly stats = { asked: 0, inTime: 0, fellBack: 0, late: 0 }

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

  /**
   * A first job the worker answers before any tile is asked for (its id 0 is nobody's, so the answer only gives its buffers back): the worker's script is parsed and its code
   * warm by the first blast, not started by it. Nothing is posted when nothing would answer.
   */
  warm(samples: Float64Array, band: Float64Array, x0: number, z0: number, size: number): void {
    if (this.port.transport === 'none') return
    const sentSamples = this.take(samples.length)
    sentSamples.set(samples)
    const sentBand = this.take(band.length)
    sentBand.set(band)
    this.port.postTile({ id: 0, x0, z0, size, wasCoarse: false, samples: sentSamples, band: sentBand })
  }

  /** The warm job of a patch tile (`warm`): the kernel that makes samples from a patch is hot too. */
  warmPatch(patch: HeightPatch, x0: number, z0: number, size: number): void {
    if (this.port.transport === 'none') return
    this.port.postTile({ id: 0, x0, z0, size, wasCoarse: false, samples: EMPTY, band: EMPTY, patch: this.sentPatch(patch) })
  }

  /**
   * The terrain's vertices under the tile at (x0, z0) and its ring, read into a patch of the main thread's own (from the free ones); null where the host has none (`readGroundPatch`).
   * Handed to `ask` or, unused, back with `givePatch`.
   */
  readPatch(read: GroundPatchRead, x0: number, z0: number, size: number): HeightPatch | null {
    const into = this.freePatches.pop() ?? (this.patchLength > 0 ? new Float64Array(this.patchLength) : undefined)
    const patch = readGroundPatch(read, x0, z0, size, into)
    if (patch && patch.heights !== into) this.patchLength = Math.max(this.patchLength, patch.heights.length)
    if (into && patch?.heights !== into) this.givePatch(into)
    return patch
  }

  /** A patch's heights back for the next read (a tile that let it go, a read not used). */
  givePatch(heights: Float64Array): void {
    if (heights.length >= this.patchLength && this.freePatches.length < MAX_FREE_PATCHES) this.freePatches.push(heights)
  }

  /** A job asked for at update `now`: of samples and a band from the pool (`band`), or of a patch (`job.patch`, band null). */
  ask(job: GroundAsk, band: Float64Array | null, now: number): void {
    this.stats.asked++
    const pending: PendingGround = { ...job, patch: job.patch ?? null, band, due: now + this.frames, id: this.nextId++, result: null, dirty: null }
    this.pending.set(job.key, pending)
    this.byId.set(pending.id, pending)
    if (this.port.transport === 'none') return
    const base = { id: pending.id, x0: job.x0, z0: job.z0, size: job.size, wasCoarse: job.wasCoarse }
    if (job.patch) {
      this.port.postTile({ ...base, samples: EMPTY, band: EMPTY, patch: this.sentPatch(job.patch) })
      return
    }
    const samples = this.take((job.samples as Float64Array).length)
    samples.set(job.samples as Float64Array)
    const sent = this.take((band as Float64Array).length)
    sent.set(band as Float64Array)
    this.port.postTile({ ...base, samples, band: sent })
  }

  /** A copy of the patch for the worker, its heights from the pool (they come back with the answer). */
  private sentPatch(patch: HeightPatch): HeightPatch {
    const count = patch.width * patch.depth
    const heights = this.take(count)
    heights.set(patch.heights.subarray(0, count))
    return { ...patch, heights }
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
    if (p.result) this.stats.inTime++
    else this.stats.fellBack++
    const result = p.result ?? this.computeHere(p)
    if (p.band) this.give(p.band)
    p.result = null
    return tileOfResult(result, p.samples, p.patch ?? undefined)
  }

  /** The tile of a job the worker had not answered by its update, made on this thread from the same job. */
  computeHere(p: PendingGround): GroundTileResult {
    const base = { id: p.id, x0: p.x0, z0: p.z0, size: p.size, wasCoarse: p.wasCoarse }
    if (p.patch) return computeGroundTile({ ...base, samples: EMPTY, band: EMPTY, patch: p.patch })
    return computeGroundTile({ ...base, samples: p.samples as Float64Array, band: p.band as Float64Array })
  }

  /** Every pending job dropped (the ground is cleared); answers still on their way only give their buffers back. */
  clear(): void {
    for (const p of this.pending.values()) {
      if (p.band) this.give(p.band)
      if (p.patch) this.givePatch(p.patch.heights)
    }
    this.pending.clear()
    this.byId.clear()
  }

  dispose(): void {
    this.clear()
    this.port.dispose()
    this.pool.clear()
    this.freePatches.length = 0
  }

  /** How many buffers the pool holds now. */
  get pooled(): number {
    let n = 0
    for (const list of this.pool.values()) n += list.length
    return n
  }

  private readonly answer = (result: GroundTileResult): void => {
    if (result.samples.length > 0) this.give(result.samples)
    if (result.band.length > 0) this.give(result.band)
    if (result.patch) this.give(result.patch)
    const p = this.byId.get(result.id)
    if (p) p.result = result
    else if (result.id !== 0) this.stats.late++
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
