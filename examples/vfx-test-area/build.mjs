// Bundles the effects area (@adatechnology/game-vfx-three and the catalogue of @adatechnology/game-vfx) into dist/vfx-area.js (IIFE, global `VfxArea`) and,
// when the shared test room page is found (ROOM_HTML, default the kit's own examples/test-room build), writes dist/sala-efeitos.html: the room
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

for (const p of ['game-vfx', 'game-vfx-three']) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'VfxArea',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: {
    '@adatechnology/game-vfx': join(pkg('game-vfx'), 'dist/index.js'),
    '@adatechnology/game-vfx-three': join(pkg('game-vfx-three'), 'dist/index.js'),
    '@adatechnology/game-vfx-three/testing': join(pkg('game-vfx-three'), 'dist/testing.js'),
  },
})
mkdirSync(join(here, 'dist'), { recursive: true })
const bundle = result.outputFiles[0].text
writeFileSync(join(here, 'dist/vfx-area.js'), bundle)
console.log(`dist/vfx-area.js ${(bundle.length / 1024).toFixed(0)} KB`)

const roomHtml = process.env.ROOM_HTML || join(here, '../test-room/base/test-room.html')
if (existsSync(roomHtml)) {
  const page = readFileSync(roomHtml, 'utf8')
  // the room page runs our script once its room exists (window.__testRoom, after Jolt loads: withArea of examples/test-room/area-page.mjs); it loads the module into that room and opens its area
  const boot = `window.__vfxReport = VfxArea.loadInto(window.__testRoom)`
  const html = withArea(page, bundle, boot)
  writeFileSync(join(here, 'dist/sala-efeitos.html'), html)
  console.log(`dist/sala-efeitos.html ${(html.length / 1024).toFixed(0)} KB`)
} else {
  console.log(`room page not found at ${roomHtml}: build examples/test-room first or set ROOM_HTML to build dist/sala-efeitos.html`)
}
