import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (jolt-physics and the kit's game-physics stay external), and an IIFE (dist/index.global.js) exposing the
// `GamePhysicsJolt` global with Jolt's wasm-compat build and game-physics bundled in, so a plain-script page needs only this file.
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
    globalName: 'GamePhysicsJolt',
    sourcemap: true,
    target: 'es2020',
    noExternal: [/^@adatechnology\//, /^jolt-physics/],
  },
])
