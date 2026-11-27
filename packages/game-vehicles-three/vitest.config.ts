import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Heavy 3D geometry suites thrash CPU/GC at full core count and stretch synchronous calls past vitest's 60 s onTaskUpdate RPC timeout.
  test: { include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts', 'tests/setup.ts', 'tests/support/room-physics.ts'], testTimeout: 120000, poolOptions: { threads: { maxThreads: 4 }, forks: { maxForks: 4 } } },
})
