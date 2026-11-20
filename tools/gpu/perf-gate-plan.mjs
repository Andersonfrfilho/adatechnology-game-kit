// @ts-check
// The decisions of tools/gpu/perf-gate.mjs that need no browser, git or disk: whether the base worktree must be built, where the second run of main is kept,
// when to stop waiting for a quiet machine, whether the renderer probe is still good, and how long a round takes. Pure, so tests/perf-gate-plan.test.mjs can hold them.

/** @param {{ builtSha: string | undefined, expectedSha: string, hasOutput: boolean }} state the sha written after the last complete build, and whether the page it built is still there */
export const needsBuild = ({ builtSha, expectedSha, hasOutput }) => !hasOutput || builtSha !== expectedSha

/** Where the second run of main is kept: next to the first, under the same commit, GPU, window and harness key. @param {string} baseReport */
export const againReportPath = (baseReport) => baseReport.replace(/\.json$/, '-again.json')
