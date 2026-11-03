import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, and an IIFE (dist/index.global.js) exposing the `GameCrowd` global; the physics worker is its own ESM file, loaded beside the bundle.
export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'iife'],
    globalName: 'GameCrowd',
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
  },
  {
    entry: { 'physics-worker': 'src/physics/offload/worker-entry.ts' },
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
  },
])
