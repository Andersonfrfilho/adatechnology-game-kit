import { defineConfig } from 'tsup'

// main.cjs is Electron's main process (CommonJS: what `main` in package.json loads with no loader); stage and check-desktop are node scripts run from the repo
export default defineConfig([
  {
    entry: { main: 'src/main.ts' },
    format: ['cjs'],
    outExtension: () => ({ js: '.cjs' }),
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node20',
    platform: 'node',
    external: ['electron'],
    noExternal: ['@adatechnology/serve-room-tool'],
  },
  {
    entry: { stage: 'src/stage.ts', 'check-desktop': 'src/check-desktop.ts' },
    format: ['esm'],
    splitting: false,
    sourcemap: true,
    target: 'node20',
    platform: 'node',
    external: ['playwright-core', 'electron'],
  },
])
