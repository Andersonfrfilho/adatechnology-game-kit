import { FRAME_PHASES, type FramePhase } from '@adatechnology/game-contracts'
import { createFrameBudget } from './budget'
import { MICROS_PER_SECOND, defaultClock, toMicros } from './clock'
import { createCommandBuffer } from './commands'
import { resolveFrameTime, sanitizeSeconds, sanitizeTimeScale } from './frame-time'
import { createPhaseRunner, type MutableContext } from './phase-runner'
import { createSystemList, type SystemEntry, type SystemList } from './phases'
import type { FrameRunOptions, Scheduler, SchedulerOptions, SchedulerStats, SystemFn, SystemOptions } from './types'

export function createScheduler(options: SchedulerOptions = {}): Scheduler {
  const fixedDt = options.fixedDt ?? 1 / 60
  const fixedMicros = toMicros(fixedDt)
  const maxSubsteps = options.maxSubsteps ?? 4
  const timeConfig = { fixedMicros, fixedDt, maxFrameSeconds: options.maxFrameSeconds ?? 0.25, snapMicros: Math.round((options.snapMs ?? 0.25) * 1000) }
  const clock = options.clock ?? defaultClock()
  let accumulator = 0
  let residual = 0
  let droppedMicros = 0
  let substepsLastFrame = 0
  let running = false
  let disposed = false
  let paused = false
  let scripted = false
  let timeScale = 1
  let nextSystem = 0
  const reportedErrors = new Set<string>()
  const lists = Object.fromEntries(FRAME_PHASES.map((phase) => [phase, createSystemList(() => running)])) as Record<FramePhase, SystemList>
  const ctx: MutableContext = { dt: 0, realDt: 0, fixedDt, alpha: 0, frame: 0, tick: 0, substep: 0, simTime: 0, paused: false, scripted: false, simulated: true }

  const reportError =
    options.onError ??
    ((error: unknown, system: { id: string; phase: FramePhase }): void => {
      if (reportedErrors.has(system.id)) return
      reportedErrors.add(system.id)
      console.error(`game-runtime: system ${system.id} (${system.phase}) threw`, error)
    })
  const budget = createFrameBudget({ ms: options.budgetMs ?? 4, clock, onError: (error, queue) => reportError(error, { id: `queue:${queue.id}`, phase: queue.phase }) })
  const runner = createPhaseRunner({ clock, ctx, lists, reportError, fixedDt })
  const { runPhase, runFixed } = runner

  const settleAll = (): void => {
    for (const phase of FRAME_PHASES) lists[phase].settle()
  }

  const begin = (): void => {
    running = true
    budget.beginFrame()
    ctx.frame++
    ctx.paused = paused
    ctx.scripted = scripted
    ctx.tick = runner.tick
  }

  const end = (): void => {
    running = false
    settleAll()
  }

  /** The input phase and, unless paused, the fixed steps and the late phase; `micros` is the real time to feed the accumulator. */
  const simulate = (seconds: number, micros: number, exact: boolean): void => {
    runPhase('input', seconds)
    if (paused) return
    accumulator += Math.round(micros * timeScale)
    let steps = Math.floor(accumulator / fixedMicros)
    if (!exact && steps > maxSubsteps) {
      droppedMicros += accumulator - maxSubsteps * fixedMicros
      steps = maxSubsteps
      accumulator = maxSubsteps * fixedMicros
    }
    accumulator -= steps * fixedMicros
    substepsLastFrame = steps
    runFixed(steps)
    ctx.alpha = accumulator / fixedMicros
    ctx.simTime += seconds * timeScale
    runPhase('lateSimulate', seconds * timeScale)
  }

  const frame = (realSeconds: number, run: FrameRunOptions = {}): void => {
    if (running) throw new Error('scheduler.frame: re-entrant call')
    if (disposed) throw new Error('scheduler.frame: the scheduler was disposed')
    const time = resolveFrameTime(realSeconds, run.exact === true, residual, timeConfig)
    residual = time.residual
    const seconds = time.seconds
    begin()
    try {
      ctx.simulated = run.simulate !== false
      ctx.realDt = seconds
      ctx.alpha = accumulator / fixedMicros
      substepsLastFrame = 0
      if (ctx.simulated) simulate(seconds, time.micros, run.exact === true)
      ctx.alpha = accumulator / fixedMicros
      runPhase('present', paused ? 0 : seconds * timeScale)
      budget.drain('present')
      if (run.render !== false) runPhase('render', seconds)
      runPhase('idle', seconds)
      budget.drain('idle')
    } finally {
      ctx.simulated = true
      end()
    }
  }

  const advanceStep = (dt: number, steps: number): void => {
    begin()
    try {
      ctx.simulated = true
      ctx.realDt = dt
      ctx.alpha = 0
      runPhase('input', dt)
      if (!paused) {
        runFixed(steps)
        ctx.simTime += dt
        runPhase('lateSimulate', dt)
      }
      runPhase('present', paused ? 0 : dt)
      budget.drain('present')
      runPhase('idle', dt)
      budget.drain('idle')
    } finally {
      end()
    }
  }

  const advance = (seconds: number, advanceOptions: { readonly dt?: number } = {}): void => {
    if (running) throw new Error('scheduler.advance: re-entrant call')
    if (disposed) throw new Error('scheduler.advance: the scheduler was disposed')
    const dt = sanitizeSeconds(advanceOptions.dt ?? fixedDt) || fixedDt
    const iterations = Math.max(1, Math.round(sanitizeSeconds(seconds) / dt))
    const steps = Math.max(1, Math.round(dt / fixedDt))
    const wasUnbounded = budget.unbounded
    budget.unbounded = true
    scripted = true
    accumulator = 0
    residual = 0
    scheduler.commands.clear()
    try {
      for (let i = 0; i < iterations; i++) advanceStep(dt, steps)
    } finally {
      scripted = false
      ctx.scripted = false
      budget.unbounded = wasUnbounded
      accumulator = 0
      ctx.alpha = 0
    }
  }

  const scheduler: Scheduler = {
    add(system: SystemFn, systemOptions: SystemOptions) {
      if (disposed) return () => undefined
      const entry: SystemEntry = {
        id: systemOptions.id ?? `${systemOptions.phase}#${nextSystem++}`,
        phase: systemOptions.phase,
        fn: system,
        order: systemOptions.order ?? 0,
        dead: false,
      }
      lists[entry.phase].add(entry)
      return () => lists[entry.phase].remove(entry)
    },
    frame,
    advance,
    pause() {
      paused = true
    },
    resume() {
      paused = false
    },
    get paused() {
      return paused
    },
    get timeScale() {
      return timeScale
    },
    set timeScale(value: number) {
      timeScale = sanitizeTimeScale(value)
    },
    resetClock() {
      accumulator = 0
      residual = 0
    },
    budget,
    commands: createCommandBuffer(() => runner.tick),
    stats(): SchedulerStats {
      return { frame: ctx.frame, tick: runner.tick, substepsLastFrame, droppedSeconds: droppedMicros / MICROS_PER_SECOND, phaseMs: { ...runner.phaseMs }, budget: budget.stats() }
    },
    dispose() {
      disposed = true
      budget.dispose()
      for (const phase of FRAME_PHASES) lists[phase].clear()
      settleAll()
    },
  }
  return scheduler
}
