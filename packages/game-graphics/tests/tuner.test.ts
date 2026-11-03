import { describe, expect, it } from 'vitest'
import { DEFAULT_GRAPHICS, createAutoTuner, setOption, tunerLadder } from '../src'

const run = (tuner: ReturnType<typeof createAutoTuner>, seconds: number, loadMs: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) tuner.frame(1 / 60, loadMs)
}

describe('auto tuner', () => {
  it('drops the shadows to the near ones before losing any pixel, and only then the resolution', () => {
    const ladder = tunerLadder(DEFAULT_GRAPHICS)
    expect(ladder[0]).toEqual({ resolutionScale: 1, shadows: 'all' })
    expect(ladder[1]).toEqual({ resolutionScale: 1, shadows: 'near' })
    expect(ladder[ladder.length - 1]).toEqual({ resolutionScale: 0.5, shadows: 'off' })
  })

  it('steps down while the frame is over the target and back up, slowly, once there is room', () => {
    const tuner = createAutoTuner()
    tuner.reset(DEFAULT_GRAPHICS, 'ultra')
    expect(tuner.state.level).toBe(0)
    run(tuner, 20, 40)
    expect(tuner.state.resolutionScale).toBe(0.5)
    expect(tuner.state.shadows).toBe('off')
    run(tuner, 2, 5)
    expect(tuner.state.level).toBe(tuner.state.levels - 1)
    run(tuner, 60, 5)
    expect(tuner.state.level).toBe(0)
  })

  it('holds steady inside the band', () => {
    const tuner = createAutoTuner()
    tuner.reset(DEFAULT_GRAPHICS, 'high')
    const level = tuner.state.level
    run(tuner, 30, 14)
    expect(tuner.state.level).toBe(level)
  })

  it('never moves an option the player fixed by hand', () => {
    const fixed = setOption(DEFAULT_GRAPHICS, 'shadows', 'all')
    const tuner = createAutoTuner()
    tuner.reset(fixed, 'ultra')
    run(tuner, 20, 40)
    const e = tuner.effective(fixed)
    expect(e.shadows).toBe('all')
    expect(e.resolutionScale).toBe(0.5)
    const both = setOption(fixed, 'resolutionScale', 0.7)
    tuner.reset(both, 'ultra')
    run(tuner, 20, 40)
    expect(tuner.effective(both)).toMatchObject({ resolutionScale: 0.7, shadows: 'all' })
  })

  it('starts each tier lower on the ladder and picks its view distance', () => {
    const tuner = createAutoTuner()
    tuner.reset(DEFAULT_GRAPHICS, 'low')
    expect(tuner.effective(DEFAULT_GRAPHICS)).toMatchObject({ resolutionScale: 0.7, shadows: 'off', viewDistance: 'short' })
    tuner.reset(DEFAULT_GRAPHICS, 'ultra')
    expect(tuner.effective(DEFAULT_GRAPHICS)).toMatchObject({ resolutionScale: 1, shadows: 'all', viewDistance: 'long' })
  })

  it('aims at the cap: a 33 ms frame is fine at 30 and too slow at 60', () => {
    const tuner = createAutoTuner()
    const at30 = setOption(DEFAULT_GRAPHICS, 'fpsCap', 30)
    tuner.reset(at30, 'high')
    run(tuner, 5, 28)
    expect(tuner.state.level).toBe(1)
    tuner.reset(DEFAULT_GRAPHICS, 'high')
    run(tuner, 5, 28)
    expect(tuner.state.level).toBeGreaterThan(1)
  })
})
