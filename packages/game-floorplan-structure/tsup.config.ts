import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (the other @adatechnology packages stay external), and an IIFE (dist/index.global.js) exposing the
// `GameFloorplanStructure` global with the game-contracts and game-destruction code it needs bundled in. The floor plan engine is not bundled:
// `register(engine)` receives the engine the page already loaded.
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
    globalName: 'GameFloorplanStructure',
    sourcemap: true,
    target: 'es2020',
    external: ['@adatechnology/game-floorplan'],
    noExternal: [/^@adatechnology\/game-(contracts|destruction)$/],
  },
])
