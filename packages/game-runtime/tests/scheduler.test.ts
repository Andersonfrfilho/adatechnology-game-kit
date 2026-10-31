import { describe, expect, it } from 'vitest'
import { FRAME_PHASES, type FramePhase } from '@adatechnology/game-contracts'
import { createScheduler } from '../src'
import type { FrameContext, Scheduler } from '../src'

const H = 1 / 60

const recorder = (scheduler: Scheduler): string[] => {
  const log: string[] = []
  for (const phase of FRAME_PHASES) scheduler.add(() => log.push(phase), { phase })
  return log
}

describe('phases', () => {
  it('runs input, the fixed steps, late, present, render and idle in order, and render:false skips only render', () => {
    const scheduler = createScheduler({ snapMs: 0 })
    const log = recorder(scheduler)
    scheduler.frame(2 * H + 0.0001)
    expect(log).toEqual(['input', 'fixedSimulate', 'fixedSimulate', 'lateSimulate', 'present', 'render', 'idle'])
    log.length = 0
    scheduler.frame(H, { render: false })
    expect(log).toEqual(['input', 'fixedSimulate', 'lateSimulate', 'present', 'idle'])
  })

  it('orders by `order` and then by registration', () => {
    const scheduler = createScheduler()
    const log: string[] = []
    scheduler.add(() => log.push('b0'), { phase: 'input' })
    scheduler.add(() => log.push('a-5'), { phase: 'input', order: -5 })
    scheduler.add(() => log.push('c0'), { phase: 'input' })
    scheduler.add(() => log.push('d9'), { phase: 'input', order: 9 })
    scheduler.frame(H)
    expect(log).toEqual(['a-5', 'b0', 'c0', 'd9'])
  })

  it('lets a system added during a frame start next frame and removes a system at once', () => {
    const scheduler = createScheduler()
    const log: string[] = []
    let removeSecond = (): void => undefined
    scheduler.add(
      () => {
        log.push('first')
        removeSecond()
        scheduler.add(() => log.push('added'), { phase: 'input' })
      },
      { phase: 'input', id: 'first' },
    )
    removeSecond = scheduler.add(() => log.push('second'), { phase: 'input' })
    scheduler.frame(H)
    expect(log).toEqual(['first'])
    log.length = 0
    scheduler.frame(H)
    expect(log).toContain('added')
    expect(log).not.toContain('second')
  })

  it('keeps the frame going when a system throws and reports it once per id', () => {
    const errors: string[] = []
    const scheduler = createScheduler({ onError: (_error, system) => errors.push(system.id) })
    const log = recorder(scheduler)
    scheduler.add(() => {
      throw new Error('boom')
    }, { phase: 'input', id: 'bad' })
    scheduler.frame(H)
    expect(log).toContain('idle')
    expect(errors).toEqual(['bad'])
  })

  it('refuses advance from inside a system', () => {
    const errors: unknown[] = []
    const scheduler = createScheduler({ onError: (error) => errors.push(error) })
    scheduler.add(() => scheduler.advance(1), { phase: 'input' })
    scheduler.frame(H)
    expect(String(errors[0])).toContain('re-entrant')
  })
})

describe('fixed step', () => {
  it('caps the substeps, drops the rest and never spirals', () => {
    const scheduler = createScheduler({ maxFrameSeconds: 1, snapMs: 0 })
    let steps = 0
    scheduler.add(() => steps++, { phase: 'fixedSimulate' })
    scheduler.frame(1)
    expect(steps).toBe(4)
    expect(scheduler.stats().droppedSeconds).toBeCloseTo(1 - 4 / 60, 5)
  })

  it('runs exactly 60 steps for 60 frames of 1/60 (integer accumulator)', () => {
    const scheduler = createScheduler()
    let steps = 0
    scheduler.add(() => steps++, { phase: 'fixedSimulate' })
    for (let i = 0; i < 60; i++) scheduler.frame(H)
    expect(steps).toBe(60)
  })

  it('gives alpha as the remainder over the fixed step, in [0, 1)', () => {
    const scheduler = createScheduler({ snapMs: 0 })
    const alphas: number[] = []
    scheduler.add((ctx) => alphas.push(ctx.alpha), { phase: 'present' })
    scheduler.frame(1.5 * H)
    scheduler.frame(0.25 * H)
    expect(alphas[0]).toBeCloseTo(0.5, 3)
    expect(alphas[1]).toBeCloseTo(0.75, 3)
    expect(alphas.every((alpha) => alpha >= 0 && alpha < 1)).toBe(true)
  })

  it('snaps a frame within 0.25 ms of a whole step and keeps the total time', () => {
    const scheduler = createScheduler()
    const stepsPerFrame: number[] = []
    let steps = 0
    scheduler.add(() => steps++, { phase: 'fixedSimulate' })
    scheduler.add(() => stepsPerFrame.push(steps), { phase: 'present' })
    const frames = Array.from({ length: 600 }, (_, i) => (i % 2 === 0 ? 0.0165 : 0.016834))
    for (const seconds of frames) scheduler.frame(seconds)
    expect(stepsPerFrame.every((count, i) => count === i + 1)).toBe(true)

    const plain = createScheduler({ snapMs: 0 })
    let plainSteps = 0
    plain.add(() => plainSteps++, { phase: 'fixedSimulate' })
    for (const seconds of frames) plain.frame(seconds)
    const total = frames.reduce((sum, seconds) => sum + seconds, 0)
    expect(Math.abs(steps * H - total)).toBeLessThan(0.0005)
    expect(Math.abs(plainSteps * H - total)).toBeLessThan(H)
  })

  it('does not snap a 20 ms frame', () => {
    const scheduler = createScheduler()
    const dts: number[] = []
    scheduler.add((ctx) => dts.push(ctx.realDt), { phase: 'input' })
    scheduler.frame(0.02)
    expect(dts[0]).toBeCloseTo(0.02, 6)
  })
})

describe('determinism', () => {
  it('gives the same hash at the same tick at 30, 60, 144 fps and with jitter', () => {
    const hashAt = (frameSeconds: () => number): number => {
      const scheduler = createScheduler({ snapMs: 0, maxSubsteps: 100, maxFrameSeconds: 1 })
      let state = 12345
      let hash = 0
      scheduler.add(
        (ctx) => {
          if (ctx.tick >= 600) return
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0
          const commands = scheduler.commands.take(ctx.tick)
          hash = (Math.imul(hash ^ state, 31) + ctx.tick + commands.length * 7) >>> 0
        },
        { phase: 'fixedSimulate' },
      )
      for (let tick = 3; tick < 1000; tick += 13) scheduler.commands.push('fire', undefined, tick)
      while (scheduler.stats().tick < 600) scheduler.frame(frameSeconds())
      return hash
    }
    let jitterState = 7
    const jitter = (): number => {
      jitterState = (Math.imul(jitterState, 1103515245) + 12345) >>> 0
      return 0.008 + (jitterState / 0xffffffff) * 0.032
    }
    const reference = hashAt(() => 1 / 60)
    expect(hashAt(() => 1 / 30)).toBe(reference)
    expect(hashAt(() => 1 / 144)).toBe(reference)
    expect(hashAt(jitter)).toBe(reference)
  })
})

describe('commands', () => {
  it('shows a command in input at the next fixed tick, never the same one, and keeps order', () => {
    const scheduler = createScheduler({ snapMs: 0 })
    const seen: Array<{ tick: number; kinds: string[] }> = []
    scheduler.add(() => scheduler.commands.push(scheduler.stats().frame === 1 ? 'a' : 'x'), { phase: 'input' })
    scheduler.add(() => scheduler.commands.push(scheduler.stats().frame === 1 ? 'b' : 'y'), { phase: 'input' })
    scheduler.add((ctx) => seen.push({ tick: ctx.tick, kinds: scheduler.commands.take(ctx.tick).map((command) => command.kind) }), { phase: 'fixedSimulate' })
    scheduler.frame(H)
    expect(seen[0]).toEqual({ tick: 0, kinds: ['a', 'b'] })
    scheduler.frame(H)
    expect(seen[1]?.kinds).toEqual(['x', 'y'])
  })

  it('keeps a command for the next frame that has a substep', () => {
    const scheduler = createScheduler({ snapMs: 0 })
    const seen: string[][] = []
    scheduler.add(() => scheduler.commands.push('wait'), { phase: 'input', id: 'push-once' })
    scheduler.add((ctx) => seen.push(scheduler.commands.take(ctx.tick).map((command) => command.kind)), { phase: 'fixedSimulate' })
    scheduler.frame(H / 4)
    expect(seen).toEqual([])
    scheduler.frame(H)
    expect(seen[0]?.length).toBeGreaterThanOrEqual(1)
  })
})

describe('pause and time scale', () => {
  const collect = (scheduler: Scheduler): Record<FramePhase, FrameContext[]> => {
    const byPhase = Object.fromEntries(FRAME_PHASES.map((phase) => [phase, [] as FrameContext[]])) as Record<FramePhase, FrameContext[]>
    for (const phase of FRAME_PHASES) scheduler.add((ctx) => byPhase[phase].push({ ...ctx }), { phase })
    return byPhase
  }

  it('does not run fixed or late while paused, gives input the real dt and present dt 0', () => {
    const scheduler = createScheduler({ snapMs: 0 })
    const byPhase = collect(scheduler)
    scheduler.pause()
    scheduler.frame(0.02)
    expect(byPhase.fixedSimulate).toHaveLength(0)
    expect(byPhase.lateSimulate).toHaveLength(0)
    expect(byPhase.input[0]?.dt).toBeCloseTo(0.02, 6)
    expect(byPhase.present[0]?.dt).toBe(0)
    expect(byPhase.present[0]?.realDt).toBeGreaterThan(0)
    scheduler.resume()
    scheduler.frame(H)
    expect(byPhase.fixedSimulate).toHaveLength(1)
  })

  it('scales the accumulator and the late dt with timeScale', () => {
    const scheduler = createScheduler({ snapMs: 0 })
    const byPhase = collect(scheduler)
    scheduler.timeScale = 0.25
    for (let i = 0; i < 240; i++) scheduler.frame(H)
    expect(byPhase.fixedSimulate).toHaveLength(60)
    expect(byPhase.lateSimulate[0]?.dt).toBeCloseTo(1 / 240, 6)
    expect(byPhase.input[0]?.dt).toBeCloseTo(H, 6)
  })
})

describe('advance', () => {
  it('runs unbounded and scripted inside, restores both, drains the queues, skips render and zeroes alpha and commands', () => {
    const scheduler = createScheduler({ snapMs: 0 })
    const seen: Array<{ phase: string; scripted: boolean; unbounded: boolean }> = []
    for (const phase of FRAME_PHASES) scheduler.add((ctx) => seen.push({ phase, scripted: ctx.scripted, unbounded: scheduler.budget.unbounded }), { phase })
    let units = 5
    scheduler.budget.register(
      { id: 'q', pending: () => units, run: () => ((units = 0), 1), flush: () => (units = 0) },
      { priority: 1, phase: 'present' },
    )
    scheduler.commands.push('lost')
    scheduler.frame(1.4 * H)
    scheduler.advance(0.05)
    expect(seen.filter((entry) => entry.phase === 'render')).toHaveLength(1)
    const inside = seen.filter((entry) => entry.scripted)
    expect(inside.length).toBeGreaterThan(0)
    expect(inside.every((entry) => entry.scripted && entry.unbounded)).toBe(true)
    expect(scheduler.budget.unbounded).toBe(false)
    expect(units).toBe(0)
    expect(scheduler.commands.take(1000)).toHaveLength(0)
    const alphas: number[] = []
    scheduler.add((ctx) => alphas.push(ctx.alpha), { phase: 'present' })
    scheduler.frame(0)
    expect(alphas[0]).toBe(0)
  })

  it('runs max(1, round(seconds / dt)) iterations', () => {
    const scheduler = createScheduler()
    let lates = 0
    scheduler.add(() => lates++, { phase: 'lateSimulate' })
    scheduler.advance(0.5, { dt: H })
    expect(lates).toBe(30)
    lates = 0
    scheduler.advance(0.001)
    expect(lates).toBe(1)
  })

  it('gives late the dt without timeScale and, paused, runs input but not late', () => {
    const scheduler = createScheduler()
    const lateDts: number[] = []
    const inputDts: number[] = []
    let fixed = 0
    scheduler.add((ctx) => lateDts.push(ctx.dt), { phase: 'lateSimulate' })
    scheduler.add((ctx) => inputDts.push(ctx.dt), { phase: 'input' })
    scheduler.add(() => fixed++, { phase: 'fixedSimulate' })
    scheduler.timeScale = 0.25
    scheduler.advance(H, { dt: H })
    expect(lateDts).toEqual([H])
    scheduler.advance(1 / 30, { dt: 1 / 30 })
    expect(fixed).toBe(3)
    scheduler.pause()
    lateDts.length = 0
    scheduler.advance(H, { dt: H })
    expect(lateDts).toEqual([])
    expect(inputDts.at(-1)).toBeCloseTo(H, 9)
  })
})

describe('exact frames and scenario frames', () => {
  it('uses the given time as is: no clamp, no snap, no cap', () => {
    const scheduler = createScheduler({ maxFrameSeconds: 0.05 })
    scheduler.timeScale = 0.5
    const seen: Array<{ phase: string; dt: number }> = []
    let fixed = 0
    scheduler.add((ctx) => seen.push({ phase: 'input', dt: ctx.dt }), { phase: 'input' })
    scheduler.add((ctx) => seen.push({ phase: 'late', dt: ctx.dt }), { phase: 'lateSimulate' })
    scheduler.add(() => fixed++, { phase: 'fixedSimulate' })
    scheduler.frame(0.4, { exact: true, render: false })
    expect(seen).toEqual([
      { phase: 'input', dt: 0.4 },
      { phase: 'late', dt: 0.2 },
    ])
    expect(fixed).toBe(11)
    expect(scheduler.stats().droppedSeconds).toBe(0)

    const whole = createScheduler()
    let steps = 0
    const alphas: number[] = []
    whole.add(() => steps++, { phase: 'fixedSimulate' })
    whole.add((ctx) => alphas.push(ctx.alpha), { phase: 'present' })
    whole.frame(0.4, { exact: true })
    expect(steps).toBe(23)
    expect(Math.round(alphas[0]! * 16667)).toBe(16659)
    expect(whole.stats().droppedSeconds).toBe(0)
    const dts: number[] = []
    whole.add((ctx) => dts.push(ctx.realDt), { phase: 'input' })
    whole.frame(0.0166, { exact: true })
    expect(dts[0]).toBe(0.0166)
  })

  it('marks a simulate:false frame as not simulated and not scripted in present and render', () => {
    const scheduler = createScheduler()
    const flags: boolean[][] = []
    let simulatedPhases = 0
    for (const phase of ['present', 'render'] as const) scheduler.add((ctx) => flags.push([ctx.simulated, ctx.scripted]), { phase })
    for (const phase of ['input', 'fixedSimulate', 'lateSimulate'] as const) scheduler.add(() => simulatedPhases++, { phase })
    scheduler.frame(H, { simulate: false })
    expect(flags).toEqual([
      [false, false],
      [false, false],
    ])
    expect(simulatedPhases).toBe(0)
  })
})
