import { defineConfig } from 'vitest/config'

// Forks, one test file at a time: the golden loops keep a worker busy for seconds, and with the whole workspace testing in parallel a threaded worker missed its heartbeat.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'], testTimeout: 120000, pool: 'forks', poolOptions: { forks: { singleFork: true } } },
})
