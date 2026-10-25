import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts'],
    // the goldens build hundreds of bodies and meet the 5 s default on a loaded machine
    testTimeout: 60_000,
  },
})
