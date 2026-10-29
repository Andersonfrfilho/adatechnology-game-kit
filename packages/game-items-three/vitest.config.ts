import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'happy-dom', include: ['tests/**/*.test.ts'], setupFiles: ['../../test-support/yield-between-tests.ts', '../../test-support/canvas-2d.ts'] },
})
