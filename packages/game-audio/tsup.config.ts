import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (@adatechnology/game-contracts stays external; only its types are used), and an IIFE (dist/index.global.js) exposing
// the `GameAudio` global, so a plain-script page needs only this file.
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
    globalName: 'GameAudio',
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\//],
  },
])
