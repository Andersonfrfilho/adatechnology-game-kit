import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (@adatechnology/* stays external), and an IIFE (dist/index.global.js) exposing the `GameInteractablesHousehold` global
// with the goods catalog bundled in, so a plain-script page needs only this file.
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
    globalName: 'GameInteractablesHousehold',
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\//],
  },
])
