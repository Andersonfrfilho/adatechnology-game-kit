import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (the other @adatechnology packages stay external), and an IIFE (dist/index.global.js) exposing the
// `GameTestRoom` global with the @adatechnology packages it needs bundled in, so a plain-script page needs only three.js and this file.
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
    globalName: 'GameTestRoom',
    sourcemap: true,
    target: 'es2020',
    external: ['three'],
    noExternal: [/^@adatechnology\//],
  },
])
