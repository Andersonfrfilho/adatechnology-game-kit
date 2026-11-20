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

/** What a step costs when the history has not seen it yet (ms): a perf.mjs run takes ~7.7 min. */
export const DEFAULT_STEP_MS = /** @type {const} */ ({
  probe: 5000,
  'build-branch': 60000,
  'measure-branch': 462000,
  'build-base': 240000,
  'measure-base': 462000,
  'measure-branch-again': 462000,
  'measure-base-again': 462000,
})

/** The records of times.ndjson, a damaged line skipped. @param {string} text @returns {Record<string, number>[]} the `steps` of each */
export const parseHistory = (text) => {
  /** @type {Record<string, number>[]} */
  const history = []
  for (const line of text.split('\n')) {
    try {
      const steps = JSON.parse(line)?.steps
      if (steps && typeof steps === 'object') history.push(steps)
    } catch {
      /* a half-written line */
    }
  }
  return history
}

const HISTORY_WINDOW = 10

/** @param {number[]} values */
const medianOf = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? /** @type {number} */ (sorted[middle]) : (/** @type {number} */ (sorted[middle - 1]) + /** @type {number} */ (sorted[middle])) / 2
}

/** The expected cost of one step: the median of the last runs that did it, else the default. @param {Record<string, number>[]} history @param {string} name */
export const stepEstimateMs = (history, name) => {
  const seen = history.map((steps) => steps[name]).filter((ms) => typeof ms === 'number' && ms > 0).slice(-HISTORY_WINDOW)
  if (seen.length > 0) return medianOf(seen)
  return /** @type {Record<string, number>} */ (DEFAULT_STEP_MS)[name] ?? 0
}

/** @param {Record<string, number>[]} history @param {string[]} names */
export const estimateMs = (history, names) => names.reduce((sum, name) => sum + stepEstimateMs(history, name), 0)

/** The steps still ahead before the first comparison. @param {{ needsBaseRun: boolean, needsBaseBuild: boolean }} plan */
export const plannedSteps = ({ needsBaseRun, needsBaseBuild }) => [
  'build-branch',
  'measure-branch',
  ...(needsBaseRun ? [...(needsBaseBuild ? ['build-base'] : []), 'measure-base'] : []),
]

/** The steps of a repetition. @param {{ needsBaseBuild: boolean, hasSavedAgain: boolean }} plan */
export const repetitionSteps = ({ needsBaseBuild, hasSavedAgain }) => [
  'measure-branch-again',
  ...(hasSavedAgain ? [] : [...(needsBaseBuild ? ['build-base'] : []), 'measure-base-again']),
]

/** PERF_GATE_MAX_MIN in minutes, or undefined when it is unset or not a positive number. @param {string | undefined} value */
export const parseMaxMinutes = (value) => {
  const minutes = Number(value)
  return value !== undefined && value !== '' && Number.isFinite(minutes) && minutes > 0 ? minutes : undefined
}

/** The exit code of a round that stopped because it would not fit PERF_GATE_MAX_MIN (1 is a block, 0 a pass). */
export const EXIT_OVER_BUDGET = 3

/** @param {{ budgetMs: number | undefined, elapsedMs: number, remainingMs: number }} state */
export const fitsBudget = ({ budgetMs, elapsedMs, remainingMs }) => budgetMs === undefined || elapsedMs + remainingMs <= budgetMs
