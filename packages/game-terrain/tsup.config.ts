import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
      },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GameTerrain',
    sourcemap: true,
    target: 'es2020',
        noExternal: [/^@adatechnology\//],
  },
])
