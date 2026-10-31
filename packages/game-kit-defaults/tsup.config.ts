import { defineConfig } from 'tsup'

// ESM + d.ts only: the preset is composition code for a bundler, there is no browser global.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
})
