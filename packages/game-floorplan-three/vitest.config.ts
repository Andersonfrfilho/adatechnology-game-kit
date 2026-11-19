import { availableParallelism } from 'node:os'

import { defineConfig } from 'vitest/config'

// Forks (processes, never threads: a threaded worker missed its heartbeat while the golden loops held it for seconds with the workspace testing in parallel).
// A quarter of the cores, 2 to 6: the pre-push tests two packages at once and CI runners have few cores; one fork per file took ~17 min, six take ~6.
const maxForks = Math.min(6, Math.max(2, Math.floor(availableParallelism() / 4)))

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts', 'tests/setup.ts', 'tests/setup-physics.ts'], testTimeout: 120000, pool: 'forks', poolOptions: { forks: { maxForks, minForks: 1 } } },
})
