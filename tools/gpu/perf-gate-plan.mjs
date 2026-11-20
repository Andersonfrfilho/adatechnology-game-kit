// @ts-check
// The decisions of tools/gpu/perf-gate.mjs that need no browser, git or disk: whether the base worktree must be built, where the second run of main is kept,
// when to stop waiting for a quiet machine, and how long a round takes. Pure, so tests/perf-gate-plan.test.mjs can hold them.

/** @param {{ builtSha: string | undefined, expectedSha: string, hasOutput: boolean }} state the sha written after the last complete build, and whether the page it built is still there */
export const needsBuild = ({ builtSha, expectedSha, hasOutput }) => !hasOutput || builtSha !== expectedSha

/** Where the second run of main is kept: next to the first, under the same commit, GPU, window and harness key. @param {string} baseReport */
export const againReportPath = (baseReport) => baseReport.replace(/\.json$/, '-again.json')

/** @typedef {{ name: string, ms: number }} Step */

/** One entry per name, summed, in the order the names first appeared. @param {Step[]} steps @returns {Step[]} */
export const sumSteps = (steps) => {
  /** @type {Map<string, number>} */
  const totals = new Map()
  for (const { name, ms } of steps) totals.set(name, (totals.get(name) ?? 0) + ms)
  return [...totals].map(([name, ms]) => ({ name, ms }))
}

/** @param {number} ms */
export const formatMinutes = (ms) => `${(ms / 60000).toFixed(1)} min`

/** One line per step, and the total. @param {Step[]} steps @returns {string[]} */
export const formatSteps = (steps) => {
  const summed = sumSteps(steps)
  const total = summed.reduce((sum, step) => sum + step.ms, 0)
  return [...summed.map(({ name, ms }) => `  ${name.padEnd(22)} ${formatMinutes(ms)}`), `  ${'total'.padEnd(22)} ${formatMinutes(total)}`]
}

/** The line a round adds to times.ndjson. @param {{ at: number, renderer: string, outcome: string, steps: Step[] }} round */
export const timesRecord = ({ at, renderer, outcome, steps }) => {
  const summed = sumSteps(steps)
  return {
    at: new Date(at).toISOString(),
    renderer,
    outcome,
    totalMs: summed.reduce((sum, step) => sum + step.ms, 0),
    steps: Object.fromEntries(summed.map(({ name, ms }) => [name, ms])),
  }
}
