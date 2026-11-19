import { describe, expect, it } from 'vitest'

import { best, compare, compareGroups, median, relativeNoise, summary, timeEntry, toBaseline } from '../src/timing'
import type { Baseline } from '../src/timing'

const clock = (steps: number[]): (() => number) => {
  let t = 0
  let i = 0
  let open = false
  return () => {
    if (open) t += steps[i++ % steps.length] as number
    open = !open
    return t
  }
}

describe('timing', () => {
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(0)
  })

  it('runs until the time target, at least minRuns and at most maxRuns', () => {
    let calls = 0
    const entry = { id: 'x', run: () => ++calls }
    expect(timeEntry(entry, { warmup: 2, targetMs: 100, minRuns: 1, now: clock([30]) }).runs).toBe(4)
    expect(calls).toBe(6)
    expect(timeEntry(entry, { warmup: 0, targetMs: 1000, maxRuns: 5, now: clock([1]) }).runs).toBe(5)
    expect(timeEntry(entry, { warmup: 0, targetMs: 1, minRuns: 3, now: clock([50]) }).runs).toBe(3)
    expect(timeEntry(entry, { warmup: 0, targetMs: 1, minRuns: 5, now: clock([1, 9, 2, 8, 3]) }).ms).toBe(3)
  })
})

describe('compare with the baseline', () => {
  const baseline: Baseline = {
    calibrationMs: 1,
    node: 'v22',
    budget: 1,
    warn: 0.5,
    groupBudget: 0.25,
    minGroupSize: 2,
    noiseFloorMs: 0.05,
    overrides: { 'a/noisy': 2 },
    entries: { 'a/same': { ratio: 1, ms: 1 }, 'a/warn': { ratio: 1, ms: 1 }, 'a/slow': { ratio: 1, ms: 1 }, 'a/tiny': { ratio: 0.01, ms: 0.01 }, 'a/noisy': { ratio: 1, ms: 1 }, 'a/fast': { ratio: 1, ms: 1 }, 'a/gone': { ratio: 1, ms: 1 } },
  }
  it('fails only past the budget and above the noise floor, normalised by the calibration', () => {
    // a machine twice as slow: the calibration takes 2 ms, so 2.8 ms is a ratio of 1.4 (inside the budget)
    const timings = [
      { id: 'a/same', ms: 2.8, runs: 5 },
      { id: 'a/warn', ms: 3.2, runs: 5 },
      { id: 'a/slow', ms: 4.4, runs: 5 },
      { id: 'a/tiny', ms: 0.04, runs: 5 },
      { id: 'a/noisy', ms: 5, runs: 5 },
      { id: 'a/fast', ms: 1, runs: 5 },
      { id: 'a/new', ms: 1, runs: 5 },
    ]
    const verdicts = Object.fromEntries(compare(timings, 2, baseline).map((c) => [c.id, c.verdict]))
    expect(verdicts).toEqual({ 'a/same': 'ok', 'a/warn': 'warn', 'a/slow': 'slower', 'a/tiny': 'noise', 'a/noisy': 'warn', 'a/fast': 'faster', 'a/new': 'new', 'a/gone': 'gone' })
  })
  it('a new baseline keeps the budget and the overrides, sorted by id', () => {
    const next = toBaseline([{ id: 'b', ms: 2, runs: 3 }, { id: 'a', ms: 1, runs: 3 }], 4, baseline, 'v22.1')
    expect(Object.keys(next.entries)).toEqual(['a', 'b'])
    expect(next.entries.a).toEqual({ ratio: 0.25, ms: 1 })
    expect(next.overrides).toEqual({ 'a/noisy': 2 })
    expect(next.budget).toBe(1)
    expect(next.groupBudget).toBe(0.25)
  })
  it('a group fails on the sum of its entries, which is steadier than one entry', () => {
    const timings = [{ id: 'a/same', ms: 2.6, runs: 5 }, { id: 'a/warn', ms: 2.6, runs: 5 }, { id: 'b/x', ms: 1, runs: 5 }]
    const groups = compareGroups(compare(timings, 2, baseline), baseline)
    expect(groups.map((g) => [g.group, g.verdict])).toEqual([['a', 'slower']])
    expect(groups[0]!.change).toBeCloseTo(1.3, 10)
  })
  it('the summary has the totals per group and the flagged rows', () => {
    const timings = [{ id: 'a/slow', ms: 3.2, runs: 5 }]
    const comparisons = compare(timings, 2, baseline)
    const text = summary(comparisons, timings, 2, compareGroups(comparisons, baseline))
    // one entry is under minGroupSize: the group gets the entry budget
    expect(text).toContain('| a | 1 | 3.20 | ×1.60 | ok |')
    expect(text).toContain('| a/slow | 3.200 | 1.600 | 1.000 | ×1.60 | warn |')
  })

  it('measures runner noise from calibration samples and expands margin accordingly', () => {
    // 0 noise on constant calibration
    expect(relativeNoise([1, 1, 1, 1])).toBe(0)
    // relative IQR
    const noise = relativeNoise([0.8, 0.9, 1.0, 1.1, 1.2])
    expect(noise).toBeGreaterThan(0)
    expect(noise).toBeLessThan(1)

    // With noise, an entry that would have been slightly over baseline budget is absorbed
    const timings = [{ id: 'a/same', ms: 4.1, runs: 5 }] // ratio 2.05 on calibration 2, change 2.05 > 2.0
    const strictVerdict = compare(timings, 2, baseline, 0)[0]!.verdict
    expect(strictVerdict).toBe('slower')
    const noisyVerdict = compare(timings, 2, baseline, 0.2)[0]!.verdict
    expect(noisyVerdict).toBe('warn')

    // But a real 3x regression still fails past any noise margin
    const regression = [{ id: 'a/same', ms: 6.0, runs: 5 }] // ratio 3.0 on calibration 2, change 3.0
    const failVerdict = compare(regression, 2, baseline, 0.5)[0]!.verdict
    expect(failVerdict).toBe('slower')
  })

  it('best combines rounds using per-round ratio when available', () => {
    const round1 = [{ id: 'a/same', ms: 3.0, runs: 5, ratio: 1.5 }]
    const round2 = [{ id: 'a/same', ms: 2.5, runs: 5, ratio: 1.2 }]
    const merged = best([round1, round2])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.ratio).toBe(1.2)
    expect(merged[0]!.ms).toBe(2.5)
  })
})
