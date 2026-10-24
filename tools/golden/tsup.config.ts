import { defineConfig } from 'tsup'

// ESM + d.ts for the vitest side, and an IIFE (dist/index.global.js) that the recorder injects into the page as `GoldenTool`.
// The IIFE is built from browser.ts: it leaves out the node-only cut-literal. `cut-source`, `team-audio` and `record-page` are Node-only (they evaluate
// team code in `node:vm` and drive the recorder), so they are separate ESM entries and never part of the page bundle.
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
  {
    entry: ['src/cut-source.ts', 'src/team-audio.ts', 'src/record-page.ts'],
    format: ['esm'],
    platform: 'node',
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: false,
    target: 'node20',
  },
])
