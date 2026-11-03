import { describe, expect, it } from 'vitest'
import { DEFAULT_GRAPHICS, applyPreset, createBenchmark, createGraphicsController, createGraphicsStore, minFrameMs, setOption, tierOf } from '../src'
import type { EffectiveGraphics, StorageLike } from '../src'

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
const frames = (c: { frame(dt: number, ms: number): void }, seconds: number, ms: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) c.frame(1 / 60, ms)
}

describe('benchmark', () => {
  it('leaves the warmup out and names the tier by the median frame', () => {
    const b = createBenchmark({ durationS: 1, warmupS: 0.2 })
    for (let i = 0; i < 12; i++) b.frame(1 / 60, 200)
    for (let i = 0; i < 70; i++) b.frame(1 / 60, 6)
    expect(b.done).toBe(true)
    expect(b.result()!.p50Ms).toBe(6)
    expect(b.result()!.tier).toBe('ultra')
    expect(tierOf(30, 1000 / 60)).toBe('low')
  })
})

describe('graphics controller', () => {
  it('calibrates for about three seconds on a first run with the auto options at their best, then starts the tuner at the tier found', () => {
    const storage = memory()
    const applied: EffectiveGraphics[] = []
    const c = createGraphicsController({ store: { storage }, gpu: 'gpu-a', apply: (e) => applied.push(e) })
    expect(c.phase).toBe('calibrating')
    expect(applied[0]).toMatchObject({ resolutionScale: 1, shadows: 'all' })
    frames(c, 3.5, 15)
    expect(c.phase).toBe('running')
    expect(c.tier).toBe('medium')
    expect(c.effective).toMatchObject({ resolutionScale: 0.8, shadows: 'near', viewDistance: 'medium' })
    expect(JSON.parse(storage.data.get('adatechnology.graphics')!).calibration).toMatchObject({ gpu: 'gpu-a', tier: 'medium' })
  })

  it('does not calibrate again on the same GPU, and does on another', () => {
    const storage = memory()
    const first = createGraphicsController({ store: { storage }, gpu: 'gpu-a', apply: () => {} })
    frames(first, 3.5, 5)
    expect(createGraphicsController({ store: { storage }, gpu: 'gpu-a', apply: () => {} }).phase).toBe('running')
    expect(createGraphicsController({ store: { storage }, gpu: 'gpu-b', apply: () => {} }).phase).toBe('calibrating')
  })

  it('keeps the choice in the browser and has nothing to calibrate when nothing is automatic', () => {
    const storage = memory()
    const c = createGraphicsController({ store: { storage }, apply: () => {} })
    c.set(applyPreset(c.settings, 'ultra'))
    const again = createGraphicsController({ store: { storage }, apply: () => {} })
    expect(again.settings.preset).toBe('ultra')
    expect(again.phase).toBe('running')
    expect(createGraphicsStore({ storage }).settings.preset).toBe('ultra')
  })

  it('runs on the defaults when the storage throws', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    const c = createGraphicsController({ store: { storage: broken }, apply: () => {} })
    expect(c.settings).toEqual(DEFAULT_GRAPHICS)
    c.set(setOption(c.settings, 'showFps', true))
    expect(c.settings.showFps).toBe(true)
  })

  it('gives the loop the cap and counts the frames', () => {
    const c = createGraphicsController({ store: { storage: memory() }, benchmark: false, apply: () => {} })
    c.set(setOption(c.settings, 'fpsCap', 30))
    expect(c.minFrameMs()).toBeCloseTo(minFrameMs(30))
    c.set(setOption(c.settings, 'fpsCap', 0))
    expect(c.minFrameMs()).toBe(0)
    frames(c, 1, 16)
    expect(c.fps).toBeGreaterThan(55)
  })
})

describe('manual calibration', () => {
  it('waits for the host, then runs once, and not again on the same GPU', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
    const c = createGraphicsController({ store: { storage }, gpu: 'g', calibrate: 'manual', apply: () => {} })
    expect(c.phase).toBe('running')
    expect(c.needsCalibration).toBe(true)
    expect(c.calibrateIfNeeded()).toBe(true)
    expect(c.calibrateIfNeeded()).toBe(false)
    for (let t = 0; t < 4; t += 1 / 60) c.frame(1 / 60, 4)
    expect(c.phase).toBe('running')
    expect(c.tier).toBe('ultra')
    expect(c.needsCalibration).toBe(false)
  })
})
