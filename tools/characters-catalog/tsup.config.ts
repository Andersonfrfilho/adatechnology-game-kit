import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/record-golden-vm.ts', 'src/record-golden-chrome.ts'],
  format: ['esm'],
  platform: 'node',
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'node20',
  external: [/^@adatechnology\/golden-tool/],
})
