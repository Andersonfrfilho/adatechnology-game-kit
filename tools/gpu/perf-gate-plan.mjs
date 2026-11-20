// @ts-check
// The decisions of tools/gpu/perf-gate.mjs that need no browser, git or disk: whether the base worktree must be built, where the second run of main is kept,
// when to stop waiting for a quiet machine, whether the renderer probe is still good, and how long a round takes. Pure, so tests/perf-gate-plan.test.mjs can hold them.

/** @param {{ builtSha: string | undefined, expectedSha: string, hasOutput: boolean }} state the sha written after the last complete build, and whether the page it built is still there */
export const needsBuild = ({ builtSha, expectedSha, hasOutput }) => !hasOutput || builtSha !== expectedSha

/** Where the second run of main is kept: next to the first, under the same commit, GPU, window and harness key. @param {string} baseReport */
export const againReportPath = (baseReport) => baseReport.replace(/\.json$/, '-again.json')

export const QUIET_LOAD = 4
export const WAIT_FOR_QUIET_MS = 10 * 60 * 1000
export const QUIET_POLL_MS = 5000
/** The wait logs once in this many polls, so a 10 minute wait is not 120 lines. */
export const QUIET_LOG_EVERY = 6

/** @param {{ load: number, now: number, until: number }} state */
export const shouldKeepWaiting = ({ load, now, until }) => load >= QUIET_LOAD && now < until

export const PROBE_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * @typedef {{ renderer: string, chromeVersion: string, at: number }} ProbeEntry
 * A saved probe stands in for opening Chrome when it is recent, from the same Chrome, and nobody forced a new one (PERF_GATE_PROBE=1).
 * @param {{ entry: ProbeEntry | undefined, now: number, chromeVersion: string, force: boolean }} state
 */
export const probeUsable = ({ entry, now, chromeVersion, force }) => {
  if (force || !entry || chromeVersion === '') return false
  if (entry.chromeVersion !== chromeVersion) return false
  return now - entry.at >= 0 && now - entry.at < PROBE_MAX_AGE_MS
}

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
