import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

import { compareCosts, costChangeLines, costOf, costSummary, DEFAULT_COST_BASELINE, FAILING_COST_VERDICTS, toCostBaseline } from './cost'
import type { Cost, CostBaseline } from './cost'
import type { BenchEntry } from './timing'

export type CostRunOptions = {
  readonly entries: readonly BenchEntry[]
  readonly baselinePath: string
  readonly check: boolean
  readonly update: boolean
  /** Ids accepted over the limit of their group in this update. */
  readonly accepted: readonly string[]
  readonly jsonPath?: string
  /** The entries were filtered by this text: the recorded builders outside it are not compared. */
  readonly filter?: string
}

/** Each entry built once and counted; an entry that draws nothing (a geometry alone) has no cost. */
function costsOf(entries: readonly BenchEntry[]): Cost[] {
  return entries.flatMap((entry) => {
    const cost = costOf(entry.id, entry.run())
    return cost ? [cost] : []
  })
}

function readBaseline(path: string, filter: string | undefined): CostBaseline {
  const read: CostBaseline = existsSync(path) ? { ...DEFAULT_COST_BASELINE, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<CostBaseline>) } : DEFAULT_COST_BASELINE
  if (filter === undefined) return read
  return { ...read, entries: Object.fromEntries(Object.entries(read.entries).filter(([id]) => id.includes(filter))) }
}

/** Writes the baseline of this run, or refuses it; prints every builder whose recorded cost changes. Returns the exit code. */
function updateBaseline(options: CostRunOptions, baseline: CostBaseline, costs: readonly Cost[]): number {
  const next = toCostBaseline({ costs, previous: baseline, accepted: options.accepted })
  if (next.refused.length > 0) {
    const ids = next.refused.map((comparison) => comparison.id).join(',')
    console.error(`worse than recorded, over the draw limit of their group, or gone:\n${costChangeLines(next.refused).join('\n')}`)
    console.error(`\nnothing written. Make them cheaper, or accept each by id: --cost-update --cost-accept ${ids}`)
    return 1
  }
  writeFileSync(options.baselinePath, JSON.stringify(next.baseline, null, 2) + '\n')
  console.log(`cost baseline written: ${options.baselinePath} (${costs.length} builders, ${Object.keys(next.baseline.over).length} accepted over the limit)`)
  console.log(next.changed.length > 0 ? `${next.changed.length} recorded cost(s) changed (put this list in the PR):\n${costChangeLines(next.changed).join('\n')}` : 'no recorded cost changed')
  return 0
}

/** The cost census: prints the table, writes the baseline (`update`) or fails on a builder past its recorded cost (`check`). Returns the exit code. */
export function runCost(options: CostRunOptions): number {
  const baseline = readBaseline(options.baselinePath, options.filter)
  const costs = costsOf(options.entries)
  if (options.jsonPath) writeFileSync(options.jsonPath, JSON.stringify(costs, null, 1) + '\n')
  if (options.update) return updateBaseline(options, baseline, costs)
  const comparisons = compareCosts(costs, baseline)
  const table = costSummary(comparisons)
  console.log(table)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Cost of the builders\n\n${table}\n`)
  const failing = comparisons.filter((comparison) => FAILING_COST_VERDICTS.includes(comparison.verdict))
  if (!options.check || failing.length === 0) return 0
  console.error(`\n${failing.length} builder(s) past the recorded cost. Make the piece cheaper. A new piece, or a cost that is meant, is recorded with: node tools/shapes-bench/dist/cli.js --cost-update`)
  return 1
}
