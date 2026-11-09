// @ts-check
// Runs the browser steps one after another. By default it goes on after a failure and reports every failing step at the end (a nightly with one red
// scenario must still say what the other areas did); with failFast it stops at the first failure. Pure over the `exec` it is given, so it is tested without a browser.

/** @typedef {{ label: string, args: string[], env?: Record<string, string>, fatal?: boolean, needs?: string }} Step */
/** @typedef {{ label: string, status: 'ok' | 'failed' | 'skipped', code: number }} StepOutcome */

/**
 * `fatal` stops the run when the step fails (the test room's build, which every page is built over); `needs` skips the step when the named step failed.
 * @param {{ steps: Step[], exec: (step: Step) => number, failFast?: boolean }} input
 * @returns {{ outcomes: StepOutcome[], failed: StepOutcome[], exitCode: number }}
 */
export function runSteps({ steps, exec, failFast = false }) {
  /** @type {StepOutcome[]} */
  const outcomes = []
  for (const step of steps) {
    if (step.needs && outcomes.some((outcome) => outcome.label === step.needs && outcome.status !== 'ok')) {
      outcomes.push({ label: step.label, status: 'skipped', code: 0 })
      continue
    }
    const code = exec(step)
    outcomes.push({ label: step.label, status: code === 0 ? 'ok' : 'failed', code })
    if (code !== 0 && (failFast || step.fatal)) break
  }
  const failed = outcomes.filter((outcome) => outcome.status === 'failed')
  return { outcomes, failed, exitCode: failed.length ? (failed[0]?.code ?? 1) : 0 }
}

/** One line per step, which nightly-gpu.mjs parses. @param {StepOutcome} outcome */
export const summaryLine = (outcome) =>
  `browser-checks: ${outcome.status === 'ok' ? 'ok' : outcome.status === 'skipped' ? 'skipped' : `FAILED (exit ${outcome.code})`}: ${outcome.label}`

/** @param {string} text @returns {{ label: string, result: string }[]} */
export function parseSummaryLines(text) {
  /** @type {{ label: string, result: string }[]} */
  const parsed = []
  for (const line of text.split('\n')) {
    const match = /^browser-checks: (ok|skipped|FAILED \(exit [^)]*\)): (.+)$/.exec(line)
    if (match) parsed.push({ label: match[2] ?? '', result: match[1] ?? '' })
  }
  return parsed
}
