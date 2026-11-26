import { createScheduler } from '@adatechnology/game-runtime'
import type { Scheduler } from '@adatechnology/game-runtime'
import { createSemiSimDriver, createSurfaces, semiSpecFromStats } from '@adatechnology/game-vehicles-driving'
import type { SemiDriver, SemiInput, SemiSimSpec, SemiState, SurfaceRegistry } from '@adatechnology/game-vehicles-driving'

import { inRange } from './ranges'
import type { ProvingMemo, ProvingResult, ProvingSubject, ProvingTest } from './types'

/** The semi-simulation spec the runner drives a subject with: from the card's ratings and the body, with the subject's own overrides. */
export const subjectSpec = (subject: ProvingSubject): SemiSimSpec => ({ ...semiSpecFromStats(subject.stats, subject.body), ...subject.spec })

/** Physics steps of one scheduler tick (1/60 s): the proving run steps its driver at twice the tick, as the room's physics loop does. */
export const STEPS_PER_TICK = 2

/**
 * One measured test in progress. It owns no clock: a host registers `stepFixed(STEPS_PER_TICK)` in its scheduler's `fixedSimulate` and draws `driver.state`;
 * standalone (tests, CLI) the caller drives `stepFixed` or the thin `advance(seconds)`. `runTest` steps it to the end in one go.
 */
export interface ProvingRun {
  readonly test: ProvingTest
  readonly subject: ProvingSubject
  readonly driver: SemiDriver
  readonly surface: string
  readonly time: number
  readonly done: boolean
  /** [seconds, sample] of the run so far. */
  readonly trace: ReadonlyArray<[number, number]>
  readonly memo: ProvingMemo
  /** What the procedure asked of the controls on the last step (all zero before the first): a host plays the brakes and the engine from it. */
  readonly input: SemiInput
  /** Seconds of one physics step (`RunOptions.fixedStep`, default 1/120). */
  readonly fixedStep: number
  /** Runs `steps` physics steps now (stops at the end of the run); no accumulator, no time scale: the caller's scheduler decides how many. */
  stepFixed(steps: number): void
  /** Standalone helper: feeds `seconds` to a private `game-runtime` scheduler (exact, no render) whose fixed tick runs `STEPS_PER_TICK` steps; the remainder waits for the next call. */
  advance(seconds: number): void
  /** The result so far; pending while the run has not ended. */
  result(): ProvingResult
}

export interface RunOptions {
  surfaces?: SurfaceRegistry
  /** Seconds between two trace samples (default 0.1). */
  sampleEvery?: number
  /** Fixed step of the simulation (default 1/120 s): the seconds one `stepFixed` step integrates. */
  fixedStep?: number
}

/** What a measured test's result is made from: shared by the semi-simulation run and the physics-engine run. */
export interface ResultInput {
  readonly test: ProvingTest
  readonly subject: ProvingSubject
  readonly memo: ProvingMemo
  readonly trace: ReadonlyArray<[number, number]>
  readonly done: boolean
  readonly state: SemiState
  readonly time: number
}

export function resultOf({ test, subject, memo, trace, done, state, time }: ResultInput): ProvingResult {
  const procedure = test.procedure
  if (!procedure) throw new Error(`resultOf: ${test.id} is not a measured test`)
  const range = test.range?.(subject) ?? {}
  const base = { test: test.id, kind: test.kind, unit: test.unit, range, trace: [...trace] }
  if (!done) return { ...base, verdict: 'pending', value: null, note: 'running' }
  const value = procedure.value(state, time, memo)
  const lowered = memo.target > 0 && /_100|_80/.test(test.id) && memo.target < (test.id.includes('80') ? 80 : 100)
  const note = lowered ? `target ${memo.target} km/h` : undefined
  if (value == null) return { ...base, verdict: 'fail', value: null, note: `did not finish in ${procedure.maxSeconds} s` }
  return { ...base, verdict: inRange(value, range) ? 'pass' : 'fail', value, ...(note ? { note } : {}) }
}

export function startRun(test: ProvingTest, subject: ProvingSubject, options: RunOptions = {}): ProvingRun {
  const procedure = test.procedure
  if (test.kind !== 'measured' || !procedure) throw new Error(`startRun: ${test.id} is not a measured test`)
  const surfaces = options.surfaces ?? createSurfaces()
  const driver = createSemiSimDriver(subjectSpec(subject), { surfaces })
  driver.place(0, 0, 0)
  const surface = procedure.surface ?? 'dry_asphalt'
  const world = { ground: () => ({ surface }) }
  const memo: ProvingMemo = { target: procedure.target?.(subject) ?? 0, subject }
  const trace: Array<[number, number]> = []
  const sampleEvery = options.sampleEvery ?? 0.1
  const fixed = options.fixedStep ?? 1 / 120
  let time = 0
  let done = false
  let nextSample = 0
  let scheduler: Scheduler | undefined
  let last: SemiInput = { throttle: 0, brake: 0, steer: 0, handbrake: false }
  const tick = (h: number): void => {
    const input = procedure.input(driver.state, time, memo)
    last = input
    driver.step(input, h, world)
    time += h
    if (time >= nextSample) {
      trace.push([Math.round(time * 1000) / 1000, procedure.sample(driver.state, time, memo)])
      nextSample += sampleEvery
    }
    if (procedure.finished(driver.state, time, memo) || time >= procedure.maxSeconds) done = true
  }
  return {
    test,
    subject,
    driver,
    surface,
    memo,
    get time() {
      return time
    },
    get done() {
      return done
    },
    get trace() {
      return trace
    },
    get input() {
      return last
    },
    fixedStep: fixed,
    stepFixed(steps) {
      for (let i = 0; i < steps && !done; i++) tick(fixed)
    },
    advance(seconds) {
      if (!scheduler) {
        scheduler = createScheduler({ fixedDt: fixed * STEPS_PER_TICK })
        scheduler.add(() => this.stepFixed(STEPS_PER_TICK), { phase: 'fixedSimulate', id: 'proving.run' })
      }
      scheduler.frame(seconds, { exact: true, render: false })
    },
    result() {
      return resultOf({ test, subject, memo, trace, done, state: driver.state, time })
    },
  }
}

/** Runs a measured test to its end and returns the result. */
export function runTest(test: ProvingTest, subject: ProvingSubject, options: RunOptions = {}): ProvingResult {
  const run = startRun(test, subject, options)
  while (!run.done) run.stepFixed(STEPS_PER_TICK)
  return run.result()
}
