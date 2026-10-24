import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    // the scene and audio goldens build whole weapons: 5 s is too little on a loaded machine
    testTimeout: 30000,
  },
})
