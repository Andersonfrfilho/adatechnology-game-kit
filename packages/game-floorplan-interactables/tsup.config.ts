import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, and an IIFE (dist/index.global.js) exposing the `GameFloorplanInteractables` global. The package has no runtime dependency:
// the interactables kit (`GameInteractables`, `GameInteractablesHousehold`) enters through `create(...)`, as the pages load it.
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
    globalName: 'GameFloorplanInteractables',
    sourcemap: true,
    target: 'es2020',
  },
])
