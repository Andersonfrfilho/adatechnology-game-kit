import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, and an IIFE (dist/index.global.js) exposing the `GameItemsThree` global with the other @adatechnology packages bundled in,
// so a script tag needs only three.js.
export default defineConfig([
  {
    entry: ['src/index.ts', 'src/testing.ts'],
    format: ['esm'],
    dts: true,
    // one copy of the registries, shared by the root and the ./testing entries
    splitting: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GameItemsThree',
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\//],
  },
])
