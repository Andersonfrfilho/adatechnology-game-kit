// Bundles the items area (@adatechnology/game-items-three over the goods catalog of game-items-goods) into dist/items-area.js (IIFE, global `ItemsArea`) and,
// when the shared test room page is found (ROOM_HTML, default the kit's own examples/test-room build), writes dist/sala-itens.html: the room
// page with the area loaded and opened, one file, no network.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const pkg = (name) => join(root, 'packages', name)

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

for (const p of ['game-items', 'game-items-goods', 'game-items-three', 'game-interactables', 'game-props3d', 'game-contracts']) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'ItemsArea',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: {
    '@adatechnology/game-items': join(pkg('game-items'), 'dist/index.js'),
    '@adatechnology/game-items-goods': join(pkg('game-items-goods'), 'dist/index.js'),
    '@adatechnology/game-items-three': join(pkg('game-items-three'), 'dist/index.js'),
    '@adatechnology/game-items-three/testing': join(pkg('game-items-three'), 'dist/testing.js'),
    '@adatechnology/game-interactables': join(pkg('game-interactables'), 'dist/index.js'),
    '@adatechnology/game-props3d': join(pkg('game-props3d'), 'dist/index.js'),
    '@adatechnology/game-contracts': join(pkg('game-contracts'), 'dist/index.js'),
  },
})
mkdirSync(join(here, 'dist'), { recursive: true })
const bundle = result.outputFiles[0].text
writeFileSync(join(here, 'dist/items-area.js'), bundle)
console.log(`dist/items-area.js ${(bundle.length / 1024).toFixed(0)} KB`)

const roomHtml = process.env.ROOM_HTML || join(here, '../test-room/base/test-room.html')
if (existsSync(roomHtml)) {
  const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1')
  const page = readFileSync(roomHtml, 'utf8')
  const at = page.lastIndexOf('</body>')
  if (at < 0) throw new Error('the room page has no </body>')
  // the room page sets window.__testRoom synchronously; our script runs right after it, loads the module into that room and opens its area
  const boot = `window.__itemsReport = ItemsArea.loadInto(window.__testRoom)`
  const html = `${page.slice(0, at)}<script>${safe(bundle)}\n${boot}</script>\n${page.slice(at)}`
  writeFileSync(join(here, 'dist/sala-itens.html'), html)
  console.log(`dist/sala-itens.html ${(html.length / 1024).toFixed(0)} KB`)
} else {
  console.log(`room page not found at ${roomHtml}: build examples/test-room first or set ROOM_HTML to build dist/sala-itens.html`)
}
