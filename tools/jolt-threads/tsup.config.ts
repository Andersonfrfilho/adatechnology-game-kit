import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  platform: 'node',
  external: ['playwright-core'],
})
