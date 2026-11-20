// @ts-check
// The decisions of tools/gpu/perf-gate.mjs that need no browser, git or disk: whether and how the base worktree is built, how long a round takes,
// and the timings of a round. Pure, so tests/perf-gate-plan.test.mjs can hold them.

/**
 * Whether the base worktree must be built: it was not built at the expected sha (the marker is written only after a complete build), it holds another
 * commit or edits (the nightly and other sessions use it too), or the page it built is gone.
 * @param {{ builtSha: string | undefined, expectedSha: string, headSha: string, isClean: boolean, hasOutput: boolean }} state
 */
export const needsBuild = ({ builtSha, expectedSha, headSha, isClean, hasOutput }) =>
  !hasOutput || !isClean || headSha !== expectedSha || builtSha !== expectedSha

/**
 * The build of the base worktree, step by step. The marker goes first and comes back last: a step that throws leaves no marker, so the next round builds again.
 * @param {{ clearMarker: () => void, checkout: () => void, install: () => void, build: () => void, buildRoom: () => void, writeMarker: () => void }} steps
 */
export const buildSequence = (steps) => {
  steps.clearMarker()
  steps.checkout()
  steps.install()
  steps.build()
  steps.buildRoom()
  steps.writeMarker()
}

export const WAIT_FOR_QUIET_MS = 10 * 60 * 1000

/** What the steps cost, fixed and rounded from past rounds (not measured by the gate): a perf.mjs run is ~7.7 min. */
const BUILD_BRANCH_MIN = 1
const BUILD_BASE_MIN = 4
const MEASURE_MIN = 7.7
const WAIT_QUIET_MAX_MIN = WAIT_FOR_QUIET_MS / 60000

/** @param {{ needsBaseRun: boolean, needsBaseBuild: boolean }} plan */
export const describeRound = ({ needsBaseRun, needsBaseBuild }) => {
  const measures = needsBaseRun ? 2 : 1
  const minutes = BUILD_BRANCH_MIN + (needsBaseBuild ? BUILD_BASE_MIN : 0) + measures * MEASURE_MIN
  const withRepetition = minutes + 2 * MEASURE_MIN + (needsBaseBuild || needsBaseRun ? 0 : BUILD_BASE_MIN)
  const waits = measures + 2
  return (
    `this round takes about ${Math.round(minutes)} min (${Math.round(withRepetition)} min if a metric needs the repetition), ` +
    `plus up to ${WAIT_QUIET_MAX_MIN} min of waiting for a quiet machine before each measurement (up to ${waits} of them); estimated, not measured`
  )
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
