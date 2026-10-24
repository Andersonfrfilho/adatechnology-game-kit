import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers and workers, and an IIFE (dist/index.global.js) exposing the `GameShapes` global. No runtime dependency.
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['iife'],
    globalName: 'GameShapes',
    outExtension: () => ({ js: '.global.js' }),
    sourcemap: true,
    clean: false,
    target: 'es2020',
  },
])
