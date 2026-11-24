import { createBlastPacer } from '@adatechnology/game-destruction-three'
import type { BlastPacer, BlastPacerOptions, PacedBlast } from '@adatechnology/game-destruction-three'
import type { DestructionWorld, HitResult } from '@adatechnology/game-destruction'
import type { SystemRegistry } from './simulation-phases'

/** `KitWorldOptions.blastPacing`: spread a large blast over frames with the world held (spec 018 D2); the counts per frame, each with its default. */
export type BlastPacingOptions = Pick<BlastPacerOptions, 'raysPerFrame' | 'wavePartsPerFrame' | 'unitsPerFrame'>

export type BlastPacing = {
  /** Sets a blast off through the pacer; `onDone` gets its results when it ends. Asked inside a fixed step, it begins at the end of that step's simulation. */
  readonly begin: (blast: PacedBlast, onDone: (results: HitResult[]) => void) => void
  /** The room's scheduler holds its fixed steps on it (`holdFixed`). */
  readonly isHolding: () => boolean
  /** Drops every open blast and blast asked in the step, and both holds (`BlastPacer.clear`): the room is clearing or resetting its world. */
  readonly clear: () => void
  /** Registers the pacer's systems on the room's scheduler (`registerSimulationPhases` does it). */
  readonly attach: (scheduler: SystemRegistry) => void
}

type Pending = { readonly blast: PacedBlast; readonly onDone: (results: HitResult[]) => void }

/**
 * The room's side of the pacer, or undefined with pacing off. A blast set off inside a fixed step waits for the end of that step's simulation (its world update and
 * its physics step) and begins there, right before the step's last structural pass (`room.structural-events`, order 2000); with the pacer holding no step runs between
 * the blast and its damage, and the slices applied in the frozen frames stand for that pass. That puts the blast one step part later than without the pacer (spec 018
 * D2: after that step's world update and physics step instead of inside the explosives' update). A blast set off outside a step (a script's `blastAt`) begins at once,
 * the same bytes as without the pacer. One slice per frame in `lateSimulate`. A scenario's `advance` (scripted, never held; its legacy step runs the simulation in
 * `lateSimulate`) sets its blasts off whole, as without the pacer.
 */
export function createBlastPacing(options: BlastPacingOptions | false | undefined, deps: { readonly world: BlastPacerOptions['world'] & Pick<DestructionWorld, 'explode'>; readonly renderer: BlastPacerOptions['renderer'] }): BlastPacing | undefined {
  if (!options) return undefined
  const pacer: BlastPacer = createBlastPacer({ ...deps, ...options })
  const pending: Pending[] = []
  let isInStep = false
  let isScripted = false
  return {
    begin(blast, onDone) {
      // a scenario steps the world itself (`scheduler.advance`, never held): its blasts go off whole, as without the pacer
      if (isScripted) return onDone(deps.world.explode(blast.point, blast.energy, blast.radius, blast.source, blast.options))
      if (isInStep) pending.push({ blast, onDone })
      else pacer.begin(blast, onDone)
    },
    isHolding: () => pacer.isHolding(),
    clear() {
      pending.length = 0
      pacer.clear()
    },
    attach(scheduler) {
      scheduler.add((ctx) => void (isScripted = ctx.scripted), { phase: 'input', order: -1_000_000, id: 'room.blast-pacing-scripted' })
      scheduler.add(() => void (isInStep = true), { phase: 'fixedSimulate', order: -1_000_000, id: 'room.blast-pacing-step-start' })
      scheduler.add(() => {
        isInStep = false
        // taken first: a blast that throws in its begin leaves the others of the step to begin, not to wait a tick
        const asked = pending.splice(0, pending.length)
        let failure: { readonly error: unknown } | undefined
        for (const next of asked) {
          try {
            pacer.begin(next.blast, next.onDone)
          } catch (error) {
            failure ??= { error }
          }
        }
        if (failure) throw failure.error
      }, { phase: 'fixedSimulate', order: 1999, id: 'room.blast-pacing-begin' })
      scheduler.add(() => {
        if (pacer.isHolding()) pacer.step()
      }, { phase: 'lateSimulate', order: -2000, id: 'room.blast-pacing-slice' })
    },
  }
}
