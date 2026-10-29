import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tests run against the engine sources so they do not need a build of the sibling package.
export default defineConfig({
  resolve: {
    alias: { '@adatechnology/game-interactables': fileURLToPath(new URL('../game-interactables/src/index.ts', import.meta.url)) },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts'] },
})
