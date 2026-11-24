import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

import { compareCosts, costOf, costSummary, DEFAULT_COST_BASELINE, FAILING_COST_VERDICTS, toCostBaseline } from './cost'
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
}

/** Each entry built once and counted; an entry that draws nothing (a geometry alone) has no cost. */
function costsOf(entries: readonly BenchEntry[]): Cost[] {
  return entries.flatMap((entry) => {
    const cost = costOf(entry.id, entry.run())
    return cost ? [cost] : []
  })
}

function readBaseline(path: string): CostBaseline {
  return existsSync(path) ? { ...DEFAULT_COST_BASELINE, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<CostBaseline>) } : DEFAULT_COST_BASELINE
}

/** The cost census: prints the table, writes the baseline (`update`) or fails on a builder past its recorded cost (`check`). Returns the exit code. */
export function runCost(options: CostRunOptions): number {
  const baseline = readBaseline(options.baselinePath)
  const costs = costsOf(options.entries)
  if (options.jsonPath) writeFileSync(options.jsonPath, JSON.stringify(costs, null, 1) + '\n')
  if (options.update) {
    const next = toCostBaseline(costs, baseline, options.accepted)
    if (next.refused.length > 0) {
      console.error(`over the draw limit of their group, new or worse than accepted: ${next.refused.join(', ')}\nmake them cheaper, or accept each by id: --cost-accept ${next.refused.join(',')}`)
      return 1
    }
    writeFileSync(options.baselinePath, JSON.stringify(next.baseline, null, 2) + '\n')
    console.log(`cost baseline written: ${options.baselinePath} (${costs.length} builders, ${Object.keys(next.baseline.over).length} accepted over the limit)`)
    return 0
  }
  const comparisons = compareCosts(costs, baseline)
  const table = costSummary(comparisons)
  console.log(table)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Cost of the builders\n\n${table}\n`)
  const failing = comparisons.filter((comparison) => FAILING_COST_VERDICTS.includes(comparison.verdict))
  if (!options.check || failing.length === 0) return 0
  console.error(`\n${failing.length} builder(s) past the recorded cost. Make the piece cheaper; if the cost is meant, record it: node tools/shapes-bench/dist/cli.js --cost-update`)
  return 1
}
