import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, and an IIFE (dist/index.global.js) exposing the `GameProps3d` global; the IIFE bundles game-shapes and
// game-shapes-three so a script tag needs nothing else.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'es2020',
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GameProps3d',
    sourcemap: true,
    target: 'es2020',
    noExternal: ['@adatechnology/game-shapes', '@adatechnology/game-shapes-three'],
  },
])
