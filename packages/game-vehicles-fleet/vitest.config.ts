import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts', 'tests/setup.ts'], testTimeout: 120000 },
})
