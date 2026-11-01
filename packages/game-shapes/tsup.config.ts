import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers and workers (dist/worker.js: only what a worker script needs), and an IIFE (dist/index.global.js) exposing the `GameShapes` global (@adatechnology/game-contracts bundled in; its catalog helpers are the only runtime dependency).
export default defineConfig([
  {
    entry: { index: 'src/index.ts', worker: 'src/worker.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['iife'],
    globalName: 'GameShapes',
    outExtension: () => ({ js: '.global.js' }),
    sourcemap: true,
    clean: false,
    target: 'es2020',
    noExternal: [/^@adatechnology\//],
  },
])
