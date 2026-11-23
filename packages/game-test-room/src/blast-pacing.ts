import { createBlastPacer } from '@adatechnology/game-destruction-three'
import type { BlastPacer, BlastPacerOptions, PacedBlast } from '@adatechnology/game-destruction-three'
import type { HitResult } from '@adatechnology/game-destruction'
import type { Scheduler } from '@adatechnology/game-runtime'

/** `TestRoomOptions.blastPacing`: spread a large blast over frames with the world held (spec 018 D2); the counts per frame, each with its default. */
export type BlastPacingOptions = Pick<BlastPacerOptions, 'raysPerFrame' | 'wavePartsPerFrame' | 'unitsPerFrame'>

export type BlastPacing = {
  /** Sets a blast off through the pacer; `onDone` gets its results when it ends. Asked inside a fixed step, it begins at the end of that step, never before the step's world work. */
  readonly begin: (blast: PacedBlast, onDone: (results: HitResult[]) => void) => void
  /** The room's scheduler holds its fixed steps on it (`holdFixed`). */
  readonly isHolding: () => boolean
}

type Pending = { readonly blast: PacedBlast; readonly onDone: (results: HitResult[]) => void }

/**
 * The room's side of the pacer: a blast set off inside a fixed step waits for the end of that step's simulation (its world update and its physics step) and begins
 * there, right before the step's last structural pass (`room.structural-events`, order 2000), so with the pacer holding no step runs between the blast and its damage, and
 * the slices applied in the frozen frames are that pass; a blast set off outside a step (a script's `blastAt`) begins at once. One slice per frame in `lateSimulate`.
 */
export function attachBlastPacing(scheduler: Scheduler, pacerOptions: Omit<BlastPacerOptions, keyof BlastPacingOptions> & BlastPacingOptions): BlastPacing {
  const pacer: BlastPacer = createBlastPacer(pacerOptions)
  const pending: Pending[] = []
  let isInStep = false
  scheduler.add(() => void (isInStep = true), { phase: 'fixedSimulate', order: -1_000_000, id: 'room.blast-pacing-step-start' })
  scheduler.add(() => {
    isInStep = false
    for (let next = pending.shift(); next; next = pending.shift()) pacer.begin(next.blast, next.onDone)
  }, { phase: 'fixedSimulate', order: 1999, id: 'room.blast-pacing-begin' })
  scheduler.add(() => {
    if (pacer.isHolding()) pacer.step()
  }, { phase: 'lateSimulate', order: -2000, id: 'room.blast-pacing-slice' })
  return {
    begin(blast, onDone) {
      if (isInStep) pending.push({ blast, onDone })
      else pacer.begin(blast, onDone)
    },
    isHolding: () => pacer.isHolding(),
  }
}
