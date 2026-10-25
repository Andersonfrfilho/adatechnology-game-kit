import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  platform: 'node',
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'node20',
  // time the built packages as they ship, not a re-bundled copy
  external: [/^@adatechnology\//, 'three'],
})
