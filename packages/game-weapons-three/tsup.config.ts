import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers, and an IIFE (dist/index.global.js) exposing the `GameWeaponsThree` global with the arsenal data bundled in,
// so a script tag needs only three.js.
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
    globalName: 'GameWeaponsThree',
    sourcemap: true,
    target: 'es2020',
    noExternal: ['@adatechnology/game-audio', '@adatechnology/game-weapons', '@adatechnology/game-interactables-three', '@adatechnology/game-interactables', '@adatechnology/game-props3d', '@adatechnology/game-shapes', '@adatechnology/game-shapes-three', '@adatechnology/game-vfx', '@adatechnology/game-vfx-three'],
  },
])
