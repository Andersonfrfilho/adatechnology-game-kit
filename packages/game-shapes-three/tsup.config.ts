import { defineConfig } from 'tsup'

// ESM + d.ts, and an IIFE (dist/index.global.js) exposing `GameShapesThree` with game-shapes bundled in. three is never bundled: the host passes THREE.
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['three'],
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['iife'],
    globalName: 'GameShapesThree',
    outExtension: () => ({ js: '.global.js' }),
    sourcemap: true,
    clean: false,
    target: 'es2020',
    external: ['three'],
    noExternal: ['@adatechnology/game-shapes'],
  },
])
