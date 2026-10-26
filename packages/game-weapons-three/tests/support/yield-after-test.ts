import { afterEach } from 'vitest'

// The weapon tests are long synchronous loops. A test file that never leaves the microtask queue also never reads the messages
// of the vitest main process, so its "onTaskUpdate" call waits unanswered until birpc gives up after 60 s ("Timeout calling
// onTaskUpdate") and the run fails with an unhandled error. Yielding one macrotask after each test lets the worker answer.
afterEach(async () => {
  await new Promise<void>((resolve) => setImmediate(resolve))
})
