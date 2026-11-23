import { FRAME_PHASES, type FramePhase } from '@adatechnology/game-contracts'
import type { SystemList } from './phases'
import type { FrameContext, SystemProbe } from './types'

export type MutableContext = { -readonly [Key in keyof FrameContext]: FrameContext[Key] }

export interface PhaseRunnerDeps {
  readonly clock: () => number
  readonly ctx: MutableContext
  readonly lists: Readonly<Record<FramePhase, SystemList>>
  readonly fixedDt: number
  readonly probe: () => SystemProbe | undefined
  readonly reportError: (error: unknown, system: { id: string; phase: FramePhase }) => void
}

export interface PhaseRunner {
  runPhase(phase: FramePhase, dt: number): void
  /** Runs `steps` fixed steps of the `fixedSimulate` phase. */
  /** Runs up to `steps` fixed steps, stopping before one when `isHeld` says so; returns the steps run. */
  runFixed(steps: number, isHeld?: () => boolean): number
  /** Fixed steps run since start. */
  readonly tick: number
  readonly phaseMs: Readonly<Record<FramePhase, number>>
}

/** Runs the systems of a phase, one at a time: a system that throws is reported and the rest of the phase goes on. */
export function createPhaseRunner(deps: PhaseRunnerDeps): PhaseRunner {
  const { clock, ctx, lists, reportError, fixedDt, probe } = deps
  const phaseMs = Object.fromEntries(FRAME_PHASES.map((phase) => [phase, 0])) as Record<FramePhase, number>
  let tick = 0

  const runEntries = (phase: FramePhase): void => {
    for (const entry of lists[phase].entries) {
      if (entry.dead) continue
      const watcher = probe()
      watcher?.enter(entry.id)
      try {
        entry.fn(ctx)
      } catch (error) {
        reportError(error, { id: entry.id, phase })
      } finally {
        watcher?.leave(entry.id)
      }
    }
  }

  return {
    runPhase(phase, dt) {
      const started = clock()
      ctx.dt = dt
      runEntries(phase)
      phaseMs[phase] = clock() - started
    },
    runFixed(steps, isHeld) {
      const started = clock()
      ctx.dt = fixedDt
      let ran = 0
      for (let substep = 0; substep < steps; substep++) {
        if (isHeld?.()) break
        ran++
        ctx.substep = substep
        ctx.tick = tick
        runEntries('fixedSimulate')
        tick++
      }
      ctx.substep = 0
      ctx.tick = tick
      phaseMs.fixedSimulate = clock() - started
      return ran
    },
    get tick() {
      return tick
    },
    phaseMs,
  }
}
