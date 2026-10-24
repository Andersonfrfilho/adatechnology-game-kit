import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (@adatechnology/game-characters stays external), and an IIFE (dist/index.global.js) exposing the `GameCharactersUndead`
// global with the engine bundled in. The JSON data is inlined by the bundler.
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
    globalName: 'GameCharactersUndead',
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\//],
  },
])
