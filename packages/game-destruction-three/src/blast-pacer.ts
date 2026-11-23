import type { BlastOptions, DestructionWorld, ExplosionJob, HitResult, Vec3 } from '@adatechnology/game-destruction'

import { STRUCTURAL_UNITS_PER_FRAME } from './event-weight'
import type { DestructionRenderer } from './types'

/** Fragment rays a frame of a spread blast casts by default: the M67's 256 in 4 frames and its wave in a fifth (spec 018, `proposta-d2.md`). */
export const BLAST_RAYS_PER_FRAME = 64

export type BlastPacerOptions = {
  readonly world: Pick<DestructionWorld, 'beginExplosion'>
  readonly renderer: Pick<DestructionRenderer, 'holdEvents' | 'applyStructuralEventsSliced'>
  /** Fragment rays per frame (`ExplosionJob.advance`). Default `BLAST_RAYS_PER_FRAME`; Infinity runs every blast whole in `begin` (the one-shot blast, through the pacer). */
  readonly raysPerFrame?: number
  /** Units of `EVENT_APPLY_WEIGHT` of structural events applied per frame once the blast is done. Default `STRUCTURAL_UNITS_PER_FRAME`. */
  readonly unitsPerFrame?: number
}

/** A blast for the pacer: the arguments of `DestructionWorld.explode`. */
export type PacedBlast = {
  readonly point: Vec3
  readonly energy: number
  readonly radius: number
  readonly source?: string
  readonly options?: BlastOptions
}

export type BlastPacer = {
  /**
   * Begins a blast and runs its first slice now; `onDone` gets what `explode` would have returned when it ends (in this call when it fits in one slice). A blast begun
   * while another is open waits for it (`beginExplosion`).
   */
  begin(blast: PacedBlast, onDone: (results: HitResult[]) => void): void
  /** true while the world must not step: a blast still open, or the structural events of the blasts done still being applied. The host holds its fixed steps on it. */
  isHolding(): boolean
  /** Once per frame while holding, outside the fixed step: the next slice of the oldest open blast, or, all done, the next slice of their structural events. */
  step(): void
}

type OpenBlast = { readonly job: ExplosionJob; readonly onDone: (results: HitResult[]) => void; isFresh: boolean }

/**
 * Spreads a large blast over frames with the world held (spec 018 D2): the fragments a fixed number of rays per frame, the wave in a frame of its own, then the
 * structural events a fixed weight per frame, every count fixed so the world it leaves is the one the one-shot blast leaves. The host holds the fixed steps while
 * `isHolding` (`game-runtime`'s `holdFixed`) and calls `step` once per frame; the effects, the sound and the camera go on meanwhile.
 */
export function createBlastPacer(options: BlastPacerOptions): BlastPacer {
  const { world, renderer } = options
  const raysPerFrame = options.raysPerFrame ?? BLAST_RAYS_PER_FRAME
  const unitsPerFrame = options.unitsPerFrame ?? STRUCTURAL_UNITS_PER_FRAME
  const open: OpenBlast[] = []
  let isApplying = false

  /** Hands every blast that ended to its host, oldest first; with none left open the events go and their structural ones are applied in the frames after. */
  const settleDone = (): void => {
    while (open.length > 0 && open[0]!.job.isDone) {
      const done = open.shift()!
      done.onDone(done.job.result())
    }
    if (open.length > 0) return
    renderer.holdEvents(false)
    isApplying = true
  }

  return {
    begin(blast, onDone) {
      const isFirst = open.length === 0
      if (isFirst) renderer.holdEvents(true)
      const job = world.beginExplosion(blast.point, blast.energy, blast.radius, blast.source, blast.options)
      // one queued behind another is advanced from the frame after the one before it ends
      open.push({ job, onDone, isFresh: isFirst })
      if (!isFirst) return
      // a blast that fits in one slice (or every blast, with `raysPerFrame` Infinity) is the one-shot blast: nothing is held, its events apply in the tick as always
      let isDone = job.advance(raysPerFrame)
      while (!isDone && raysPerFrame === Infinity) isDone = job.advance(raysPerFrame)
      if (isDone && !isApplying) {
        open.shift()
        renderer.holdEvents(false)
        onDone(job.result())
        return
      }
      if (job.isDone) settleDone()
    },
    isHolding: () => open.length > 0 || isApplying,
    step() {
      const oldest = open[0]
      if (oldest) {
        // the frame that began it already ran its first slice
        if (oldest.isFresh) {
          oldest.isFresh = false
          return
        }
        oldest.job.advance(raysPerFrame)
        if (oldest.job.isDone) settleDone()
        return
      }
      if (isApplying) isApplying = renderer.applyStructuralEventsSliced(unitsPerFrame) > 0
    },
  }
}
