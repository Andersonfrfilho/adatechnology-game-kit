import { defineConfig } from 'vitest/config'

import { MAX_TEST_FORKS } from '../../test-support/max-forks'

// Forks (processes, never threads: a threaded worker missed its heartbeat while the golden loops held it for seconds with the workspace testing in parallel).
// One fork for every file took ~17 min; MAX_TEST_FORKS (six here) take 5 to 6.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts', 'tests/setup.ts', 'tests/setup-physics.ts'], testTimeout: 120000, pool: 'forks', poolOptions: { forks: { maxForks: MAX_TEST_FORKS, minForks: 1 } } },
})
