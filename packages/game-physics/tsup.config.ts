import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, and an IIFE (dist/index.global.js) exposing the `GamePhysics` global.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'iife'],
  globalName: 'GamePhysics',
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
})
