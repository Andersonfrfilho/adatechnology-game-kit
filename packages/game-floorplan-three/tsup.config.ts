import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (three.js and the other @adatechnology packages stay external), and an IIFE (dist/index.global.js) exposing the
// `GameFloorplanThree` global. three.js is the page's own `THREE`: the global build leaves it external.
export default defineConfig([
  {
    entry: ['src/index.ts', 'src/testing.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['three', /^three\//],
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GameFloorplanThree',
    sourcemap: true,
    target: 'es2020',
    external: ['three', /^three\//],
    noExternal: [/^@adatechnology\//],
    esbuildOptions(options) {
      options.globalName = 'GameFloorplanThree'
    },
  },
])
