import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { benchEntries } from './entries'
import { best, CALIBRATION, compare, compareGroups, summary, timeEntry, toBaseline } from './timing'
import type { Baseline, BenchEntry, Timing, TimingOptions } from './timing'

const HELP = `shapes-bench: times the kit's 3D builders.

  node dist/cli.js [--check] [--update] [--filter <text>] [--json <file>] [--baseline <file>] [--rounds <n>] [--baseline-from <json>]

  --check     fail (exit 1) when a builder, or the sum of a group, is slower than its baseline past the budget
  --update    rewrite the baseline with this run
  --filter    only the builders whose id contains the text (never with --update)
  --json      also write this run as JSON
  --baseline-from <json>  write the baseline from a run saved with --json (another machine's, the CI job's artifact) and stop
  --baseline  the baseline file (default tools/shapes-bench/baseline.json)
  --rounds    passes over the list (default 3; each builder keeps its best)

The table goes to stdout, and to $GITHUB_STEP_SUMMARY when it is set.`

function argValue(args: string[], name: string): string | undefined {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}

const gc = (globalThis as { gc?: () => void }).gc

/** One entry's timing, after a collection so the garbage of the previous entry is not paid here. */
function timed(entry: BenchEntry, options?: TimingOptions): Timing {
  gc?.()
  return timeEntry(entry, options)
}

const CONFIRM_ROUNDS = 5
const CALIBRATION_RUN: TimingOptions = { warmup: 1, targetMs: 60, maxRuns: 80, minRuns: 10 }

function main(): void {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log(HELP)
    return
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const baselinePath = argValue(args, '--baseline') ?? join(root, 'baseline.json')
  const filter = argValue(args, '--filter')
  const check = args.includes('--check')
  const update = args.includes('--update')
  if (update && filter) throw new Error('--update rewrites the whole baseline: run it without --filter')
  const baseline: Baseline | null = existsSync(baselinePath) ? (JSON.parse(readFileSync(baselinePath, 'utf8')) as Baseline) : null

  const from = argValue(args, '--baseline-from')
  if (from) {
    // a run of another machine (the JSON the CI job uploads) becomes the baseline, without timing anything here
    const run = JSON.parse(readFileSync(from, 'utf8')) as { calibrationMs: number; timings: Timing[]; node?: string }
    writeFileSync(baselinePath, JSON.stringify(toBaseline(run.timings, run.calibrationMs, baseline, run.node ?? 'unknown'), null, 2) + '\n')
    console.log(`baseline written from ${from}: ${baselinePath}`)
    return
  }

  const entries = benchEntries({ filter })
  const rounds = Number(argValue(args, '--rounds') ?? 3)
  // the whole list several times, the calibration loop between the entries of each round: each entry keeps its best round
  const byRound: Timing[][] = []
  const calibrations: number[] = []
  for (let round = 0; round < rounds; round++) {
    const timings: Timing[] = []
    entries.forEach((entry, index) => {
      if (index % 20 === 0) calibrations.push(timed(CALIBRATION, CALIBRATION_RUN).ms)
      timings.push(timed(entry))
    })
    calibrations.push(timed(CALIBRATION, CALIBRATION_RUN).ms)
    byRound.push(timings)
  }
  let timings = best(byRound)
  const calibrationMs = Math.min(...calibrations)
  const against = filter && baseline ? { ...baseline, entries: Object.fromEntries(Object.entries(baseline.entries).filter(([id]) => id.includes(filter))) } : baseline
  let comparisons = compare(timings, calibrationMs, against)
  // a builder over the budget is timed again, alone, a few more rounds before it fails (all of a group over its budget too): one slow round on a busy machine is not a regression
  const slowGroups0 = new Set(compareGroups(comparisons, against).filter((g) => g.verdict === 'slower').map((g) => g.group))
  const suspects = new Set(comparisons.filter((c) => c.verdict === 'slower' || c.verdict === 'warn' || slowGroups0.has(c.id.split('/')[0] as string)).map((c) => c.id))
  if (suspects.size) {
    const again = entries.filter((e) => suspects.has(e.id))
    const extra: Timing[][] = []
    for (let round = 0; round < CONFIRM_ROUNDS; round++) extra.push(again.map((entry) => timed(entry)))
    timings = best([timings, ...extra])
    comparisons = compare(timings, calibrationMs, against)
    console.log(`re-timed ${suspects.size} builder(s) over the warning, ${CONFIRM_ROUNDS} more rounds each\n`)
  }
  const groups = compareGroups(comparisons, against)
  const table = summary(comparisons, timings, calibrationMs, groups)
  console.log(table)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Shapes bench\n\n${table}\n`)
  const jsonPath = argValue(args, '--json')
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ calibrationMs, node: process.version, timings }, null, 2) + '\n')
  if (update) {
    writeFileSync(baselinePath, JSON.stringify(toBaseline(timings, calibrationMs, baseline, process.version), null, 2) + '\n')
    console.log(`\nbaseline written: ${baselinePath}`)
  }
  if (check) {
    if (!baseline) {
      console.error('no baseline: run with --update first')
      process.exitCode = 1
      return
    }
    const slower = comparisons.filter((c) => c.verdict === 'slower')
    if (slower.length) {
      console.error(`\n${slower.length} builder(s) slower than the baseline past the budget: ${slower.map((c) => c.id).join(', ')}`)
      process.exitCode = 1
    }
    const slowGroups = groups.filter((g) => g.verdict === 'slower')
    if (slowGroups.length) {
      console.error(`\n${slowGroups.length} group(s) slower than the baseline past the group budget: ${slowGroups.map((g) => g.group).join(', ')}`)
      process.exitCode = 1
    }
  }
}

main()
