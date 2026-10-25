import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (the engine stays an import), and an IIFE (dist/index.global.js) exposing the `GameInteractablesThree`
// global with the engine's pose math bundled in, so the script tag needs no other global.
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
    globalName: 'GameInteractablesThree',
    sourcemap: true,
    target: 'es2020',
    noExternal: ['@adatechnology/game-interactables', '@adatechnology/game-shapes'],
  },
])
