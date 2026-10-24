import { defineConfig } from 'tsup'

// ESM + d.ts for the vitest side, and an IIFE (dist/index.global.js) that the recorder injects into the page as `GoldenTool`.
// The IIFE is built from browser.ts: it leaves out the node-only cut-literal.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    target: 'es2020',
  },
  {
    entry: { index: 'src/browser.ts' },
    format: ['iife'],
    globalName: 'GoldenTool',
    splitting: false,
    sourcemap: false,
    target: 'es2020',
  },
])
