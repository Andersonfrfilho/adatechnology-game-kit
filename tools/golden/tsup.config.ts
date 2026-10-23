import { defineConfig } from 'tsup'

// ESM + d.ts for the vitest side, and an IIFE (dist/index.global.js) that the recorder injects into the page as `GoldenTool`.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'iife'],
  globalName: 'GoldenTool',
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'es2020',
})
