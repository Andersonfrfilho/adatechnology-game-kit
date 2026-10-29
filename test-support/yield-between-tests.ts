import { afterEach, beforeEach } from 'vitest'

// The tests are synchronous for seconds at a time and vitest only awaits microtasks between them, so the reply to the worker's onTaskUpdate
// (sent from a 100 ms throttle timer) sits unread until its 60 s RPC timer fires first on a loaded machine. After a long test, wait out the
// throttle and the reply before the next one blocks the worker again.
const LONG_TEST_MS = 500
const REPLY_WAIT_MS = 250

let startedAt = 0

beforeEach(() => {
  startedAt = performance.now()
})

afterEach(async () => {
  if (performance.now() - startedAt < LONG_TEST_MS) return
  await new Promise<void>((resolve) => setTimeout(resolve, REPLY_WAIT_MS))
})
