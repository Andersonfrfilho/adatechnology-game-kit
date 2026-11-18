import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, an IIFE (dist/index.global.js) exposing the `GameWorkers` global, and the node entry (worker_threads) apart so no browser bundle pulls it.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'iife'],
    globalName: 'GameWorkers',
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'es2020',
  },
  {
    entry: { node: 'src/node.ts' },
    format: ['esm'],
    platform: 'node',
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2022',
  },
])
