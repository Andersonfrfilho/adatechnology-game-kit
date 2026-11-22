import { defineConfig } from 'tsup'

// ESM + d.ts: the preset is composition code for a bundler. The kit's worker file besides (CLAUDE.md §14): a module (dist/kit-worker.js,
// what `createKitWorkers` loads by default, the other packages external for the bundler) and a classic script with everything bundled
// (dist/kit-worker.global.js), the text a one-file page hands to `sourceSpawn`.
export default defineConfig([
  {
    entry: ['src/index.ts', 'src/kit-worker.ts'],
    format: ['esm'],
    dts: { entry: 'src/index.ts' },
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
  },
  {
    entry: { 'kit-worker': 'src/kit-worker.ts' },
    format: ['iife'],
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\//],
  },
])
