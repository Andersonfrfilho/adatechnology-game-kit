import { defineConfig } from 'vitest/config'

import { MAX_TEST_FORKS } from '../../test-support/max-forks'

// Forks: the golden loops keep a worker busy for seconds, and a threaded worker missed its heartbeat. The two VC3 golden files run in their own
// workers, every test yields one turn of the event loop (test-support/yield-between-tests.ts), and CI shards the package (`SHARDS` in .github/workflows/ci.yml).
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts'], testTimeout: 120000, pool: 'forks', poolOptions: { forks: { maxForks: MAX_TEST_FORKS, minForks: 1 } } },
})
