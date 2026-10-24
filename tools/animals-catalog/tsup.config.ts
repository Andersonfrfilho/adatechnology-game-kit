import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  platform: 'node',
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'node20',
})
