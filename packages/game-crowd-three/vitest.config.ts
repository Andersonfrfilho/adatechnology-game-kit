import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    // the renderer test bakes bodies with the rich builder
    testTimeout: 60_000,
  },
})
