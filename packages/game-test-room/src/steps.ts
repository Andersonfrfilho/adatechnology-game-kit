/** Runs a generator of steps to its end at once and returns what it returns (the synchronous way of a job written a step at a time). */
export function runSteps<TStep, TResult>(steps: Generator<TStep, TResult>): TResult {
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
  }
}

/** Runs a generator of steps to its end, awaiting `between(step)` after each step it yields: a page paints, a bar moves, between the steps of a heavy job. */
export async function runStepsAsync<TStep, TResult>(steps: Generator<TStep, TResult>, between: (step: TStep) => Promise<void>): Promise<TResult> {
  for (;;) {
    const step = steps.next()
    if (step.done) return step.value
    await between(step.value)
  }
}
