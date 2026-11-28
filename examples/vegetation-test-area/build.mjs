// Bundles the vegetation area (@adatechnology/game-vegetation-three with the engine and the species) into dist/vegetation-area.js (IIFE, global `VegetationArea`) and,
// when the shared test room page is found (ROOM_HTML, default the kit's own examples/test-room build), writes dist/sala-vegetacao.html: the room
// page with the area loaded and opened, one file, no network.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { withArea } from '../test-room/area-page.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const pkg = (/** @type {string} */ name) => join(root, 'packages', name)

function findEsbuild() {
  const store = join(root, 'node_modules/.pnpm')
  const dirs = readdirSync(store).filter((d) => d.startsWith('esbuild@')).sort().reverse()
  for (const d of dirs) {
    const p = join(store, d, 'node_modules/esbuild')
    if (existsSync(join(p, 'lib/main.js'))) return p
  }
  throw new Error('esbuild not found in node_modules/.pnpm (run pnpm install)')
}
const esbuild = createRequire(import.meta.url)(findEsbuild())

const packages = ['game-kit-defaults', 'game-vegetation', 'game-vegetation-species', 'game-vegetation-three']
for (const p of [...packages, 'game-contracts']) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'VegetationArea',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: {
    '@adatechnology/game-vegetation-three/testing': join(pkg('game-vegetation-three'), 'dist/testing.js'),
    ...Object.fromEntries([...packages, 'game-contracts'].map((p) => [`@adatechnology/${p}`, join(pkg(p), 'dist/index.js')])),
    // the engine's three.js adapter is a second entry of the same package
    '@adatechnology/game-vegetation/three': join(pkg('game-vegetation'), 'dist/three.js'),
  },
})
mkdirSync(join(here, 'dist'), { recursive: true })
const bundle = result.outputFiles[0].text
writeFileSync(join(here, 'dist/vegetation-area.js'), bundle)
console.log(`dist/vegetation-area.js ${(bundle.length / 1024).toFixed(0)} KB`)

const roomHtml = process.env.ROOM_HTML || join(here, '../test-room/base/test-room.html')
if (existsSync(roomHtml)) {
  const page = readFileSync(roomHtml, 'utf8')
  // the room page runs our script once its room exists (window.__testRoom, after Jolt loads: withArea of examples/test-room/area-page.mjs); it loads the module into that room and opens its area
  const boot = `window.__vegetationReport = VegetationArea.loadInto(window.__testRoom)`
  const html = withArea(page, bundle, boot)
  writeFileSync(join(here, 'dist/sala-vegetacao.html'), html)
  console.log(`dist/sala-vegetacao.html ${(html.length / 1024).toFixed(0)} KB`)
} else {
  console.log(`room page not found at ${roomHtml}: build examples/test-room first or set ROOM_HTML to build dist/sala-vegetacao.html`)
}
