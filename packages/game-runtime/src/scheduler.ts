import { FRAME_PHASES, type FramePhase } from '@adatechnology/game-contracts'
import { createFrameBudget } from './budget'
import { MICROS_PER_SECOND, defaultClock, toMicros } from './clock'
import { createCommandBuffer } from './commands'
import { createSystemList, type SystemEntry, type SystemList } from './phases'
import type { FrameContext, FrameRunOptions, Scheduler, SchedulerOptions, SchedulerStats, SystemFn, SystemOptions } from './types'

type MutableContext = { -readonly [Key in keyof FrameContext]: FrameContext[Key] }

export function createScheduler(options: SchedulerOptions = {}): Scheduler {
  const fixedDt = options.fixedDt ?? 1 / 60
  const fixedMicros = toMicros(fixedDt)
  const maxSubsteps = options.maxSubsteps ?? 4
  const maxFrameSeconds = options.maxFrameSeconds ?? 0.25
  const snapMicros = Math.round((options.snapMs ?? 0.25) * 1000)
  const clock = options.clock ?? defaultClock()
  const budget = createFrameBudget({ ms: options.budgetMs ?? 4, clock })
  let tick = 0
  let accumulator = 0
  let residual = 0
  let droppedMicros = 0
  let substepsLastFrame = 0
  let running = false
  let paused = false
  let scripted = false
  const reportedErrors = new Set<string>()
  const phaseMs = Object.fromEntries(FRAME_PHASES.map((phase) => [phase, 0])) as Record<FramePhase, number>
  const lists = Object.fromEntries(FRAME_PHASES.map((phase) => [phase, createSystemList(() => running)])) as Record<FramePhase, SystemList>
  let nextSystem = 0
  const ctx: MutableContext = { dt: 0, realDt: 0, fixedDt, alpha: 0, frame: 0, tick: 0, substep: 0, simTime: 0, paused: false, scripted: false, simulated: true }

  const reportError = options.onError ?? ((error: unknown, system: { id: string; phase: FramePhase }): void => {
    if (reportedErrors.has(system.id)) return
    reportedErrors.add(system.id)
    console.error(`game-runtime: system ${system.id} (${system.phase}) threw`, error)
  })

  const runPhase = (phase: FramePhase, dt: number): void => {
    const started = clock()
    ctx.dt = dt
    for (const entry of lists[phase].entries) {
      if (entry.dead) continue
      try {
        entry.fn(ctx)
      } catch (error) {
        reportError(error, { id: entry.id, phase })
      }
    }
    phaseMs[phase] = clock() - started
  }

  const settleAll = (): void => {
    for (const phase of FRAME_PHASES) lists[phase].settle()
  }

  const runFixed = (steps: number): void => {
    const started = clock()
    ctx.dt = fixedDt
    for (let substep = 0; substep < steps; substep++) {
      ctx.substep = substep
      ctx.tick = tick
      for (const entry of lists.fixedSimulate.entries) {
        if (entry.dead) continue
        try {
          entry.fn(ctx)
        } catch (error) {
          reportError(error, { id: entry.id, phase: 'fixedSimulate' })
        }
      }
      tick++
    }
    ctx.substep = 0
    ctx.tick = tick
    phaseMs.fixedSimulate = clock() - started
  }

  const begin = (): void => {
    running = true
    budget.beginFrame()
    ctx.frame++
    ctx.paused = paused
    ctx.scripted = scripted
    ctx.tick = tick
  }

  const end = (): void => {
    running = false
    settleAll()
  }

  const frame = (realSeconds: number, run: FrameRunOptions = {}): void => {
    if (running) throw new Error('scheduler.frame: re-entrant call')
    const simulate = run.simulate !== false
    let seconds = realSeconds
    let micros: number
    if (run.exact) micros = toMicros(realSeconds)
    else {
      seconds = Math.min(realSeconds, maxFrameSeconds)
      micros = toMicros(seconds) + residual
      residual = 0
      const wholeSteps = Math.round(micros / fixedMicros)
      if (snapMicros > 0 && wholeSteps >= 1 && Math.abs(micros - wholeSteps * fixedMicros) <= snapMicros) {
        residual = micros - wholeSteps * fixedMicros
        micros = wholeSteps * fixedMicros
        seconds = wholeSteps * fixedDt
      }
    }
    begin()
    ctx.simulated = simulate
    ctx.realDt = seconds
    const scale = scheduler.timeScale
    ctx.alpha = accumulator / fixedMicros
    substepsLastFrame = 0
    if (simulate) {
      runPhase('input', seconds)
      if (!paused) {
        accumulator += Math.round(micros * scale)
        let steps = Math.floor(accumulator / fixedMicros)
        if (!run.exact && steps > maxSubsteps) {
          droppedMicros += accumulator - maxSubsteps * fixedMicros
          steps = maxSubsteps
          accumulator = maxSubsteps * fixedMicros
        }
        accumulator -= steps * fixedMicros
        substepsLastFrame = steps
        runFixed(steps)
        ctx.alpha = accumulator / fixedMicros
        ctx.simTime += seconds * scale
        runPhase('lateSimulate', seconds * scale)
      }
    }
    ctx.alpha = accumulator / fixedMicros
    runPhase('present', paused ? 0 : seconds * scale)
    budget.drain('present')
    if (run.render !== false) runPhase('render', seconds)
    runPhase('idle', seconds)
    budget.drain('idle')
    ctx.simulated = true
    end()
  }

  const advance = (seconds: number, advanceOptions: { readonly dt?: number } = {}): void => {
    if (running) throw new Error('scheduler.advance: re-entrant call')
    const dt = advanceOptions.dt ?? fixedDt
    const iterations = Math.max(1, Math.round(seconds / dt))
    const steps = Math.max(1, Math.round(dt / fixedDt))
    const wasUnbounded = budget.unbounded
    budget.unbounded = true
    scripted = true
    accumulator = 0
    residual = 0
    scheduler.commands.clear()
    try {
      for (let i = 0; i < iterations; i++) {
        begin()
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
        end()
      }
    } finally {
      running = false
      scripted = false
      ctx.scripted = false
      budget.unbounded = wasUnbounded
      accumulator = 0
      ctx.alpha = 0
    }
  }

  const scheduler: Scheduler = {
    add(system: SystemFn, systemOptions: SystemOptions) {
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
    timeScale: 1,
    resetClock() {
      accumulator = 0
      residual = 0
    },
    budget,
    commands: createCommandBuffer(() => tick),
    stats(): SchedulerStats {
      return { frame: ctx.frame, tick, substepsLastFrame, droppedSeconds: droppedMicros / MICROS_PER_SECOND, phaseMs: { ...phaseMs }, budget: budget.stats() }
    },
    dispose() {
      budget.dispose()
      for (const phase of FRAME_PHASES) for (const entry of lists[phase].entries) entry.dead = true
      settleAll()
    },
  }
  return scheduler
}
