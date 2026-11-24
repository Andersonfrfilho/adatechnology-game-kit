import type { Scheduler } from '@adatechnology/game-runtime'

export type SystemRegistry = Pick<Scheduler, 'add'>

/** Physics steps (of the world's `fixedStep`) in one scheduler tick. */
export const STEPS_PER_TICK = 2
/** Ticks one frame may run: 3 ticks of 1/60 s are the 6 steps of 1/120 s the room has always allowed in a 50 ms frame. */
export const MAX_TICKS_PER_FRAME = 3
const TICK_TOLERANCE_SECONDS = 1e-6

export type SimulationHooks = {
  /** The simulation that runs once per tick; `isTick` is false when a synchronous `update(dt)` with another `dt` runs it once with that `dt`. */
  readonly fixed: (dt: number, isTick: boolean) => void
  readonly frame: (dt: number) => void
  readonly frameEnd: (dt: number) => void
  /** What draws the simulation between two ticks: the step pose back at the start of a tick, the blend at `present`. */
  readonly pose: { readonly restoreStepPose: () => void; readonly present: (alpha: number) => void }
  /** The destruction events that change the simulation apply in the tick on the step pose, never in the frame's `present`: those queued outside the tick before its step, those its step emitted at its end. */
  readonly structural: { readonly setStructuralInTick: (isInTick: boolean) => void; readonly applyStructuralEvents: () => void }
  /** The world's blast pacing: its systems go on the same scheduler. */
  readonly blastPacing?: { readonly attach: (scheduler: SystemRegistry) => void } | undefined
}

export type SimulationPhases = {
  /** Runs a synchronous frame (a live one, from the display loop's clock, always takes the tick path); a `dt` that is not one tick keeps the pre-tick path: the whole simulation once, in `lateSimulate`, with that `dt`. */
  readonly runAt: (dt: number, run: (dt: number) => void, isLive?: boolean) => void
}

/** The tick the room's rules advance by: `STEPS_PER_TICK` steps of the physics loop, or `nominalTick` with no loop; throws when the loop's step does not fit it. */
export function resolveSimulationTick(loopStep: number | undefined, nominalTick: number): number {
  if (loopStep === undefined) return nominalTick
  if (Math.abs(STEPS_PER_TICK * loopStep - nominalTick) > 1e-9) throw new Error(`world: ${STEPS_PER_TICK} physics steps of ${loopStep} s are not the world tick of ${nominalTick} s`)
  return STEPS_PER_TICK * loopStep
}

// the ids keep the `room.` prefix: the per-module tables, the order test and the error handler of the room read them
export function registerSimulationPhases(scheduler: SystemRegistry, tick: number, hooks: SimulationHooks): SimulationPhases {
  hooks.blastPacing?.attach(scheduler)
  let isLegacyStep = false
  let isSynchronousFrame = false
  // before `input`: the player's actions (push, carry, doors) write on the step pose, never on last frame's blend
  scheduler.add(() => hooks.pose.restoreStepPose(), { phase: 'input', order: -100000, id: 'room.pose-restore-input' })
  // a frame of the legacy path has no tick to apply them in: its drain applies them
  scheduler.add(() => hooks.structural.setStructuralInTick(!isLegacyStep), { phase: 'input', order: -100000, id: 'room.structural-mode' })
  scheduler.add(() => hooks.pose.restoreStepPose(), { phase: 'fixedSimulate', order: -100000, id: 'room.pose-restore' })
  scheduler.add(() => hooks.pose.restoreStepPose(), { phase: 'lateSimulate', order: -100000, id: 'room.pose-restore-late' })
  scheduler.add(
    (ctx) => {
      // a frame drawn at the step pose changes nothing: the host may have moved a root since (a held piece) and a blend would write the old step pose over it
      if (!isSynchronousFrame && !ctx.scripted) hooks.pose.present(ctx.alpha)
    },
    { phase: 'present', order: -1000, id: 'room.pose-present' },
  )
  // before the step: events queued outside a tick (a blast spread over frozen frames) create bodies that take part in this tick's step (spec 018 D2)
  scheduler.add(() => {
    if (!isLegacyStep) hooks.structural.applyStructuralEvents()
  }, { phase: 'fixedSimulate', order: -1000, id: 'room.structural-events-before-step' })
  scheduler.add((ctx) => {
    if (!isLegacyStep) hooks.fixed(ctx.dt, true)
  }, { phase: 'fixedSimulate', order: 1000, id: 'room.simulate' })
  // after the step: events the step itself emitted (a fuse, a collapse) still land in their own tick, so damage never trails the flash
  scheduler.add(() => {
    if (!isLegacyStep) hooks.structural.applyStructuralEvents()
  }, { phase: 'fixedSimulate', order: 2000, id: 'room.structural-events' })
  scheduler.add((ctx) => {
    if (isLegacyStep && !ctx.fixedFrozen) hooks.fixed(ctx.dt, false)
    hooks.frame(ctx.dt)
  }, { phase: 'lateSimulate', order: -1000, id: 'room.simulate-frame' })
  scheduler.add((ctx) => hooks.frameEnd(ctx.dt), { phase: 'lateSimulate', order: 1000, id: 'room.simulate-end' })
  return {
    runAt(dt, run, isLive = false) {
      isLegacyStep = !isLive && Math.abs(dt - tick) > TICK_TOLERANCE_SECONDS
      isSynchronousFrame = !isLive
      try {
        run(dt)
      } finally {
        isLegacyStep = false
        isSynchronousFrame = false
      }
    },
  }
}
