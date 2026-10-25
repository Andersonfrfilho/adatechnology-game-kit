/** One builder the bench times. `run` builds one whole thing (a prop, an item, a vehicle) from scratch and returns something to keep alive. */
export interface BenchEntry {
  /** `<package>/<builder>`, stable: the key of the baseline. */
  readonly id: string
  readonly run: () => unknown
}

export interface TimingOptions {
  /** Runs before timing (default 2). */
  readonly warmup?: number
  /** Stop once the timed runs add up to this (ms, default 100)... */
  readonly targetMs?: number
  /** ...or after this many runs (default 200)... */
  readonly maxRuns?: number
  /** ...but never before this many (default 5). */
  readonly minRuns?: number
  /** The clock (ms); `performance.now` by default. */
  readonly now?: () => number
}

export interface Timing {
  readonly id: string
  /** Median of the timed runs, ms. */
  readonly ms: number
  readonly runs: number
}

export const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

/** A sink the optimiser cannot see through, so the result of a run is not thrown away. */
let sink: unknown
export const keep = (value: unknown): void => {
  sink = value
}
export const lastKept = (): unknown => sink

/** Times one entry: warm-up, then runs until the time or count target, and the median. */
export function timeEntry(entry: BenchEntry, options: TimingOptions = {}): Timing {
  const now = options.now ?? (() => performance.now())
  const warmup = options.warmup ?? 2
  const targetMs = options.targetMs ?? 100
  const maxRuns = options.maxRuns ?? 200
  const minRuns = options.minRuns ?? 5
  for (let i = 0; i < warmup; i++) keep(entry.run())
  const samples: number[] = []
  let total = 0
  while (samples.length < minRuns || (samples.length < maxRuns && total < targetMs)) {
    const start = now()
    keep(entry.run())
    const elapsed = now() - start
    samples.push(elapsed)
    total += elapsed
  }
  return { id: entry.id, ms: median(samples), runs: samples.length }
}

/** Per entry, the best (lowest) median of several rounds over the whole list: a collection or a recompilation in one round does not count. */
export function best(rounds: readonly (readonly Timing[])[]): Timing[] {
  const by = new Map<string, Timing>()
  for (const round of rounds) {
    for (const t of round) {
      const kept = by.get(t.id)
      if (!kept) by.set(t.id, t)
      else by.set(t.id, { id: t.id, ms: Math.min(kept.ms, t.ms), runs: kept.runs + t.runs })
    }
  }
  return [...by.values()]
}

/**
 * The calibration loop: fixed arithmetic, trigonometry and typed-array allocation (what a geometry builder does), no kit code. Every median is
 * stored as a ratio to its time, so the numbers mean the same on a laptop and on a CI runner.
 */
export const CALIBRATION: BenchEntry = {
  id: 'calibration',
  run: () => {
    let acc = 0
    const out: Float32Array[] = []
    for (let block = 0; block < 64; block++) {
      const array = new Float32Array(3 * 512)
      for (let i = 0; i < 512; i++) {
        const a = (i / 512) * Math.PI * 2 + block
        array[3 * i] = Math.cos(a) * 0.5
        array[3 * i + 1] = Math.sin(a) * 0.5
        array[3 * i + 2] = Math.sqrt(i + block)
        acc += array[3 * i] as number
      }
      out.push(array)
    }
    return [acc, out]
  },
}

export interface BaselineEntry {
  /** Median as a ratio to the calibration loop. */
  readonly ratio: number
  /** Median in ms on the machine that wrote the baseline (for reading only). */
  readonly ms: number
}

export interface Baseline {
  readonly calibrationMs: number
  readonly node: string
  /** An entry fails past `baseline × (1 + budget)` (default 1: twice as slow). */
  readonly budget: number
  /** An entry is reported (never failed) past `baseline × (1 + warn)` (default 0.5). */
  readonly warn: number
  /**
   * A group (the sum of its entries' ratios) fails past `baseline × (1 + groupBudget)` (default 0.5): the sum is far steadier than one entry.
   * A group of fewer than `minGroupSize` entries (default 8) gets the entry budget instead.
   */
  readonly groupBudget: number
  readonly minGroupSize: number
  /** Entries under this median (ms) are reported, never failed. */
  readonly noiseFloorMs: number
  /** Fail budget per entry, for the noisy ones. */
  readonly overrides: Readonly<Record<string, number>>
  readonly entries: Readonly<Record<string, BaselineEntry>>
}

export type Verdict = 'ok' | 'faster' | 'warn' | 'slower' | 'noise' | 'new' | 'gone'

export interface Comparison {
  readonly id: string
  readonly ms: number | null
  readonly ratio: number | null
  readonly baseline: number | null
  /** ratio / baseline ratio. */
  readonly change: number | null
  readonly verdict: Verdict
}

/**
 * Compares a run with the baseline. An entry fails (`slower`) when its ratio is above `baseline × (1 + budget)` and its median is above the noise
 * floor; under the floor it is reported (`noise`), never failed. Past `baseline × (1 + warn)` it is reported (`warn`); `faster` marks a ratio under
 * `baseline / (1 + warn)`.
 */
export function compare(timings: readonly Timing[], calibrationMs: number, baseline: Baseline | null): Comparison[] {
  const out: Comparison[] = []
  const seen = new Set<string>()
  for (const t of timings) {
    seen.add(t.id)
    const ratio = t.ms / calibrationMs
    const base = baseline?.entries[t.id]
    if (!baseline || !base) {
      out.push({ id: t.id, ms: t.ms, ratio, baseline: null, change: null, verdict: 'new' })
      continue
    }
    const budget = baseline.overrides[t.id] ?? baseline.budget
    const warn = Math.min(baseline.warn, budget)
    const change = ratio / base.ratio
    let verdict: Verdict = 'ok'
    if (change > 1 + warn && t.ms < baseline.noiseFloorMs) verdict = 'noise'
    else if (change > 1 + budget) verdict = 'slower'
    else if (change > 1 + warn) verdict = 'warn'
    else if (change < 1 / (1 + warn)) verdict = 'faster'
    out.push({ id: t.id, ms: t.ms, ratio, baseline: base.ratio, change, verdict })
  }
  if (baseline) for (const id of Object.keys(baseline.entries)) if (!seen.has(id)) out.push({ id, ms: null, ratio: null, baseline: baseline.entries[id]!.ratio, change: null, verdict: 'gone' })
  return out
}

/** A new baseline from a run (keeps the budget, floor and overrides of the old one). */
export function toBaseline(timings: readonly Timing[], calibrationMs: number, previous: Baseline | null, node: string): Baseline {
  const entries: Record<string, BaselineEntry> = {}
  for (const t of [...timings].sort((a, b) => a.id.localeCompare(b.id))) entries[t.id] = { ratio: round(t.ms / calibrationMs, 4), ms: round(t.ms, 4) }
  return {
    calibrationMs: round(calibrationMs, 4),
    node,
    budget: previous?.budget ?? 1,
    warn: previous?.warn ?? 0.5,
    groupBudget: previous?.groupBudget ?? 0.5,
    minGroupSize: previous?.minGroupSize ?? 8,
    noiseFloorMs: previous?.noiseFloorMs ?? 0.05,
    overrides: previous?.overrides ?? {},
    entries,
  }
}

export interface GroupComparison {
  readonly group: string
  /** Sum of the ratios of the entries the run and the baseline share. */
  readonly ratio: number
  readonly baseline: number
  readonly change: number
  readonly verdict: 'ok' | 'faster' | 'slower'
}

/** Per group, the sum of the ratios of the entries in both the run and the baseline, against the baseline's sum. */
export function compareGroups(comparisons: readonly Comparison[], baseline: Baseline | null): GroupComparison[] {
  if (!baseline) return []
  const by = new Map<string, { ratio: number; baseline: number; count: number }>()
  for (const c of comparisons) {
    if (c.ratio === null || c.baseline === null) continue
    const group = c.id.split('/')[0] as string
    const row = by.get(group) ?? { ratio: 0, baseline: 0, count: 0 }
    row.ratio += c.ratio
    row.baseline += c.baseline
    row.count++
    by.set(group, row)
  }
  return [...by.entries()].map(([group, row]) => {
    const change = row.ratio / row.baseline
    const budget = row.count >= baseline.minGroupSize ? baseline.groupBudget : baseline.budget
    const verdict = change > 1 + budget ? 'slower' : change < 1 / (1 + budget) ? 'faster' : 'ok'
    return { group, ratio: row.ratio, baseline: row.baseline, change, verdict }
  })
}

const round = (x: number, digits: number): number => Math.round(x * 10 ** digits) / 10 ** digits

/** Totals per group (the part of the id before the first `/`). */
export function totals(timings: readonly Timing[]): Array<{ group: string; count: number; ms: number }> {
  const by = new Map<string, { count: number; ms: number }>()
  for (const t of timings) {
    const group = t.id.split('/')[0] as string
    const row = by.get(group) ?? { count: 0, ms: 0 }
    row.count++
    row.ms += t.ms
    by.set(group, row)
  }
  return [...by.entries()].map(([group, row]) => ({ group, ...row }))
}

/** The markdown table of a run (the CI job writes it to the job summary). */
export function summary(comparisons: readonly Comparison[], timings: readonly Timing[], calibrationMs: number, groups: readonly GroupComparison[] = [], limit = 25): string {
  const lines = [`Calibration loop: ${calibrationMs.toFixed(3)} ms`, '', '| group | builders | total ms | change | verdict |', '|---|---:|---:|---:|---|']
  for (const row of totals(timings)) {
    const g = groups.find((x) => x.group === row.group)
    lines.push(`| ${row.group} | ${row.count} | ${row.ms.toFixed(2)} | ${g ? `×${g.change.toFixed(2)}` : '-'} | ${g?.verdict ?? 'new'} |`)
  }
  const flagged = comparisons.filter((c) => c.verdict !== 'ok')
  const counts = (['slower', 'warn', 'noise', 'faster', 'new', 'gone'] as const).map((v) => `${v} ${comparisons.filter((c) => c.verdict === v).length}`).join(', ')
  lines.push('', `Against the baseline: ${counts}.`)
  if (flagged.length) {
    lines.push('', '| builder | ms | ratio | baseline | change | verdict |', '|---|---:|---:|---:|---:|---|')
    const order: Record<Verdict, number> = { slower: 0, warn: 1, noise: 2, gone: 3, new: 4, faster: 5, ok: 6 }
    const rows = [...flagged].sort((a, b) => order[a.verdict] - order[b.verdict] || (b.change ?? 0) - (a.change ?? 0)).slice(0, limit)
    for (const c of rows) lines.push(`| ${c.id} | ${c.ms?.toFixed(3) ?? '-'} | ${c.ratio?.toFixed(3) ?? '-'} | ${c.baseline?.toFixed(3) ?? '-'} | ${c.change ? `×${c.change.toFixed(2)}` : '-'} | ${c.verdict} |`)
    if (flagged.length > limit) lines.push(`| … ${flagged.length - limit} more | | | | | |`)
  }
  return lines.join('\n')
}
