import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (@adatechnology/game-contracts stays external), and an IIFE (dist/index.global.js) exposing the `GameFluids` global with
// the contracts bundled in, so a plain-script page needs only this file.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['three'],
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GameFluids',
    sourcemap: true,
    target: 'es2020',
    external: ['three'],
    noExternal: [/^@adatechnology\//],
  },
])
