import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, and an IIFE (dist/index.global.js) exposing the `GameVehicles` global, with game-shapes bundled in so a script tag
// needs only three.js.
export default defineConfig([
  {
    entry: ['src/index.ts', 'src/worker-kinds.ts'],
    format: ['esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: false,
    target: 'es2020',
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GameVehicles',
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\/game-shapes/],
  },
])
