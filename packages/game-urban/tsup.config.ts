import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, and an IIFE (dist/index.global.js) exposing the `GameUrban` global with the engine bundled in.
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
    globalName: 'GameUrban',
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\//],
  },
])
