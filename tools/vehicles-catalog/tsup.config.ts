import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/compare.ts', 'src/record-lite.ts'],
  format: ['esm'],
  platform: 'node',
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'node20',
})
