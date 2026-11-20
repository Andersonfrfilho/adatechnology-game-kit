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
