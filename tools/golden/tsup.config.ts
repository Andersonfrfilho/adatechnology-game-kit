import { defineConfig } from 'tsup'

// ESM + d.ts for the vitest side, and an IIFE (dist/index.global.js) that the recorder injects into the page as `GoldenTool`.
// `cut-source` and `team-audio` are Node-only (they evaluate team code in `node:vm`), so they are separate ESM entries and never part of the page bundle.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'iife'],
    globalName: 'GoldenTool',
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    target: 'es2020',
  },
  {
    entry: ['src/cut-source.ts', 'src/team-audio.ts'],
    format: ['esm'],
    platform: 'node',
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: false,
    target: 'node20',
  },
])
