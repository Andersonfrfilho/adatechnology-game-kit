import { defineConfig } from 'tsup'

// ESM + d.ts for bundlers (main entry and the `/three` adapter entry), and an IIFE (dist/index.global.js)
// exposing the `GameVegetation` global. The IIFE already includes the three adapter; `three` itself is never bundled
// (the host passes the THREE namespace in at runtime).
export default defineConfig([
  {
    entry: { index: 'src/index.ts', three: 'src/three/index.ts' },
    format: ['esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['three'],
  },
  {
    entry: { index: 'src/index.global.ts' },
    format: ['iife'],
    globalName: 'GameVegetation',
    outExtension: () => ({ js: '.global.js' }),
    sourcemap: true,
    clean: false,
    target: 'es2020',
    external: ['three'],
  },
])
