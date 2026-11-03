import { createSemiSimDriver, createSurfaces, semiSpecFromStats } from '@adatechnology/game-vehicles-driving'
import type { SemiDriver, SemiSimSpec, SurfaceRegistry } from '@adatechnology/game-vehicles-driving'

import { inRange } from './ranges'
import type { ProvingMemo, ProvingResult, ProvingSubject, ProvingTest } from './types'

/** The semi-simulation spec the runner drives a subject with: from the card's ratings and the body, with the subject's own overrides. */
export const subjectSpec = (subject: ProvingSubject): SemiSimSpec => ({ ...semiSpecFromStats(subject.stats, subject.body), ...subject.spec })

/** One measured test in progress. A host steps it with the frame's seconds and draws `driver.state`; `runTest` steps it to the end in one go. */
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
  step(dt: number): void
  /** The result so far; pending while the run has not ended. */
  result(): ProvingResult
}

export interface RunOptions {
  surfaces?: SurfaceRegistry
  /** Seconds between two trace samples (default 0.1). */
  sampleEvery?: number
  /** Fixed step of the simulation (default 1/120 s); `step(dt)` splits the frame into steps this long. */
  fixedStep?: number
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
  let carry = 0
  const tick = (h: number): void => {
    const input = procedure.input(driver.state, time, memo)
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
    step(dt) {
      carry += dt
      while (!done && carry >= fixed) {
        carry -= fixed
        tick(fixed)
      }
    },
    result() {
      const range = test.range?.(subject) ?? {}
      const base = { test: test.id, kind: test.kind, unit: test.unit, range, trace: [...trace] }
      if (!done) return { ...base, verdict: 'pending', value: null, note: 'running' }
      const value = procedure.value(driver.state, time, memo)
      const lowered = memo.target > 0 && /_100|_80/.test(test.id) && memo.target < (test.id.includes('80') ? 80 : 100)
      const note = lowered ? `target ${memo.target} km/h` : undefined
      if (value == null) return { ...base, verdict: 'fail', value: null, note: `did not finish in ${procedure.maxSeconds} s` }
      return { ...base, verdict: inRange(value, range) ? 'pass' : 'fail', value, ...(note ? { note } : {}) }
    },
  }
}

/** Runs a measured test to its end and returns the result. */
export function runTest(test: ProvingTest, subject: ProvingSubject, options: RunOptions = {}): ProvingResult {
  const run = startRun(test, subject, options)
  const fixed = options.fixedStep ?? 1 / 120
  while (!run.done) run.step(fixed * 60)
  return run.result()
}
