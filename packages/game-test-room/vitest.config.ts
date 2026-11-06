import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // a grenade test steps the whole room for seconds of game time: 1.5 s alone, past 5 s on a machine under load, the same on main
    testTimeout: 20000,
    include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts'],
  },
})
