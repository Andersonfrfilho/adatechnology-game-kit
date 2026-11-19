import { defineConfig } from 'vitest/config'

import { MAX_TEST_FORKS } from '../../test-support/max-forks'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts'], testTimeout: 120000, pool: 'forks', poolOptions: { forks: { maxForks: MAX_TEST_FORKS, minForks: 1 } } },
})
