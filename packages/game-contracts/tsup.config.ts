import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (index and testing), and an IIFE (dist/index.global.js) exposing the `GameContracts` global.
export default defineConfig([
  {
    entry: ['src/index.ts', 'src/testing.ts'],
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
    globalName: 'GameContracts',
    sourcemap: true,
    clean: false,
    target: 'es2020',
  },
])
