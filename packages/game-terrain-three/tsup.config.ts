import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/testing.ts'],
    format: ['esm'],
    dts: true,
    // one copy of the registries and module state, shared by the root and the ./testing entries
    splitting: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['three'],
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GameTerrainThree',
    sourcemap: true,
    target: 'es2020',
    external: ['three'],
    noExternal: [/^@adatechnology\//],
  },
])
