import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (the other @adatechnology packages stay external), and an IIFE (dist/index.global.js) exposing the
// `GameDestructionThree` global with the @adatechnology packages it needs bundled in, so a plain-script page needs only three.js and this file.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
    external: ['three'],
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GameDestructionThree',
    sourcemap: true,
    target: 'es2020',
    external: ['three'],
    noExternal: [/^@adatechnology\//],
  },
  // the package's kinds of the worker coordinator (`groundTilesKind`), for a game's worker file: no three.js, the other packages external
  {
    entry: { 'worker-kinds': 'src/worker-kinds.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    target: 'es2020',
  },
  // the ground worker (`createWorkerGroundPort`): a module (dist/ground-worker.js) and a classic script (dist/ground-worker.global.js) a host can start from a Blob; no three.js
  {
    entry: { 'ground-worker': 'src/ground-worker.ts' },
    format: ['esm', 'iife'],
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\//],
  },
])
