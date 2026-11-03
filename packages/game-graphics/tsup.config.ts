import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (the core and the `./screen` subpath), and an IIFE (dist/index.global.js) exposing the `GameGraphics` global.
export default defineConfig([
  {
    entry: { index: 'src/index.ts', screen: 'src/screen.ts' },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'es2020',
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['iife'],
    globalName: 'GameGraphics',
    sourcemap: true,
    target: 'es2020',
  },
])
