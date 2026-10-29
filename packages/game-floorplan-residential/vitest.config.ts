import { defineConfig } from 'vitest/config'

// The slab-house and zoning loops generate hundreds of plans; with the whole workspace testing in parallel they pass the 5 s default.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts'], testTimeout: 120000 },
})
