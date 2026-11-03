import { describe, expect, it } from 'vitest'
import { createScheduler, startLoop } from '../src'

describe('frame cap', () => {
  it('skips the display frames that come sooner than the cap and hands their time to the next frame that runs', () => {
    const scheduler = createScheduler()
    let callback: ((nowMs: number) => void) | undefined
    const ran: number[] = []
    let cap = 1000 / 30 - 1
    const stop = startLoop(scheduler, { startMs: 0, requestFrame: (next) => ((callback = next), 1), onFrame: (s) => ran.push(s), minFrameMs: () => cap })
    // a 120 Hz display for a quarter of a second at a cap of 30
    for (let i = 1; i <= 30; i++) callback?.(i * (1000 / 120))
    expect(ran.length).toBeGreaterThanOrEqual(7)
    expect(ran.length).toBeLessThanOrEqual(8)
    for (const s of ran) expect(s).toBeCloseTo(1 / 30, 2)
    // no cap: every display frame runs
    cap = 0
    const before = ran.length
    for (let i = 31; i <= 40; i++) callback?.(i * (1000 / 120))
    expect(ran.length - before).toBe(10)
    stop()
  })
})
