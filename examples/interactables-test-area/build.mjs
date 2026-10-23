// Bundles the furniture area (and the two kit packages it needs) into dist/furniture-area.js (IIFE, global `FurnitureArea`) and, when the
// shared test room page is found (ROOM_HTML, default the offline copy under /mnt/project-files), writes dist/sala-moveis.html: the room page
// with the area loaded into it, one file, no network.
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

for (const p of ['game-interactables', 'game-interactables-household', 'game-interactables-three']) {
  if (!existsSync(join(pkg(p), 'dist/index.js'))) throw new Error(`${p} is not built: run pnpm -r build first`)
}

const result = await esbuild.build({
  entryPoints: [join(here, 'src/entry.js')],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'FurnitureArea',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  alias: {
    '@adatechnology/game-interactables': join(pkg('game-interactables'), 'dist/index.js'),
    '@adatechnology/game-interactables-household': join(pkg('game-interactables-household'), 'dist/index.js'),
    '@adatechnology/game-interactables-three': join(pkg('game-interactables-three'), 'dist/index.js'),
  },
})
mkdirSync(join(here, 'dist'), { recursive: true })
const bundle = result.outputFiles[0].text
writeFileSync(join(here, 'dist/furniture-area.js'), bundle)
console.log(`dist/furniture-area.js ${(bundle.length / 1024).toFixed(0)} KB`)

const roomHtml = process.env.ROOM_HTML || '/mnt/project-files/docs/offline/sala-de-testes/sala-de-testes.html'
if (existsSync(roomHtml)) {
  const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1')
  const page = readFileSync(roomHtml, 'utf8')
  const at = page.lastIndexOf('</body>')
  if (at < 0) throw new Error('the room page has no </body>')
  // the room page sets window.__testRoom synchronously; our script runs right after it and loads the module into that room
  const boot = `window.__furnitureReport = FurnitureArea.loadInto(window.__testRoom)`
  const html = `${page.slice(0, at)}<script>${safe(bundle)}\n${boot}</script>\n${page.slice(at)}`
  writeFileSync(join(here, 'dist/sala-moveis.html'), html)
  console.log(`dist/sala-moveis.html ${(html.length / 1024).toFixed(0)} KB`)
} else {
  console.log(`room page not found at ${roomHtml}: set ROOM_HTML to build dist/sala-moveis.html`)
}
